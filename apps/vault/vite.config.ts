import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

const at = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  base: '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    // Shared packages are TypeScript source in packages/*/src.
    alias: [
      { find: '@roko/ui', replacement: at('../../packages/ui/src') },
      { find: '@roko/vault-core', replacement: at('../../packages/vault-core/src') },
    ],
    dedupe: ['react', 'react-dom'],
  },
  server: { port: 3001, strictPort: true },
  preview: { port: 3001, strictPort: true },
})
