import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { initDb } from './db/engine'

const root = createRoot(document.getElementById('root')!)

// The whole app is one sql.js database loaded from IndexedDB (or created
// fresh on first run) — nothing renders until it's ready, since every page
// queries it synchronously once mounted.
initDb()
  .then(() => {
    root.render(
      <StrictMode>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </StrictMode>,
    )
  })
  .catch((err) => {
    root.render(
      <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
        <h1>Failed to start</h1>
        <pre>{err instanceof Error ? err.message : String(err)}</pre>
      </div>,
    )
  })
