/**
 * Roko extension — background service worker (Manifest V3).
 *
 * Responsibilities:
 *  - Store the encrypted vault in chrome.storage.local
 *  - Cache the unlocked AES key in chrome.storage.session (cleared when browser closes)
 *  - Handle messages from popup and content scripts
 */

import { deriveKey, decryptData, encryptData, exportKey, importRawKey, randomSalt } from './crypto.js'

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

async function readEntries(key, vault) {
  const plaintext = await decryptData(key, vault.iv, vault.ciphertext)
  return JSON.parse(plaintext)
}

async function writeEntries(key, salt, entries) {
  const { iv, ciphertext } = await encryptData(key, JSON.stringify(entries))
  await saveEncryptedVault({ version: 1, salt, iv, ciphertext })
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
  await writeEntries(key, salt, [])
  await setActiveKey(key)
  return { ok: true }
}

async function getEntries() {
  const key = await getActiveKey()
  if (!key) return { error: 'Vault is locked.' }
  const vault = await getEncryptedVault()
  if (!vault) return { entries: [] }
  const entries = await readEntries(key, vault)
  return { entries }
}

async function getEntriesForUrl(url) {
  const key = await getActiveKey()
  if (!key) return { error: 'Vault is locked.' }
  const vault = await getEncryptedVault()
  if (!vault) return { entries: [] }
  const all = await readEntries(key, vault)

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
  const entries = vault ? await readEntries(key, vault) : []
  const newEntry = {
    ...entry,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  entries.push(newEntry)
  await writeEntries(key, vault?.salt ?? randomSalt(), entries)
  return { ok: true, entry: newEntry }
}

async function deleteEntry(id) {
  const key = await getActiveKey()
  if (!key) return { error: 'Vault is locked.' }
  const vault = await getEncryptedVault()
  if (!vault) return { error: 'No vault.' }
  const entries = await readEntries(key, vault)
  const filtered = entries.filter((e) => e.id !== id)
  await writeEntries(key, vault.salt, filtered)
  return { ok: true }
}
