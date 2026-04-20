import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: { '@/lib': resolve('../lib') },
    },
    build: {
      rollupOptions: {
        output: {
          format: 'cjs',
          entryFileNames: '[name].js',
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: { '@/lib': resolve('../lib') },
    },
    build: {
      rollupOptions: {
        output: {
          format: 'cjs',
          entryFileNames: '[name].js',
        },
      },
    },
  },
  renderer: {
    resolve: {
      alias: [
        // Override storage to use Electron IPC — must come before the generic @/lib alias
        {
          find: '@/lib/storage',
          replacement: resolve('./src/renderer/src/lib/storage.ts'),
        },
        { find: '@/lib', replacement: resolve('../lib') },
        { find: '@/', replacement: resolve('../') },
        // Resolve app components from the Next.js app directory
        { find: '@components', replacement: resolve('../app/components') },
      ],
    },
    plugins: [react(), tailwindcss()],
  },
})
