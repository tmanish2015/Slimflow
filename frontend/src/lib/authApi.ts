const BASE = '/api/auth'

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const authApi = {
  me() {
    return fetch(`${BASE}/me`).then((r) => json<{ authenticated: boolean }>(r))
  },
  login(username: string, password: string) {
    return fetch(`${BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }).then((r) => json<{ ok: true }>(r))
  },
  logout() {
    return fetch(`${BASE}/logout`, { method: 'POST' }).then((r) => json<{ ok: true }>(r))
  },
}
