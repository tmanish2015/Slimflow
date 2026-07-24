import * as auth from '~/services/auth'

export const authApi = {
  async me(): Promise<{ authenticated: boolean; needsSetup: boolean }> {
    return { authenticated: auth.isAuthenticated(), needsSetup: await auth.needsSetup() }
  },
  async login(username: string, password: string): Promise<{ ok: true }> {
    await auth.login(username, password)
    return { ok: true }
  },
  async setup(username: string, password: string): Promise<{ ok: true }> {
    await auth.setup(username, password)
    return { ok: true }
  },
  async logout(): Promise<{ ok: true }> {
    auth.logout()
    return { ok: true }
  },
}
