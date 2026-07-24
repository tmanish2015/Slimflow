import { useState } from 'react'
import { authApi } from '~/lib/authApi'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Button } from '~/components/ui/button'

export function LoginPage({ needsSetup, onLoggedIn }: { needsSetup: boolean; onLoggedIn: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (needsSetup) {
        await authApi.setup(username, password)
      } else {
        await authApi.login(username, password)
      }
      onLoggedIn()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{needsSetup ? 'Set up Slimflow' : 'Sign in to Slimflow'}</CardTitle>
        </CardHeader>
        <CardContent>
          {needsSetup && (
            <p className="mb-4 text-sm text-muted-foreground">
              Everything in this app lives only on this device. Choose a username and password to lock the
              app — there's no account recovery, so keep it somewhere safe.
            </p>
          )}
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="username">Username</Label>
              <Input id="username" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={submitting || !username || !password} className="mt-1">
              {submitting ? (needsSetup ? 'Setting up…' : 'Signing in…') : needsSetup ? 'Create password' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
