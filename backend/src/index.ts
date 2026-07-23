import express, { type ErrorRequestHandler } from 'express'
import cors from 'cors'
import { PROCESSED_DIR, UPLOAD_DIR } from './store.js'
import { drawingsRouter, rateMasterRouter } from './routes/drawings.js'
import { configuratorRouter } from './configurator/routes.js'
import { adminRouter } from './configurator/admin.js'
import { seedIfEmpty } from './configurator/seed.js'

seedIfEmpty()

const app = express()
const PORT = process.env.PORT ? Number(process.env.PORT) : 8787

app.use(cors())
app.use(express.json())
app.use('/uploads', express.static(UPLOAD_DIR))
app.use('/processed', express.static(PROCESSED_DIR))

app.use('/api/drawings', drawingsRouter)
app.use('/api/rate-master', rateMasterRouter)
app.use('/api/configurator', configuratorRouter)
app.use('/api/configurator/admin', adminRouter)

app.get('/api/health', (_req, res) => res.json({ ok: true }))

// Final safety net: every route handler is wrapped so its errors land here
// instead of crashing the process (one bad request previously took down the
// whole server for every user — see asyncHandler in routes/drawings.ts).
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' })
}
app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`Drawing recognition engine listening on http://localhost:${PORT}`)
})
