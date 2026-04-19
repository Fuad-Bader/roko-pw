# Roko – Browser Extension

## Loading in Chrome / Edge (development)

1. Open `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select the `extension/` folder.

## Loading in Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…** and select `extension/manifest.json`.

## How it works

- **Crypto**: AES-256-GCM encryption via the Web Crypto API. The master password is
  never stored — only a derived key is cached in `chrome.storage.session` for the
  duration of the browser session.
- **Storage**: The encrypted vault blob is stored in `chrome.storage.local`.
- **Autofill**: The content script detects `input[type="password"]` fields and injects
  a 🔐 button. Clicking it queries the background service worker for matching
  credentials (matched by hostname) and fills the form.

## Icons

Place `icons/icon16.png`, `icons/icon48.png`, and `icons/icon128.png` in the
`extension/` directory to replace the default placeholder icons.
