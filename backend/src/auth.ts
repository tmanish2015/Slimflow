import { randomBytes, timingSafeEqual } from 'node:crypto'
import { Router, type NextFunction, type Request, type Response } from 'express'
import { parseCookie, stringifySetCookie } from 'cookie'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { asyncHandler } from './asyncHandler.js'
import { query, queryOne } from './configurator/db.js'

const SESSION_COOKIE = 'slimflow_session'
const SESSION_TTL_MS = 12 * 60 * 60 * 1000 // 12h

// Single shared admin login (no multi-user accounts yet — see
// frontend/src/modules/auth/README.md for the eventual per-tenant scope).
// Sessions live in Postgres, not an in-memory Map — a serverless function
// may route consecutive requests to different container instances, so
// in-process state doesn't survive between them. The token itself carries
// no data (never decoded), so it needs no signing, only sufficient
// randomness.
async function createSession(): Promise<string> {
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  await query('INSERT INTO sessions (token, expires_at) VALUES ($1, $2)', [token, expiresAt])
  return token
}

async function isValidSession(token: string | undefined): Promise<boolean> {
  if (!token) return false
  const row = await queryOne<{ expires_at: string }>('SELECT expires_at FROM sessions WHERE token = $1', [token])
  if (!row) return false
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await query('DELETE FROM sessions WHERE token = $1', [token])
    return false
  }
  return true
}

/** Constant-time string compare — a plain `===` on the username leaks
 * length/prefix timing, which matters here since this is the whole
 * authorization boundary for the app. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const cookies = parseCookie(req.headers.cookie ?? '')
  isValidSession(cookies[SESSION_COOKIE])
    .then((valid) => {
      if (!valid) {
        res.status(401).json({ error: 'Not authenticated' })
        return
      }
      next()
    })
    .catch(next)
}

const loginSchema = z.object({
  username: z.string(),
  password: z.string(),
})

export const authRouter = Router()

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Username and password required' })
      return
    }
    const { username, password } = parsed.data

    const adminUsername = process.env.ADMIN_USERNAME ?? ''
    const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH ?? ''
    const usernameOk = adminUsername.length > 0 && safeEqual(username, adminUsername)
    const passwordOk = adminPasswordHash.length > 0 && (await bcrypt.compare(password, adminPasswordHash))

    if (!usernameOk || !passwordOk) {
      res.status(401).json({ error: 'Invalid username or password' })
      return
    }

    const token = await createSession()
    res.setHeader(
      'Set-Cookie',
      stringifySetCookie({
        name: SESSION_COOKIE,
        value: token,
        httpOnly: true,
        sameSite: 'lax',
        maxAge: SESSION_TTL_MS / 1000,
        path: '/',
      }),
    )
    res.json({ ok: true })
  }),
)

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const cookies = parseCookie(req.headers.cookie ?? '')
    const token = cookies[SESSION_COOKIE]
    if (token) await query('DELETE FROM sessions WHERE token = $1', [token])
    res.setHeader(
      'Set-Cookie',
      stringifySetCookie({ name: SESSION_COOKIE, value: '', httpOnly: true, path: '/', maxAge: 0 }),
    )
    res.json({ ok: true })
  }),
)

authRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    const cookies = parseCookie(req.headers.cookie ?? '')
    res.json({ authenticated: await isValidSession(cookies[SESSION_COOKIE]) })
  }),
)
