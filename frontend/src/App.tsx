import { Routes, Route, Link } from 'react-router-dom'
import { UploadPage } from '~/pages/UploadPage'
import { ReviewPage } from '~/pages/ReviewPage'
import { RatesPage } from '~/pages/RatesPage'
import { ConfiguratorPage } from '~/pages/ConfiguratorPage'
import { AdminPage } from '~/pages/AdminPage'

export default function App() {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <header className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <Link to="/" className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Slimflow Drawing Engine
          </Link>
          <nav className="flex items-center gap-4">
            <Link to="/configurator" className="text-sm text-neutral-500 hover:underline">
              Configurator
            </Link>
            <Link to="/admin" className="text-sm text-neutral-500 hover:underline">
              Admin
            </Link>
            <Link to="/rates" className="text-sm text-neutral-500 hover:underline">
              Rate master
            </Link>
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
