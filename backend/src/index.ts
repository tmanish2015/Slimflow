import './loadEnv.js'

import express, { type ErrorRequestHandler } from 'express'
import cors from 'cors'
import { drawingsRouter, processedRouter, rateMasterRouter } from './routes/drawings.js'
import { configuratorRouter } from './configurator/routes.js'
import { adminRouter } from './configurator/admin.js'
import { authRouter, requireAuth } from './auth.js'

const app = express()
const PORT = process.env.PORT ? Number(process.env.PORT) : 8787

app.use(cors())
app.use(express.json())

app.use('/api/auth', authRouter)

// Uploaded originals + OCR preview PNGs live in Supabase Storage now, not
// local disk — /processed proxies the download through (see
// routes/drawings.ts); the raw original is only ever read server-side by
// processDrawing, so there's no equivalent /uploads route to keep.
app.use('/processed', requireAuth, processedRouter)

app.use('/api/drawings', requireAuth, drawingsRouter)
app.use('/api/rate-master', requireAuth, rateMasterRouter)
app.use('/api/configurator', requireAuth, configuratorRouter)
app.use('/api/configurator/admin', requireAuth, adminRouter)

app.get('/api/health', (_req, res) => res.json({ ok: true }))

// Final safety net: every route handler is wrapped so its errors land here
// instead of crashing the process (one bad request previously took down the
// whole server for every user — see asyncHandler in routes/drawings.ts).
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' })
}
app.use(errorHandler)

// Vercel's Node runtime imports this module for its (req, res) handler and
// never calls listen() itself — only bind a real port for local dev.
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Drawing recognition engine listening on http://localhost:${PORT}`)
  })
}

export default app
