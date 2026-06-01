import { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ShoppingBag, ChefHat, Scan, LayoutGrid, Tv2, Package,
  Clock, Boxes, QrCode, BarChart3, Film, Settings, LogOut, Menu, X,
  type LucideIcon,
} from 'lucide-react'
import { initAuth, seedInitialData, isFirebaseConfigured } from './services/firebaseService'
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
import MediaSlides from './views/MediaSlides'
import Admin from './views/Admin'
import Toast, { type ToastMessage } from './components/Toast'
import LateOrdersAlert from './components/LateOrdersAlert'
import ViewErrorBoundary from './components/ViewErrorBoundary'
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
  { view: 'media-slides', label: 'Mídia', icon: Film },
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
  'media-slides': MediaSlides,
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

  if (!isFirebaseConfigured) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-lg p-8 text-center">
          <div className="text-5xl mb-4">🌽</div>
          <h1 className="font-serif italic text-2xl text-accent-dark mb-2">Arraiá do Lar São Cristóvão</h1>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-left text-sm text-amber-800 mt-4">
            <p className="font-bold mb-2">⚙️ Firebase não configurado</p>
            <p className="mb-3">Para usar o sistema, adicione as credenciais do Firebase como Secrets no GitHub:</p>
            <ol className="list-decimal list-inside space-y-1 text-xs">
              <li>Acesse o repositório no GitHub</li>
              <li>Vá em <strong>Settings → Secrets and variables → Actions</strong></li>
              <li>Adicione os 6 secrets do Firebase</li>
              <li>Vá em <strong>Actions</strong> e rode o workflow novamente</li>
            </ol>
            <div className="mt-3 bg-white rounded-xl p-3 font-mono text-xs space-y-1">
              <p>VITE_FIREBASE_API_KEY</p>
              <p>VITE_FIREBASE_AUTH_DOMAIN</p>
              <p>VITE_FIREBASE_PROJECT_ID</p>
              <p>VITE_FIREBASE_STORAGE_BUCKET</p>
              <p>VITE_FIREBASE_MESSAGING_SENDER_ID</p>
              <p>VITE_FIREBASE_APP_ID</p>
            </div>
          </div>
        </div>
      </div>
    )
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
          <ViewErrorBoundary onReset={() => setCurrentView('reception')}>
            <DisplayComponent />
          </ViewErrorBoundary>
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
          <motion.div
            key={currentView}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15 }}
            className="min-h-screen"
          >
            <ViewErrorBoundary key={currentView} onReset={() => setCurrentView(currentView)}>
              <ViewComponent />
            </ViewErrorBoundary>
          </motion.div>
        </main>
      </div>
      <LateOrdersAlert />
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
