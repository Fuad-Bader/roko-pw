/**
 * Roko extension — popup script.
 * Communicates with background.js via chrome.runtime.sendMessage.
 */

// ─── DOM references ───────────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id)
const screens = {
  loading: $('loading-screen'),
  unlock: $('unlock-screen'),
  vault: $('vault-screen'),
  add: $('add-panel'),
}

// ─── Screen management ────────────────────────────────────────────────────────

function showScreen(name) {
  Object.values(screens).forEach((el) => { el.style.display = 'none' })
  screens[name].style.display = 'block'
  $('lock-btn').style.display = name === 'vault' || name === 'add' ? 'block' : 'none'
}

// ─── Message helper ───────────────────────────────────────────────────────────

async function msg(payload) {
  return chrome.runtime.sendMessage(payload)
}

// ─── Clipboard helper ─────────────────────────────────────────────────────────

async function copyText(text) {
  await navigator.clipboard.writeText(text)
  const toast = $('copied-toast')
  toast.style.display = 'block'
  setTimeout(() => { toast.style.display = 'none' }, 1500)
}

// ─── Error display ────────────────────────────────────────────────────────────

function showError(id, text) {
  const el = $(id)
  el.textContent = text
  el.style.display = text ? 'block' : 'none'
}

// ─── Entry rendering ──────────────────────────────────────────────────────────

let allEntries = []
let currentTabUrl = ''

async function loadAndRender() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  currentTabUrl = tabs[0]?.url ?? ''

  const res = await msg({ type: 'GET_ENTRIES_FOR_URL', url: currentTabUrl })
  if (res.error) { showScreen('unlock'); return }

  allEntries = res.all ?? []
  renderEntries(res.entries?.length > 0 ? res.entries : allEntries, res.entries?.length > 0)
  showScreen('vault')
}

function renderEntries(entries, isFiltered) {
  const list = $('entries-list')
  const heading = $('list-heading')
  const empty = $('empty-state')

  heading.textContent = isFiltered
    ? `Matches for ${getDomain(currentTabUrl)}`
    : 'All credentials'

  list.innerHTML = ''

  if (entries.length === 0) {
    empty.style.display = 'block'
    return
  }
  empty.style.display = 'none'

  for (const entry of entries) {
    const card = document.createElement('div')
    card.className = 'entry-card'
    card.innerHTML = `
      <div class="entry-title">${escapeHtml(entry.title)}</div>
      <div class="entry-username">${escapeHtml(entry.username)}</div>
      <div class="entry-actions">
        <button class="fill-btn" data-id="${entry.id}">Fill ↗</button>
        <button class="copy-user-btn" data-username="${escapeHtml(entry.username)}">Copy user</button>
        <button class="copy-pass-btn" data-password="${escapeHtml(entry.password)}">Copy pwd</button>
        <button class="del-btn" data-id="${entry.id}">🗑</button>
      </div>
    `
    list.appendChild(card)
  }

  // Event delegation
  list.onclick = async (e) => {
    const btn = e.target.closest('button')
    if (!btn) return

    if (btn.classList.contains('fill-btn')) {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tabs[0]) {
        const entry = allEntries.find((en) => en.id === btn.dataset.id)
        if (entry) {
          await chrome.tabs.sendMessage(tabs[0].id, { type: 'FILL_FORM', entry })
          window.close()
        }
      }
    } else if (btn.classList.contains('copy-user-btn')) {
      await copyText(btn.dataset.username)
    } else if (btn.classList.contains('copy-pass-btn')) {
      await copyText(btn.dataset.password)
    } else if (btn.classList.contains('del-btn')) {
      if (btn.dataset.confirmed) {
        await msg({ type: 'DELETE_ENTRY', id: btn.dataset.id })
        await loadAndRender()
      } else {
        btn.dataset.confirmed = '1'
        btn.textContent = '✓?'
        setTimeout(() => { delete btn.dataset.confirmed; btn.textContent = '🗑' }, 2500)
      }
    }
  }
}

// ─── Search ───────────────────────────────────────────────────────────────────

