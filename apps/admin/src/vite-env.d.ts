/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Org server to manage. Defaults to the origin the console is served from. */
  readonly VITE_ORG_SERVER?: string
}
