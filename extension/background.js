/**
 * Roko extension — background service worker (Manifest V3).
 *
 * Responsibilities:
 *  - Store the encrypted vault in chrome.storage.local
 *  - Cache the unlocked AES key in chrome.storage.session (cleared when browser closes)
 *  - Handle messages from popup and content scripts
 */

import { deriveKey, decryptData, encryptData, exportKey, importRawKey, randomSalt } from './crypto.js'
import { handleCreate, handleGet } from './passkeys.js'

// ─── Message handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  handleMessage(msg).then(sendResponse).catch((err) => sendResponse({ error: String(err) }))
  return true // keep channel open for async response
})

async function handleMessage(msg) {
  switch (msg.type) {
    case 'VAULT_STATUS':
      return getStatus()
    case 'UNLOCK':
      return unlock(msg.password)
    case 'LOCK':
      return lock()
    case 'CREATE_VAULT':
      return createVault(msg.password)
    case 'GET_ENTRIES':
      return getEntries()
    case 'GET_ENTRIES_FOR_URL':
      return getEntriesForUrl(msg.url)
    case 'ADD_ENTRY':
      return addEntry(msg.entry)
    case 'DELETE_ENTRY':
      return deleteEntry(msg.id)
    case 'AUTOFILL_REQUEST':
      return getEntriesForUrl(msg.url)
    case 'GET_PASSKEYS':
      return getPasskeys()
    case 'DELETE_PASSKEY':
      return deletePasskey(msg.credentialId)
    default:
      return { error: 'Unknown message type' }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getActiveKey() {
  const { rokoKey } = await chrome.storage.session.get('rokoKey')
  if (!rokoKey) return null
  return importRawKey(rokoKey)
}

async function setActiveKey(key) {
  if (!key) {
    await chrome.storage.session.remove('rokoKey')
    return
  }
  const exported = await exportKey(key)
  await chrome.storage.session.set({ rokoKey: exported })
}

async function getEncryptedVault() {
  const { rokoVault } = await chrome.storage.local.get('rokoVault')
  return rokoVault ?? null
}

async function saveEncryptedVault(vault) {
  await chrome.storage.local.set({ rokoVault: vault })
}

// The decrypted payload is `{ entries, collections }`. Older vaults stored a
// bare entries array — accept both so the extension and web app interoperate.
function parseVaultData(plaintext) {
  const raw = JSON.parse(plaintext)
  if (Array.isArray(raw)) return { entries: raw, collections: [] }
  return { entries: raw.entries ?? [], collections: raw.collections ?? [] }
}

async function readVaultData(key, vault) {
  const plaintext = await decryptData(key, vault.iv, vault.ciphertext)
  return parseVaultData(plaintext)
}

// Write entries + collections back, preserving the recovery blob if present so
// we don't wipe a recovery phrase set up in the web app.
async function writeVaultData(key, salt, data, existingVault) {
  const payload = { entries: data.entries ?? [], collections: data.collections ?? [] }
  const { iv, ciphertext } = await encryptData(key, JSON.stringify(payload))
  const blob = { version: 1, salt, iv, ciphertext }
  if (existingVault?.recovery) blob.recovery = existingVault.recovery
  await saveEncryptedVault(blob)
}

// ─── Operations ───────────────────────────────────────────────────────────────

async function getStatus() {
  const vault = await getEncryptedVault()
  const key = await getActiveKey()
  return {
    hasVault: !!vault,
    locked: !key,
  }
}

async function unlock(password) {
  const vault = await getEncryptedVault()
  if (!vault) return { error: 'No vault found. Create one first.' }
  try {
    const key = await deriveKey(password, vault.salt)
    // Verify by attempting decryption
    await decryptData(key, vault.iv, vault.ciphertext)
    await setActiveKey(key)
    try { chrome.action.setBadgeText({ text: '' }) } catch { /* ignore */ }
    return { ok: true }
  } catch {
    return { error: 'Incorrect master password.' }
  }
}

async function lock() {
  await setActiveKey(null)
  return { ok: true }
}

async function createVault(password) {
  const salt = randomSalt()
  const key = await deriveKey(password, salt)
  await writeVaultData(key, salt, { entries: [], collections: [] }, null)
  await setActiveKey(key)
  return { ok: true }
}

async function getEntries() {
  const key = await getActiveKey()
  if (!key) return { error: 'Vault is locked.' }
  const vault = await getEncryptedVault()
  if (!vault) return { entries: [] }
  const { entries } = await readVaultData(key, vault)
  return { entries: entries.filter((e) => !e.deletedAt) }
}

async function getEntriesForUrl(url) {
  const key = await getActiveKey()
  if (!key) return { error: 'Vault is locked.' }
  const vault = await getEncryptedVault()
  if (!vault) return { entries: [] }
  const { entries } = await readVaultData(key, vault)
  // Only live login items can autofill a sign-in form.
  const all = entries.filter((e) => !e.deletedAt && (e.type ?? 'login') === 'login')

  let hostname = ''
  try { hostname = new URL(url).hostname } catch { /* ignore */ }

  const matches = hostname
    ? all.filter((e) => {
        try { return new URL(e.url).hostname === hostname } catch { return false }
      })
    : []

  return { entries: matches, all }
}

async function addEntry(entry) {
  const key = await getActiveKey()
  if (!key) return { error: 'Vault is locked.' }
  const vault = await getEncryptedVault()
  const data = vault ? await readVaultData(key, vault) : { entries: [], collections: [] }
  const now = Date.now()
  const newEntry = {
    type: 'login',
    favorite: false,
    collectionId: null,
    deletedAt: null,
    ...entry,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  }
  data.entries.push(newEntry)
  await writeVaultData(key, vault?.salt ?? randomSalt(), data, vault)
  return { ok: true, entry: newEntry }
}

async function deleteEntry(id) {
  const key = await getActiveKey()
  if (!key) return { error: 'Vault is locked.' }
  const vault = await getEncryptedVault()
  if (!vault) return { error: 'No vault.' }
  const data = await readVaultData(key, vault)
  data.entries = data.entries.filter((e) => e.id !== id)
  await writeVaultData(key, vault.salt, data, vault)
  return { ok: true }
}

// ─── Passkeys ───────────────────────────────────────────────────────────────────
//
// Passkey credentials (incl. their ES256 private keys) are kept in their own
// encrypted blob, separate from the shared vault, so the web app can't clobber
// them. They're encrypted with the same session-cached vault key.

async function loadPasskeys(key) {
  const { rokoPasskeys } = await chrome.storage.local.get('rokoPasskeys')
  if (!rokoPasskeys) return []
  try {
    return JSON.parse(await decryptData(key, rokoPasskeys.iv, rokoPasskeys.ciphertext))
  } catch {
    return []
  }
}

async function savePasskeys(key, list) {
  const { iv, ciphertext } = await encryptData(key, JSON.stringify(list))
  await chrome.storage.local.set({ rokoPasskeys: { iv, ciphertext } })
}

// A `store` for passkeys.js, bound to the active key.
function passkeyStore(key) {
  return {
    list: () => loadPasskeys(key),
    add: async (cred) => {
      const list = await loadPasskeys(key)
      list.push(cred)
      await savePasskeys(key, list)
    },
    update: async (credentialId, patch) => {
      const list = await loadPasskeys(key)
      const i = list.findIndex((c) => c.credentialId === credentialId)
      if (i >= 0) {
        list[i] = { ...list[i], ...patch }
        await savePasskeys(key, list)
      }
    },
  }
}

// Popup-facing: list stored passkeys (without private keys).
async function getPasskeys() {
  const key = await getActiveKey()
  if (!key) return { error: 'Vault is locked.' }
  const list = await loadPasskeys(key)
  return {
    passkeys: list.map((c) => ({
      credentialId: c.credentialId,
      rpId: c.rpId,
      userName: c.userName,
      userDisplayName: c.userDisplayName,
      createdAt: c.createdAt,
    })),
  }
}

async function deletePasskey(credentialId) {
  const key = await getActiveKey()
  if (!key) return { error: 'Vault is locked.' }
  const list = await loadPasskeys(key)
  await savePasskeys(key, list.filter((c) => c.credentialId !== credentialId))
  return { ok: true }
}

// ─── WebAuthn proxy ─────────────────────────────────────────────────────────────
//
// Becomes the active WebAuthn authenticator for this profile. While attached,
// navigator.credentials.create()/get() on every page is routed here.

if (chrome.webAuthenticationProxy) {
  // Register listeners synchronously so the service worker wakes for requests.
  chrome.webAuthenticationProxy.onCreateRequest.addListener(onCreateRequest)
  chrome.webAuthenticationProxy.onGetRequest.addListener(onGetRequest)
  chrome.webAuthenticationProxy.onIsUvpaaRequest.addListener(onIsUvpaaRequest)
  attachProxy()
  chrome.runtime.onStartup.addListener(attachProxy)
  chrome.runtime.onInstalled.addListener(attachProxy)
}

async function attachProxy() {
  try {
    await chrome.webAuthenticationProxy.attach()
  } catch {
    // Already attached, or another proxy owns it — nothing to do.
  }
}

// The proxy event carries the options JSON but not the page origin; prefer an
// `origin` field if Chrome provides one, else fall back to the focused tab.
async function resolveOrigin(details) {
  if (details && typeof details.origin === 'string') return details.origin
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
    if (tab && tab.url) return new URL(tab.url).origin
  } catch {
    /* ignore */
  }
  return null
}

function completeCreate(requestId, result) {
  const args = { requestId }
  if (result.error) args.error = { name: result.error }
  else args.responseJson = result.responseJson
  chrome.webAuthenticationProxy.completeCreateRequest(args, () => void chrome.runtime.lastError)
}

function completeGet(requestId, result) {
  const args = { requestId }
  if (result.error) args.error = { name: result.error }
  else args.responseJson = result.responseJson
  chrome.webAuthenticationProxy.completeGetRequest(args, () => void chrome.runtime.lastError)
}

async function onCreateRequest(info) {
  const { requestId, requestDetailsJson } = info
  try {
    const key = await getActiveKey()
    if (!key) {
      hintUnlock()
      return completeCreate(requestId, { error: 'NotAllowedError' })
    }
    const details = JSON.parse(requestDetailsJson)
    const origin = await resolveOrigin(details)
    if (!origin) return completeCreate(requestId, { error: 'NotAllowedError' })
    const result = await handleCreate(details, origin, passkeyStore(key))
    completeCreate(requestId, result)
  } catch (err) {
    console.error('Passkey create failed:', err)
    completeCreate(requestId, { error: 'NotAllowedError' })
  }
}

async function onGetRequest(info) {
  const { requestId, requestDetailsJson } = info
  try {
    const key = await getActiveKey()
    if (!key) {
      hintUnlock()
      return completeGet(requestId, { error: 'NotAllowedError' })
    }
    const details = JSON.parse(requestDetailsJson)
    const origin = await resolveOrigin(details)
    if (!origin) return completeGet(requestId, { error: 'NotAllowedError' })
    const result = await handleGet(details, origin, passkeyStore(key))
    completeGet(requestId, result)
  } catch (err) {
    console.error('Passkey get failed:', err)
    completeGet(requestId, { error: 'NotAllowedError' })
  }
}

function onIsUvpaaRequest(info) {
  // We are a user-verifying platform authenticator (the vault password), so long
  // as a vault exists to unlock.
  chrome.webAuthenticationProxy.completeIsUvpaaRequest(
    { requestId: info.requestId, isUvpaa: true },
    () => void chrome.runtime.lastError,
  )
}

// Nudge the user to unlock when a passkey request arrives on a locked vault.
function hintUnlock() {
  try {
    chrome.action.setBadgeText({ text: '🔒' })
    chrome.action.setBadgeBackgroundColor({ color: '#7c3aed' })
  } catch {
    /* ignore */
  }
}