$('search-input').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase()
  if (!q) { renderEntries(allEntries, false); return }
  const filtered = allEntries.filter(
    (en) =>
      en.title.toLowerCase().includes(q) ||
      en.username.toLowerCase().includes(q) ||
      (en.url ?? '').toLowerCase().includes(q),
  )
  renderEntries(filtered, false)
})

// ─── Unlock ───────────────────────────────────────────────────────────────────

let unlockMode = 'unlock' // or 'create'

function setUnlockMode(mode) {
  unlockMode = mode
  $('unlock-form').style.display = mode === 'unlock' ? 'block' : 'none'
  $('create-form').style.display = mode === 'create' ? 'block' : 'none'
  $('toggle-mode').textContent =
    mode === 'unlock' ? 'Create a new vault instead' : 'I already have a vault'
  showError('unlock-error', '')
  showError('create-error', '')
}

$('toggle-mode').addEventListener('click', () => {
  setUnlockMode(unlockMode === 'unlock' ? 'create' : 'unlock')
})

$('unlock-submit').addEventListener('click', async () => {
  const pw = $('unlock-password').value
  if (!pw) return
  $('unlock-submit').disabled = true
  $('unlock-submit').textContent = 'Unlocking…'
  const res = await msg({ type: 'UNLOCK', password: pw })
  $('unlock-submit').disabled = false
  $('unlock-submit').textContent = 'Unlock'
  if (res.error) { showError('unlock-error', res.error); return }
  $('unlock-password').value = ''
  await loadAndRender()
})

$('unlock-password').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('unlock-submit').click()
})

$('create-submit').addEventListener('click', async () => {
  const pw = $('create-password').value
  const confirm = $('create-confirm').value
  if (pw.length < 8) { showError('create-error', 'Password must be at least 8 characters.'); return }
  if (pw !== confirm) { showError('create-error', 'Passwords do not match.'); return }
  $('create-submit').disabled = true
  $('create-submit').textContent = 'Creating…'
  const res = await msg({ type: 'CREATE_VAULT', password: pw })
  $('create-submit').disabled = false
  $('create-submit').textContent = 'Create vault'
  if (res.error) { showError('create-error', res.error); return }
  $('create-password').value = ''
  $('create-confirm').value = ''
  await loadAndRender()
})

// ─── Lock ─────────────────────────────────────────────────────────────────────

$('lock-btn').addEventListener('click', async () => {
  await msg({ type: 'LOCK' })
  showScreen('unlock')
})

// ─── Add credential ───────────────────────────────────────────────────────────

$('add-btn').addEventListener('click', () => {
  $('add-url').value = currentTabUrl
  showScreen('add')
})

$('add-cancel').addEventListener('click', () => { showScreen('vault') })

$('add-save').addEventListener('click', async () => {
  const title = $('add-title').value.trim()
  const url = $('add-url').value.trim()
  const username = $('add-username').value.trim()
  const password = $('add-password').value

  if (!title) { showError('add-error', 'Title is required.'); return }
  if (!username) { showError('add-error', 'Username is required.'); return }
  if (!password) { showError('add-error', 'Password is required.'); return }

  $('add-save').disabled = true
  $('add-save').textContent = 'Saving…'
  const res = await msg({ type: 'ADD_ENTRY', entry: { title, url, username, password, notes: '' } })
  $('add-save').disabled = false
  $('add-save').textContent = 'Save'

  if (res.error) { showError('add-error', res.error); return }
  $('add-title').value = ''
  $('add-url').value = ''
  $('add-username').value = ''
  $('add-password').value = ''
  showError('add-error', '')
  await loadAndRender()
})

// ─── Content script "FILL_FORM" relay ─────────────────────────────────────────
// Content scripts cannot message background directly for fill — we relay from popup.
// (Actually content.js messages background directly; this is a safety net.)

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  showScreen('loading')
  const status = await msg({ type: 'VAULT_STATUS' })

  if (!status.hasVault) {
    setUnlockMode('create')
    showScreen('unlock')
    return
  }
  if (status.locked) {
    setUnlockMode('unlock')
    showScreen('unlock')
    return
  }
  await loadAndRender()
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDomain(url) {
  try { return new URL(url).hostname } catch { return url }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c])
}

init()
