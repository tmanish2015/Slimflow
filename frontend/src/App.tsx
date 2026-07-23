import { useEffect, useState } from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { Moon, Sun } from 'lucide-react'
import { UploadPage } from '~/pages/UploadPage'
import { ReviewPage } from '~/pages/ReviewPage'
import { RatesPage } from '~/pages/RatesPage'
import { ConfiguratorPage } from '~/pages/ConfiguratorPage'
import { AdminPage } from '~/pages/AdminPage'
import { DashboardPage } from '~/pages/DashboardPage'
import { Button } from '~/components/ui/button'
import { cn } from '~/lib/utils'

const NAV_ITEMS = [
  { to: '/configurator', label: 'Configurator' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/admin', label: 'Admin' },
  { to: '/rates', label: 'Rate master' },
]

function NavLink({ to, label }: { to: string; label: string }) {
  const location = useLocation()
  const active = location.pathname === to || (to !== '/' && location.pathname.startsWith(to))
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

export default function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <Link to="/" className="shrink-0 text-sm font-semibold tracking-tight">
            Slimflow
          </Link>
          <nav className="flex flex-wrap items-center gap-3 sm:gap-6">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.to} {...item} />
            ))}
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <Routes>
        <Route path="/" element={<UploadPage />} />
        <Route path="/drawings/:id" element={<ReviewPage />} />
        <Route path="/rates" element={<RatesPage />} />
        <Route path="/configurator" element={<ConfiguratorPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </div>
  )
}
