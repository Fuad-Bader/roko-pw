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
- **Passkeys**: The extension registers as a WebAuthn authenticator via the
  `chrome.webAuthenticationProxy` API. While the vault is unlocked, websites that
  call `navigator.credentials.create()` / `.get()` are served by RokoPW: it
  generates an ES256 passkey, stores it (private key included) in a separate
  encrypted blob, and signs assertions. Stored passkeys are listed in the popup.

## Passkeys — requirements & limitations

- **Chrome / Edge 115+** only — `chrome.webAuthenticationProxy` is Chromium-only
  (no Firefox/Safari). Load the extension unpacked as above.
- Only **one** WebAuthn proxy can be attached per profile. If another remote-desktop
  or passkey extension is attached, RokoPW won't receive requests.
- The vault must be **unlocked** for a passkey to be created or used. If it's locked
  when a site requests a passkey, the request fails and the toolbar icon shows a 🔒
  badge — open the popup, unlock, and retry on the site.
- Attestation is `"none"` and credentials are ES256 (`-7`) only — the algorithms
  virtually all relying parties accept.
- The requesting origin is read from the proxy event when present, otherwise from
  the focused tab — so passkey ceremonies inside cross-origin iframes may not get
  the correct origin.

## Icons

Place `icons/icon16.png`, `icons/icon48.png`, and `icons/icon128.png` in the
`extension/` directory to replace the default placeholder icons.
