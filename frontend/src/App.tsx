import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { UploadPage } from '~/pages/UploadPage'
import { ReviewPage } from '~/pages/ReviewPage'
import { RatesPage } from '~/pages/RatesPage'
import { ConfiguratorPage } from '~/pages/ConfiguratorPage'
import { AdminPage } from '~/pages/AdminPage'
import { cn } from '~/lib/utils'

const NAV_ITEMS = [
  { to: '/configurator', label: 'Configurator' },
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

export default function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link to="/" className="text-sm font-semibold tracking-tight">
            Slimflow
          </Link>
          <nav className="flex items-center gap-6">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.to} {...item} />
            ))}
          </nav>
        </div>
      </header>
      <Routes>
        <Route path="/" element={<UploadPage />} />
        <Route path="/drawings/:id" element={<ReviewPage />} />
        <Route path="/rates" element={<RatesPage />} />
        <Route path="/configurator" element={<ConfiguratorPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </div>
  )
}
