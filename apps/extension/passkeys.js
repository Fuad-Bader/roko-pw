/**
 * RokoPW — software WebAuthn authenticator.
 *
 * Implements the credential ceremonies behind `chrome.webAuthenticationProxy`:
 * when a website calls `navigator.credentials.create()` / `.get()`, the
 * background worker hands the request here. We generate/store an ES256 passkey
 * in the encrypted vault and return a response in `PublicKeyCredential.toJSON()`
 * form (ArrayBuffers as base64url), which is exactly what the proxy expects.
 *
 * This file is pure (crypto + encoding only). Persistence is injected as a
 * `store` object so it stays testable and free of chrome.* dependencies.
 *
 * Stored credential shape:
 *   { credentialId, rpId, userHandle, userName, userDisplayName,
 *     privateKeyJwk, signCount, createdAt }
 */

// ─── base64url ─────────────────────────────────────────────────────────────────

export function b64urlToBytes(s) {
  const norm = s.replace(/-/g, '+').replace(/_/g, '/')
  const pad = norm.length % 4 ? '='.repeat(4 - (norm.length % 4)) : ''
  const bin = atob(norm + pad)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function bytesToB64url(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function concatBytes(arrays) {
  let len = 0
  for (const a of arrays) len += a.length
  const out = new Uint8Array(len)
  let o = 0
  for (const a of arrays) { out.set(a, o); o += a.length }
  return out
}

// ─── Minimal CBOR encoder (enough for COSE keys + attestation objects) ─────────

function cborHead(major, n) {
  const m = major << 5
  if (n < 24) return new Uint8Array([m | n])
  if (n < 0x100) return new Uint8Array([m | 24, n])
  if (n < 0x10000) return new Uint8Array([m | 25, (n >> 8) & 0xff, n & 0xff])
  return new Uint8Array([m | 26, (n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff])
}

const cborUint = (n) => cborHead(0, n)
const cborNegint = (n) => cborHead(1, -1 - n) // n is the negative value, e.g. -7
const cborBytes = (b) => concatBytes([cborHead(2, b.length), b])
const cborText = (s) => {
  const b = new TextEncoder().encode(s)
  return concatBytes([cborHead(3, b.length), b])
}
// entries: array of [keyBytes, valueBytes], already in canonical order
const cborMap = (entries) =>
  concatBytes([cborHead(5, entries.length), ...entries.flatMap(([k, v]) => [k, v])])

// COSE_Key for an EC2 / P-256 / ES256 public key (canonical key order: 1,3,-1,-2,-3)
function coseEc2Key(x, y) {
  return cborMap([
    [cborUint(1), cborUint(2)],      // kty: EC2
    [cborUint(3), cborNegint(-7)],   // alg: ES256
    [cborNegint(-1), cborUint(1)],   // crv: P-256
    [cborNegint(-2), cborBytes(x)],  // x
    [cborNegint(-3), cborBytes(y)],  // y
  ])
}

// "none"-format attestation object (canonical key order: fmt, attStmt, authData)
function attestationObject(authData) {
  return cborMap([
    [cborText('fmt'), cborText('none')],
    [cborText('attStmt'), cborMap([])],
    [cborText('authData'), cborBytes(authData)],
  ])
}

// ─── authenticatorData ─────────────────────────────────────────────────────────

const FLAG_UP = 0x01 // user present
const FLAG_UV = 0x04 // user verified
const FLAG_AT = 0x40 // attested credential data included

async function sha256(bytes) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
}

async function buildAuthData(rpId, flags, signCount, attestedCredData) {
  const rpIdHash = await sha256(new TextEncoder().encode(rpId))
  const counter = new Uint8Array(4)
  new DataView(counter.buffer).setUint32(0, signCount >>> 0, false) // big-endian
  const parts = [rpIdHash, new Uint8Array([flags]), counter]
  if (attestedCredData) parts.push(attestedCredData)
  return concatBytes(parts)
}

function attestedCredentialData(credId, coseKey) {
  const aaguid = new Uint8Array(16) // all-zero AAGUID (no attestation)
  const idLen = new Uint8Array(2)
  new DataView(idLen.buffer).setUint16(0, credId.length, false)
  return concatBytes([aaguid, idLen, credId, coseKey])
}

// ─── ECDSA raw (r‖s) → ASN.1 DER (WebAuthn assertions expect DER) ──────────────

function derEncodeInt(int) {
  let i = 0
  while (i < int.length - 1 && int[i] === 0) i++ // strip leading zero bytes
  let b = int.slice(i)
  if (b[0] & 0x80) b = concatBytes([new Uint8Array([0]), b]) // keep it positive
  return concatBytes([new Uint8Array([0x02, b.length]), b])
}

function rawSigToDer(raw) {
  const r = derEncodeInt(raw.slice(0, 32))
  const s = derEncodeInt(raw.slice(32, 64))
  return concatBytes([new Uint8Array([0x30, r.length + s.length]), r, s])
}

// ─── clientDataJSON ────────────────────────────────────────────────────────────

function clientDataJSON(type, challengeB64url, origin) {
  // The bytes we hash are the bytes we return, so field order is irrelevant.
  const json = JSON.stringify({ type, challenge: challengeB64url, origin, crossOrigin: false })
  return new TextEncoder().encode(json)
}

function hostnameOf(origin) {
  try { return new URL(origin).hostname } catch { return origin }
}

// requestDetailsJson is the PublicKeyCredential(Creation|Request)OptionsJSON; some
// callers nest it under `publicKey`. Accept either.
function optionsOf(details) {
  return details && details.publicKey ? details.publicKey : details
}

// ─── Ceremonies ────────────────────────────────────────────────────────────────

/**
 * Handle navigator.credentials.create(). Returns { responseJson } on success
 * or { error: '<DOMException name>' }.
 */
export async function handleCreate(details, origin, store) {
  const pub = optionsOf(details)
  if (!pub || !pub.challenge || !pub.user || !pub.user.id) return { error: 'NotAllowedError' }

  // We only implement ES256 (-7). Bail if the RP explicitly excludes it.
  if (Array.isArray(pub.pubKeyCredParams) && pub.pubKeyCredParams.length) {
    const supportsEs256 = pub.pubKeyCredParams.some((p) => p.alg === -7)
    if (!supportsEs256) return { error: 'NotSupportedError' }
  }

  const rpId = (pub.rp && pub.rp.id) || hostnameOf(origin)
  const existing = await store.list()

  // Don't create a second credential the RP already knows about.
  if (Array.isArray(pub.excludeCredentials)) {
    const clash = pub.excludeCredentials.some(
      (ex) => existing.some((c) => c.rpId === rpId && c.credentialId === ex.id),
    )
    if (clash) return { error: 'InvalidStateError' }
  }

  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  )
  const rawPub = new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey)) // 0x04‖X‖Y
  const coseKey = coseEc2Key(rawPub.slice(1, 33), rawPub.slice(33, 65))
  const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey)

  const credId = crypto.getRandomValues(new Uint8Array(32))
  const authData = await buildAuthData(
    rpId,
    FLAG_UP | FLAG_UV | FLAG_AT,
    0,
    attestedCredentialData(credId, coseKey),
  )
  const clientData = clientDataJSON('webauthn.create', pub.challenge, origin)

  const credentialId = bytesToB64url(credId)
  await store.add({
    credentialId,
    rpId,
    userHandle: pub.user.id, // already base64url in the JSON options
    userName: pub.user.name || '',
    userDisplayName: pub.user.displayName || '',
    privateKeyJwk,
    signCount: 0,
    createdAt: Date.now(),
  })

  return {
    responseJson: JSON.stringify({
      id: credentialId,
      rawId: credentialId,
      type: 'public-key',
      authenticatorAttachment: 'platform',
      response: {
        clientDataJSON: bytesToB64url(clientData),
        attestationObject: bytesToB64url(attestationObject(authData)),
        transports: ['internal'],
      },
      clientExtensionResults: {},
    }),
  }
}

