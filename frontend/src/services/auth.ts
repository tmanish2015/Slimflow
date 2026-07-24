import bcrypt from 'bcryptjs'
import { queryOne, run } from '../db/engine'

// Single shared admin login, entirely local — no server, no cookies. The
// hash lives in the local sql.js database (app_config table) instead of a
// server .env file, since there's no server to hold one. A plain localStorage
// timestamp stands in for the old session cookie: this is a single device
// with no network boundary to defend, so there's no remote timing attack to
// guard against the way the old cookie-based version's constant-time compare
// did — an attacker with code execution on this device can already read the
// database directly.
const SESSION_KEY = 'slimflow_session_expires_at'
const SESSION_TTL_MS = 12 * 60 * 60 * 1000 // 12h

async function getConfig(key: string): Promise<string | null> {
  const row = await queryOne<{ value: string }>('SELECT value FROM app_config WHERE key = ?', [key])
  return row?.value ?? null
}

function setConfig(key: string, value: string): void {
  run(`INSERT INTO app_config (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value`, [key, value])
}

function createSession(): void {
  localStorage.setItem(SESSION_KEY, String(Date.now() + SESSION_TTL_MS))
}

/** True until an admin account has ever been created on this device —
 * drives the LoginPage's "create your password" first-run flow. */
export async function needsSetup(): Promise<boolean> {
  return (await getConfig('admin_username')) === null
}

export async function setup(username: string, password: string): Promise<void> {
  if (!username || !password) throw new Error('Username and password required')
  const hash = await bcrypt.hash(password, 10)
  setConfig('admin_username', username)
  setConfig('admin_password_hash', hash)
  createSession()
}

export async function login(username: string, password: string): Promise<void> {
  const adminUsername = await getConfig('admin_username')
  const adminHash = await getConfig('admin_password_hash')
  const usernameOk = !!adminUsername && username === adminUsername
  const passwordOk = !!adminHash && (await bcrypt.compare(password, adminHash))
  if (!usernameOk || !passwordOk) throw new Error('Invalid username or password')
  createSession()
}

export function logout(): void {
  localStorage.removeItem(SESSION_KEY)
}

export function isAuthenticated(): boolean {
  const raw = localStorage.getItem(SESSION_KEY)
  if (!raw) return false
  const expiresAt = Number(raw)
  if (!expiresAt || expiresAt < Date.now()) {
    localStorage.removeItem(SESSION_KEY)
    return false
  }
  return true
}
