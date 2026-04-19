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
    btn.textContent = '🔐'
    btn.style.cssText = [
      'position:absolute',
      'right:6px',
      'top:50%',
      'transform:translateY(-50%)',
      'background:none',
      'border:none',
      'cursor:pointer',
      'font-size:14px',
      'line-height:1',
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
      showToast(response.error === 'Vault is locked.' ? '🔒 Unlock Roko first' : response.error, 'error')
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
      `background:#18181b`,
      `border:1px solid #3f3f46`,
      `border-radius:10px`,
      `box-shadow:0 8px 32px rgba(0,0,0,0.5)`,
      `padding:8px`,
      `min-width:240px`,
      `font-family:system-ui,sans-serif`,
      `font-size:13px`,
    ].join(';')

    const header = document.createElement('p')
    header.textContent = '🔐 Choose credential'
    header.style.cssText = 'color:#71717a;margin:0 0 6px 0;font-size:11px;font-weight:500'
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
        'border-radius:6px',
        'color:#e4e4e7',
      ].join(';')
      btn.innerHTML = `<strong>${escapeHtml(entry.title)}</strong><br><span style="color:#71717a">${escapeHtml(entry.username)}</span>`
      btn.addEventListener('mouseenter', () => { btn.style.background = '#27272a' })
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

    const colors = { success: '#16a34a', error: '#dc2626', info: '#4f46e5' }
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
      'border-radius:8px',
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
