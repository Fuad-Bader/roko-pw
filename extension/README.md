# LilaCrypt – Browser Extension

The extension reuses the web app's React vault UI (the same
`VaultProvider` / `VaultDashboard` / `UnlockScreen` components), bundled with
Vite. It ships two pages:

- **`popup.html`** — the toolbar popup: quick unlock + autofill matches for the
  current tab + passkeys + an "Open full vault" button.
- **`vault.html`** — the full dashboard (opened in a tab): every feature the web
  app has — login/card/note items, collections, favorites, trash, password
  generator, recovery phrase, change master password, file import/export, and
  server sync (login/OTP, remote vaults, upload, invites).

The autofill background worker stays vanilla; it reads the encrypted vault from
`chrome.storage.local` (`rokoVault`) and the unlocked key from
`chrome.storage.session` (`rokoKey`), which the UI hands off after unlock.

## Build

The extension must be **built** before loading — you load `extension/dist`, not
the source folder.

```bash
npm run build:extension     # → extension/dist
# or, while iterating on the UI:
npm run dev:extension        # Vite dev server for the UI pages
```

`npm run build:extension` bundles the two pages and copies the static MV3 files
(`manifest.json`, `background.js`, `content.js`, `crypto.js`, `passkeys.js`)
into `extension/dist`.

## Loading in Chrome / Edge

1. Run `npm run build:extension`.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the **`extension/dist`** folder.

> Firefox isn't supported: the passkey feature relies on
> `chrome.webAuthenticationProxy`, which is Chromium-only.

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
  call `navigator.credentials.create()` / `.get()` are served by LilaCrypt: it
  generates an ES256 passkey, stores it (private key included) in a separate
  encrypted blob, and signs assertions. Stored passkeys are listed in the popup.

## Passkeys — requirements & limitations

- **Chrome / Edge 115+** only — `chrome.webAuthenticationProxy` is Chromium-only
  (no Firefox/Safari). Load the extension unpacked as above.
- Only **one** WebAuthn proxy can be attached per profile. If another remote-desktop
  or passkey extension is attached, LilaCrypt won't receive requests.
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
