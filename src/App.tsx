import { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ShoppingBag, ChefHat, Scan, LayoutGrid, Tv2, Package,
  Clock, Boxes, QrCode, BarChart3, Settings, LogOut, Menu, X,
  type LucideIcon,
} from 'lucide-react'
import { initAuth, seedInitialData } from './services/firebaseService'
import Login from './views/Login'
import Reception from './views/Reception'
import Kitchen from './views/Kitchen'
import KitchenScanner from './views/KitchenScanner'
import KitchenSectors from './views/KitchenSectors'
import Display from './views/Display'
import DispatchStation from './views/DispatchStation'
import History from './views/History'
import Inventory from './views/Inventory'
import ExtraFichas from './views/ExtraFichas'
import AdminDashboard from './views/AdminDashboard'
import Admin from './views/Admin'
import Toast, { type ToastMessage } from './components/Toast'
import type { AppUser, ViewName } from './types'

// ── Context ─────────────────────────────────────────────────────────────────

interface AppContextType {
  addToast: (message: string, type?: ToastMessage['type']) => void
}

const AppContext = createContext<AppContextType>({ addToast: () => {} })
export const useApp = () => useContext(AppContext)

// ── Nav config ───────────────────────────────────────────────────────────────

const NAV_ITEMS: { view: ViewName; label: string; icon: LucideIcon }[] = [
  { view: 'reception', label: 'Recepção', icon: ShoppingBag },
  { view: 'kitchen', label: 'Cozinha', icon: ChefHat },
  { view: 'kitchen-scanner', label: 'Bip', icon: Scan },
  { view: 'kitchen-sectors', label: 'Setores', icon: LayoutGrid },
  { view: 'display', label: 'Painel', icon: Tv2 },
  { view: 'dispatch', label: 'Entrega', icon: Package },
  { view: 'history', label: 'Histórico', icon: Clock },
  { view: 'inventory', label: 'Estoque', icon: Boxes },
  { view: 'extra-fichas', label: 'QR Extra', icon: QrCode },
  { view: 'admin-dashboard', label: 'Dashboard', icon: BarChart3 },
  { view: 'admin', label: 'Config', icon: Settings },
]

const VIEW_COMPONENTS: Record<ViewName, React.ComponentType> = {
  reception: Reception,
  kitchen: Kitchen,
  'kitchen-scanner': KitchenScanner,
  'kitchen-sectors': KitchenSectors,
  display: Display,
  dispatch: DispatchStation,
  history: History,
  inventory: Inventory,
  'extra-fichas': ExtraFichas,
  'admin-dashboard': AdminDashboard,
  admin: Admin,
}

// ── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [user, setUser] = useState<AppUser | null>(() => {
    try {
      const stored = localStorage.getItem('arraia_user')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })
  const [currentView, setCurrentView] = useState<ViewName>('reception')
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    initAuth()
      .then(() => seedInitialData())
      .then(() => setReady(true))
      .catch((err) => {
        console.error('Firebase init error:', err)
        setReady(true)
      })
  }, [])

  const addToast = useCallback((message: string, type: ToastMessage['type'] = 'error') => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { id, message, type }])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const handleLogin = (appUser: AppUser) => {
    localStorage.setItem('arraia_user', JSON.stringify(appUser))
    setUser(appUser)
    const firstView = appUser.allowed_views[0] as ViewName
    setCurrentView(firstView || 'reception')
  }

  const handleLogout = () => {
    localStorage.removeItem('arraia_user')
    setUser(null)
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full"
        />
      </div>
    )
  }

  if (!user) {
    return (
      <AppContext.Provider value={{ addToast }}>
        <Login onLogin={handleLogin} />
        <Toast toasts={toasts} onRemove={removeToast} />
      </AppContext.Provider>
    )
  }

  // Display view — fullscreen, no sidebar
  if (currentView === 'display') {
    const DisplayComponent = VIEW_COMPONENTS.display
    return (
      <AppContext.Provider value={{ addToast }}>
        <div className="relative">
          <button
            onClick={() => setCurrentView(user.allowed_views[0] as ViewName || 'reception')}
            className="absolute top-4 right-4 z-10 bg-black/40 text-white p-2 rounded-xl hover:bg-black/60 transition-colors"
          >
            <X size={18} />
          </button>
          <DisplayComponent />
        </div>
        <Toast toasts={toasts} onRemove={removeToast} />
      </AppContext.Provider>
    )
  }

  const allowedViews = user.allowed_views
  const allowedNavItems = NAV_ITEMS.filter((n) => allowedViews.includes(n.view))
  const ViewComponent = VIEW_COMPONENTS[currentView] ?? VIEW_COMPONENTS[allowedViews[0] as ViewName]

  const navigateTo = (view: ViewName) => {
    if (!allowedViews.includes(view)) return
    setCurrentView(view)
    setSidebarOpen(false)
  }

  return (
    <AppContext.Provider value={{ addToast }}>
      <div className="flex min-h-screen bg-background">
        {/* Sidebar */}
        <nav className="hidden md:flex flex-col w-20 bg-sidebar shrink-0 py-6 gap-1">
          <div className="px-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-accent/30 flex items-center justify-center mx-auto">
              <span className="text-amber-400 text-lg">🌽</span>
            </div>
          </div>
          {allowedNavItems.map(({ view, label, icon: Icon }) => (
            <NavButton
              key={view}
              active={currentView === view}
              onClick={() => navigateTo(view)}
              label={label}
              icon={<Icon size={20} />}
            />
          ))}
          <div className="flex-1" />
          <NavButton
            active={false}
            onClick={handleLogout}
            label="Sair"
            icon={<LogOut size={20} />}
          />
        </nav>

        {/* Mobile sidebar toggle */}
        <button
          className="md:hidden fixed top-4 left-4 z-50 bg-sidebar text-white p-2 rounded-xl"
          onClick={() => setSidebarOpen((o) => !o)}
        >
          <Menu size={20} />
        </button>

        {/* Mobile sidebar overlay */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 z-40 bg-black/60"
              onClick={() => setSidebarOpen(false)}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {sidebarOpen && (
            <motion.nav
              initial={{ x: -80 }}
              animate={{ x: 0 }}
              exit={{ x: -80 }}
              className="md:hidden fixed left-0 top-0 bottom-0 z-50 flex flex-col w-20 bg-sidebar py-6 gap-1"
            >
              <div className="px-2 mb-4">
                <div className="w-10 h-10 rounded-xl bg-accent/30 flex items-center justify-center mx-auto">
                  <span className="text-amber-400 text-lg">🌽</span>
                </div>
              </div>
              {allowedNavItems.map(({ view, label, icon: Icon }) => (
                <NavButton
                  key={view}
                  active={currentView === view}
                  onClick={() => navigateTo(view)}
                  label={label}
                  icon={<Icon size={20} />}
                />
              ))}
              <div className="flex-1" />
              <NavButton
                active={false}
                onClick={handleLogout}
                label="Sair"
                icon={<LogOut size={20} />}
              />
            </motion.nav>
          )}
        </AnimatePresence>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="min-h-screen"
            >
              <ViewComponent />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <Toast toasts={toasts} onRemove={removeToast} />
    </AppContext.Provider>
  )
}

// ── NavButton ────────────────────────────────────────────────────────────────

function NavButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean
  onClick: () => void
  label: string
  icon: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center gap-1 mx-2 py-2 rounded-xl text-xs transition-colors
        ${active ? 'text-white' : 'text-white/40 hover:text-white/70'}`}
    >
      {active && (
        <motion.div
          layoutId="nav-active"
          className="absolute inset-0 bg-accent/40 rounded-xl"
          transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        />
      )}
      <span className="relative">{icon}</span>
      <span className="relative leading-none">{label}</span>
    </button>
  )
}