/**
 * Handle navigator.credentials.get(). Returns { responseJson } on success or
 * { error: '<DOMException name>' }. If multiple credentials match, the caller
 * may pass `chooseCredentialId` to disambiguate.
 */
export async function handleGet(details, origin, store, chooseCredentialId) {
  const pub = optionsOf(details)
  if (!pub || !pub.challenge) return { error: 'NotAllowedError' }

  const rpId = pub.rpId || hostnameOf(origin)
  let candidates = (await store.list()).filter((c) => c.rpId === rpId)

  if (Array.isArray(pub.allowCredentials) && pub.allowCredentials.length) {
    const allowed = new Set(pub.allowCredentials.map((a) => a.id))
    candidates = candidates.filter((c) => allowed.has(c.credentialId))
  }
  if (chooseCredentialId) candidates = candidates.filter((c) => c.credentialId === chooseCredentialId)
  if (!candidates.length) return { error: 'NotAllowedError' }

  const cred = candidates[0]
  const privateKey = await crypto.subtle.importKey(
    'jwk',
    cred.privateKeyJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )

  const signCount = (cred.signCount || 0) + 1
  const authData = await buildAuthData(rpId, FLAG_UP | FLAG_UV, signCount, null)
  const clientData = clientDataJSON('webauthn.get', pub.challenge, origin)
  const signedData = concatBytes([authData, await sha256(clientData)])
  const rawSig = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, signedData),
  )

  await store.update(cred.credentialId, { signCount })

  return {
    responseJson: JSON.stringify({
      id: cred.credentialId,
      rawId: cred.credentialId,
      type: 'public-key',
      authenticatorAttachment: 'platform',
      response: {
        clientDataJSON: bytesToB64url(clientData),
        authenticatorData: bytesToB64url(authData),
        signature: bytesToB64url(rawSigToDer(rawSig)),
        userHandle: cred.userHandle || null,
      },
      clientExtensionResults: {},
    }),
  }
}
