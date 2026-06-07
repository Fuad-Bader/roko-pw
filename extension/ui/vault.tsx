import './globals.css'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { VaultApp } from './VaultApp'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <VaultApp />
  </React.StrictMode>,
)
