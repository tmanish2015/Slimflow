import { randomBytes, timingSafeEqual } from 'node:crypto'
import { Router, type NextFunction, type Request, type Response } from 'express'
import { parseCookie, stringifySetCookie } from 'cookie'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { asyncHandler } from './asyncHandler.js'

const SESSION_COOKIE = 'slimflow_session'
const SESSION_TTL_MS = 12 * 60 * 60 * 1000 // 12h

// Single shared admin login (no multi-user accounts yet — see
// frontend/src/modules/auth/README.md for the eventual per-tenant scope).
// Sessions are an in-memory Set of opaque random tokens: simplest correct
// option for a single-process gate — a restart just logs everyone out,
// which is fine at this scope. The token itself carries no data (never
// decoded), so it needs no signing, only sufficient randomness.
const sessions = new Map<string, number>() // token -> expiresAt

function createSession(): string {
  const token = randomBytes(32).toString('hex')
  sessions.set(token, Date.now() + SESSION_TTL_MS)
  return token
}

function isValidSession(token: string | undefined): boolean {
  if (!token) return false
  const expiresAt = sessions.get(token)
  if (!expiresAt) return false
  if (expiresAt < Date.now()) {
    sessions.delete(token)
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
  if (!isValidSession(cookies[SESSION_COOKIE])) {
    res.status(401).json({ error: 'Not authenticated' })
    return
  }
  next()
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

    const token = createSession()
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
    if (token) sessions.delete(token)
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
    res.json({ authenticated: isValidSession(cookies[SESSION_COOKIE]) })
  }),
)
