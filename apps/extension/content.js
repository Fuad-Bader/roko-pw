/**
 * Roko extension — content script.
 * Detects login forms and injects autofill buttons next to password fields.
 */

;(function () {
  'use strict'

  const BUTTON_ID = 'roko-autofill-btn'

  // ─── Detect and annotate password fields ──────────────────────────────────

  function findPasswordFields() {
    return Array.from(document.querySelectorAll('input[type="password"]:not([data-roko-injected])'))
  }

  function injectAutofillButton(pwField) {
    pwField.dataset.rokoInjected = '1'

    // Make sure the field's parent is relatively positioned
    const parent = pwField.parentElement
    if (!parent) return
    if (getComputedStyle(parent).position === 'static') {
      parent.style.position = 'relative'
    }

    const btn = document.createElement('button')
    btn.type = 'button'
    btn.id = BUTTON_ID
    btn.title = 'Roko: autofill password'
    // Roko mark (inline SVG) instead of an emoji.
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="16" fill="#0E1116"/><path d="M20 43V33a12 12 0 0 1 12-12h2" fill="none" stroke-width="8" stroke-linecap="round" stroke="#F7F5F0"/><rect x="39" y="37" width="10" height="10" rx="1.5" fill="#FF5A1F"/></svg>'
    btn.style.cssText = [
      'position:absolute',
      'right:6px',
      'top:50%',
      'transform:translateY(-50%)',
      'background:none',
      'border:none',
      'cursor:pointer',
      'padding:0',
      'display:flex',
      'line-height:0',
      'z-index:9999',
      'opacity:0.7',
      'transition:opacity 0.15s',
    ].join(';')
    btn.addEventListener('mouseenter', () => { btn.style.opacity = '1' })
    btn.addEventListener('mouseleave', () => { btn.style.opacity = '0.7' })
    btn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      handleAutofill(pwField)
    })

    parent.appendChild(btn)
  }

  // ─── Autofill handler ─────────────────────────────────────────────────────

  async function handleAutofill(pwField) {
    const response = await chrome.runtime.sendMessage({
      type: 'AUTOFILL_REQUEST',
      url: window.location.href,
    })

    if (response.error) {
      showToast(response.error === 'Vault is locked.' ? 'Unlock Roko first' : response.error, 'error')
      return
    }

    const matches = response.entries ?? []
    const all = response.all ?? []

    if (matches.length === 0 && all.length === 0) {
      showToast('No credentials found for this site', 'info')
      return
    }

    const entries = matches.length > 0 ? matches : all
    if (entries.length === 1) {
      fillForm(pwField, entries[0])
    } else {
      showPicker(pwField, entries)
    }
  }

  function fillForm(pwField, entry) {
    // Try to fill username in a preceding input field
    const form = pwField.closest('form')
    if (form) {
      const usernameField = form.querySelector(
        'input[type="email"], input[type="text"], input[autocomplete="username"], input[name*="user"], input[name*="email"]',
      )
      if (usernameField) {
        setNativeInputValue(usernameField, entry.username)
      }
    }
    setNativeInputValue(pwField, entry.password)
    showToast(`Filled: ${entry.title}`, 'success')
  }

  /** Trigger React/Vue controlled input synthetic events. */
  function setNativeInputValue(input, value) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    if (nativeInputValueSetter) nativeInputValueSetter.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }

  // ─── Credential picker (multiple matches) ─────────────────────────────────

  function showPicker(pwField, entries) {
    const existing = document.getElementById('roko-picker')
    if (existing) existing.remove()

    const rect = pwField.getBoundingClientRect()
    const picker = document.createElement('div')
    picker.id = 'roko-picker'
    picker.style.cssText = [
      `position:fixed`,
      `top:${rect.bottom + window.scrollY + 4}px`,
      `left:${rect.left + window.scrollX}px`,
      `z-index:2147483647`,
      `background:#0E1116`,
      `border:1px solid #252B35`,
      `border-radius:14px`,
      `box-shadow:0 8px 32px rgba(0,0,0,0.5)`,
      `padding:8px`,
      `min-width:240px`,
      `font-family:system-ui,sans-serif`,
      `font-size:13px`,
    ].join(';')

    const header = document.createElement('p')
    header.textContent = 'Roko · choose credential'
    header.style.cssText = 'color:#FF7A45;margin:2px 4px 8px;font:500 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:0.12em;text-transform:uppercase'
    picker.appendChild(header)

    for (const entry of entries) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.style.cssText = [
        'display:block',
        'width:100%',
        'text-align:left',
        'background:none',
        'border:none',
        'cursor:pointer',
        'padding:7px 10px',
        'border-radius:10px',
        'color:#F7F5F0',
      ].join(';')
      btn.innerHTML = `<strong>${escapeHtml(entry.title)}</strong><br><span style="color:#7A8391">${escapeHtml(entry.username)}</span>`
      btn.addEventListener('mouseenter', () => { btn.style.background = '#171B22' })
      btn.addEventListener('mouseleave', () => { btn.style.background = 'none' })
      btn.addEventListener('click', () => {
        fillForm(pwField, entry)
        picker.remove()
      })
      picker.appendChild(btn)
    }

    document.body.appendChild(picker)
    // Close on outside click
    setTimeout(() => {
      document.addEventListener('click', function close(e) {
        if (!picker.contains(e.target)) { picker.remove(); document.removeEventListener('click', close) }
      })
    }, 0)
  }

  // ─── Toast notification ───────────────────────────────────────────────────

  function showToast(message, type = 'info') {
    const existing = document.getElementById('roko-toast')
    if (existing) existing.remove()

    // Roko palette: circuit for success, ink for info (white on ember fails contrast)
    const colors = { success: '#0B857A', error: '#dc2626', info: '#0E1116' }
    const toast = document.createElement('div')
    toast.id = 'roko-toast'
    toast.textContent = message
    toast.style.cssText = [
      'position:fixed',
      'bottom:20px',
      'right:20px',
      'z-index:2147483647',
      `background:${colors[type] ?? colors.info}`,
      'color:#fff',
      'padding:10px 16px',
      'border-radius:999px',
      'border-left:3px solid #FF5A1F',
      'font-family:system-ui,sans-serif',
      'font-size:13px',
      'font-weight:500',
      'box-shadow:0 4px 12px rgba(0,0,0,0.3)',
      'transition:opacity 0.3s',
    ].join(';')
    document.body.appendChild(toast)
    setTimeout(() => {
      toast.style.opacity = '0'
      setTimeout(() => toast.remove(), 300)
    }, 2500)
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
  }

  // ─── Observe DOM for dynamically added password fields ────────────────────

  function scanAndInject() {
    findPasswordFields().forEach(injectAutofillButton)
  }

  scanAndInject()

  const observer = new MutationObserver(() => scanAndInject())
  observer.observe(document.body, { childList: true, subtree: true })
})()
