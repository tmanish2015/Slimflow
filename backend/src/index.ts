import express from 'express'
import cors from 'cors'
import { PROCESSED_DIR, UPLOAD_DIR } from './store.js'
import { drawingsRouter, rateMasterRouter } from './routes/drawings.js'

const app = express()
const PORT = process.env.PORT ? Number(process.env.PORT) : 8787

app.use(cors())
app.use(express.json())
app.use('/uploads', express.static(UPLOAD_DIR))
app.use('/processed', express.static(PROCESSED_DIR))

app.use('/api/drawings', drawingsRouter)
app.use('/api/rate-master', rateMasterRouter)

app.get('/api/health', (_req, res) => res.json({ ok: true }))

app.listen(PORT, () => {
  console.log(`Drawing recognition engine listening on http://localhost:${PORT}`)
})
