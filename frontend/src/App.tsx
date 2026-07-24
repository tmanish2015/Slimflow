import { useEffect, useState } from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { LogOut, Moon, Sun, Upload, Wrench, LayoutDashboard, Database, Banknote } from 'lucide-react'
import { UploadPage } from '~/pages/UploadPage'
import { ReviewPage } from '~/pages/ReviewPage'
import { RatesPage } from '~/pages/RatesPage'
import { ConfiguratorPage } from '~/pages/ConfiguratorPage'
import { AdminPage } from '~/pages/AdminPage'
import { DashboardPage } from '~/pages/DashboardPage'
import { LoginPage } from '~/pages/LoginPage'
import { Button } from '~/components/ui/button'
import { authApi } from '~/lib/authApi'
import { cn } from '~/lib/utils'

const NAV_ITEMS = [
  { to: '/', label: 'Upload', icon: Upload },
  { to: '/configurator', label: 'Configurator', icon: Wrench },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin', label: 'Admin', icon: Database },
  { to: '/rates', label: 'Rate master', icon: Banknote },
]

/** Three tilted bars in a rising arrangement — same mark used for the
 * Android app icon/splash and the favicon, so the in-app header matches
 * what shows on the home screen. */
function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1024 1024" className={className} aria-hidden="true">
      <rect width="1024" height="1024" rx="220" fill="#fff" />
      <g transform="translate(512,560) scale(1.55)">
        <path d="M -220,-40 L -90,-40 L -130,140 L -260,140 Z" fill="#f2a93b" />
        <path d="M -94,-200 L 56,-200 L 10,140 L -140,140 Z" fill="#0f2a4d" />
        <path d="M 52,-110 L 192,-110 L 150,140 L 10,140 Z" fill="#2a78d6" />
      </g>
    </svg>
  )
}

function isActive(pathname: string, to: string) {
  if (to === '/') return pathname === '/' || pathname.startsWith('/drawings/')
  return pathname.startsWith(to)
}

function NavLink({ to, label }: { to: string; label: string }) {
  const location = useLocation()
  const active = isActive(location.pathname, to)
  return (
    <Link
      to={to}
      className={cn(
        'text-sm transition-colors',
        active ? 'font-medium text-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </Link>
  )
}

/** Bottom tab bar, mobile only — a top link row doesn't read as a native
 * mobile app and cramps badly at phone width; a fixed bottom bar with
 * icon+label per section is the standard mobile pattern (and what the
 * Android-wrapped build should feel like, not a website squeezed onto a
 * phone). Hidden from `sm` up, where the header nav takes over. */
function BottomNav() {
  const location = useLocation()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t bg-card sm:hidden print:hidden">
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
        const active = isActive(location.pathname, to)
        return (
          <Link
            key={to}
            to={to}
            className={cn(
              'flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] transition-colors',
              active ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <Icon className="size-5" strokeWidth={active ? 2.25 : 1.75} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

function ThemeToggle() {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
    localStorage.setItem('theme', isDark ? 'dark' : 'light')
  }, [isDark])

  return (
    <Button variant="ghost" size="icon" onClick={() => setIsDark((v) => !v)} aria-label="Toggle theme">
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  )
}

function LogoutButton({ onLoggedOut }: { onLoggedOut: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Sign out"
      onClick={() => authApi.logout().then(onLoggedOut)}
    >
      <LogOut className="size-4" />
    </Button>
  )
}

export default function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [needsSetup, setNeedsSetup] = useState(false)

  useEffect(() => {
    authApi.me().then((r) => {
      setNeedsSetup(r.needsSetup)
      setAuthenticated(r.authenticated)
    })
  }, [])

  if (authenticated === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>
  }

  if (!authenticated) {
    return <LoginPage needsSetup={needsSetup} onLoggedIn={() => setAuthenticated(true)} />
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <Link to="/" className="flex shrink-0 items-center gap-2 text-sm font-semibold tracking-tight">
            <Logo className="size-6 rounded-md" />
            Slimflow
          </Link>
          <nav className="flex flex-wrap items-center gap-3 sm:gap-6">
            <div className="hidden items-center gap-6 sm:flex">
              {NAV_ITEMS.filter((item) => item.to !== '/').map((item) => (
                <NavLink key={item.to} {...item} />
              ))}
            </div>
            <ThemeToggle />
            <LogoutButton onLoggedOut={() => setAuthenticated(false)} />
          </nav>
        </div>
      </header>
      <div className="pb-16 sm:pb-0">
        <Routes>
          <Route path="/" element={<UploadPage />} />
          <Route path="/drawings/:id" element={<ReviewPage />} />
          <Route path="/rates" element={<RatesPage />} />
          <Route path="/configurator" element={<ConfiguratorPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </div>
      <BottomNav />
    </div>
  )
}
