import { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ChefHat, LayoutGrid, Tv2, Package, ShoppingBag,
  Clock, Boxes, BarChart3, Film, Settings, LogOut, Menu, X,
  type LucideIcon,
} from 'lucide-react'
import { initAuth, seedInitialData, isFirebaseConfigured } from './services/firebaseService'
import Login from './views/Login'
import Kitchen from './views/Kitchen'
import KitchenSectors from './views/KitchenSectors'
import Display, { DISPLAY_ENABLED_KEY, DISPLAY_ENABLED_EVENT } from './views/Display'
import InternalPanel from './views/InternalPanel'
import DispatchStation from './views/DispatchStation'
import History from './views/History'
import Inventory from './views/Inventory'
import AdminDashboard from './views/AdminDashboard'
import MediaSlides from './views/MediaSlides'
import Admin from './views/Admin'
import Toast, { type ToastMessage } from './components/Toast'
import ViewErrorBoundary from './components/ViewErrorBoundary'
import OfflineIndicator from './components/OfflineIndicator'
import ThemeChooser from './views/ThemeChooser'
import { getStoredTheme, setStoredTheme, themeEmoji } from './utils/theme'
import type { LoginThemeId } from './data/loginThemes'
import type { AppUser, ViewName } from './types'

// ── Context ─────────────────────────────────────────────────────────────────

interface AppContextType {
  addToast: (message: string, type?: ToastMessage['type']) => void
}

const AppContext = createContext<AppContextType>({ addToast: () => {} })
export const useApp = () => useContext(AppContext)

// ── Nav config ───────────────────────────────────────────────────────────────

const NAV_ITEMS: { view: ViewName; label: string; icon: LucideIcon }[] = [
  { view: 'kitchen', label: 'Cozinha', icon: ChefHat },
  { view: 'kitchen-sectors', label: 'Setores', icon: LayoutGrid },
  { view: 'display', label: 'Painel', icon: Tv2 },
  { view: 'internal-panel', label: 'Recepção', icon: ShoppingBag },
  { view: 'dispatch', label: 'Entrega', icon: Package },
  { view: 'history', label: 'Histórico', icon: Clock },
  { view: 'inventory', label: 'Estoque', icon: Boxes },
  { view: 'admin-dashboard', label: 'Dashboard', icon: BarChart3 },
  { view: 'media-slides', label: 'Mídia', icon: Film },
  { view: 'admin', label: 'Config', icon: Settings },
]

const VIEW_COMPONENTS: Record<ViewName, React.ComponentType> = {
  kitchen: Kitchen,
  'kitchen-sectors': KitchenSectors,
  display: Display,
  'internal-panel': InternalPanel,
  dispatch: DispatchStation,
  history: History,
  inventory: Inventory,
  'admin-dashboard': AdminDashboard,
  'media-slides': MediaSlides,
  admin: Admin,
}

// A Recepção da equipe é a tela 'internal-panel'; a antiga 'reception' foi
// aposentada. Cadastros salvos antes disso (no Firestore e na sessão guardada
// no aparelho) ainda trazem "reception", então convertemos na leitura: ninguém
// fica sem acesso à tela que usa, sem precisar reeditar usuário por usuário.
// Nomes de tela desconhecidos são descartados para currentView nunca apontar
// para um componente inexistente.
function normalizeViews(views: string[]): ViewName[] {
  const out: ViewName[] = []
  for (const raw of views) {
    const view = (raw === 'reception' ? 'internal-panel' : raw) as ViewName
    if (VIEW_COMPONENTS[view] && !out.includes(view)) out.push(view)
  }
  return out
}

// ── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [user, setUser] = useState<AppUser | null>(() => {
    try {
      const stored = localStorage.getItem('arraia_user')
      if (!stored) return null
      const parsed = JSON.parse(stored) as AppUser
      return { ...parsed, allowed_views: normalizeViews(parsed.allowed_views ?? []) }
    } catch {
      return null
    }
  })
  // Ao retomar uma sessão guardada não passamos pelo login, então a tela
  // inicial vem das permissões do próprio usuário — um valor fixo aqui abriria
  // uma tela que ele não tem acesso.
  const [currentView, setCurrentView] = useState<ViewName>(
    () => (user?.allowed_views[0] as ViewName) ?? 'internal-panel'
  )
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [ready, setReady] = useState(false)
  // Atalho do Painel Externo no menu: ligado por aparelho em Configurações.
  const [displayEnabled, setDisplayEnabled] = useState(
    () => localStorage.getItem(DISPLAY_ENABLED_KEY) === 'true'
  )

  useEffect(() => {
    const sync = () => setDisplayEnabled(localStorage.getItem(DISPLAY_ENABLED_KEY) === 'true')
    window.addEventListener(DISPLAY_ENABLED_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(DISPLAY_ENABLED_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  // Tela de escolha de tema aparece antes do login (e volta ao sair).
  const [themePicked, setThemePicked] = useState(false)

  useEffect(() => {
    let done = false
    const finish = () => { if (!done) { done = true; setReady(true) } }
    // Offline, o login anônimo do Firebase pode não responder (fica pendente).
    // Não deixamos a tela de carregamento travar: liberamos o app em no máximo
    // 3s. As leituras/escritas seguem pelo cache offline do Firestore com o
    // token de autenticação já guardado localmente da última vez online.
    const fallback = setTimeout(finish, 3000)
    initAuth()
      .then(() => seedInitialData())
      .catch((err) => console.error('Firebase init error:', err))
      .finally(() => { clearTimeout(fallback); finish() })
    return () => clearTimeout(fallback)
  }, [])

  const addToast = useCallback((message: string, type: ToastMessage['type'] = 'error') => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { id, message, type }])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const handleLogin = (appUser: AppUser) => {
    const normalized: AppUser = { ...appUser, allowed_views: normalizeViews(appUser.allowed_views) }
    localStorage.setItem('arraia_user', JSON.stringify(normalized))
    setUser(normalized)
    setCurrentView((normalized.allowed_views[0] as ViewName) ?? 'internal-panel')
  }

  const handleLogout = () => {
    localStorage.removeItem('arraia_user')
    setUser(null)
    setThemePicked(false)
  }

  const handlePickTheme = (id: LoginThemeId) => {
    setStoredTheme(id)
    setThemePicked(true)
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
        {themePicked
          ? <Login onLogin={handleLogin} onBack={() => setThemePicked(false)} />
          : <ThemeChooser onPick={handlePickTheme} />}
        <Toast toasts={toasts} onRemove={removeToast} />
      </AppContext.Provider>
    )
  }

  const allowedViews = user.allowed_views
  // Nunca renderiza uma tela fora das permissões: se currentView não estiver
  // liberada (sessão antiga, tela aposentada), cai na primeira permitida.
  const effectiveView = allowedViews.includes(currentView)
    ? currentView
    : (allowedViews[0] as ViewName)

  // Usuário sem nenhuma tela liberada: avisa em vez de renderizar em branco.
  if (!effectiveView) {
    return (
      <AppContext.Provider value={{ addToast }}>
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="max-w-sm w-full bg-white rounded-3xl shadow-lg p-8 text-center">
            <div className="text-5xl mb-4">🔒</div>
            <h1 className="font-serif italic text-xl text-accent-dark mb-2">Sem telas liberadas</h1>
            <p className="text-sm text-gray-500 mb-5">
              O usuário <strong>{user.name}</strong> não tem nenhuma tela liberada. Peça para o
              responsável ajustar o acesso em Config.
            </p>
            <button
              onClick={handleLogout}
              className="bg-accent text-white px-5 py-2.5 rounded-2xl text-sm font-semibold"
            >
              Sair
            </button>
          </div>
        </div>
        <Toast toasts={toasts} onRemove={removeToast} />
      </AppContext.Provider>
    )
  }

  // Painel externo (TV) — tela cheia, sem menu. A Recepção saiu daqui: como é
  // estação de trabalho, precisa do menu para a equipe circular entre as telas
  // sem ficar presa nela.
  if (effectiveView === 'display') {
    const DisplayComponent = VIEW_COMPONENTS.display
    const exitTo = (allowedViews.find((v) => v !== 'display') as ViewName) ?? 'internal-panel'
    return (
      <AppContext.Provider value={{ addToast }}>
        <div className="relative">
          <button
            onClick={() => setCurrentView(exitTo)}
            className="absolute top-4 right-4 z-10 bg-black/40 text-white p-2 rounded-xl hover:bg-black/60 transition-colors"
          >
            <X size={18} />
          </button>
          <ViewErrorBoundary onReset={() => setCurrentView(exitTo)}>
            <DisplayComponent />
          </ViewErrorBoundary>
        </div>
        <OfflineIndicator />
        <Toast toasts={toasts} onRemove={removeToast} />
      </AppContext.Provider>
    )
  }

  const allowedNavItems = NAV_ITEMS.filter(
    (n) => allowedViews.includes(n.view) && (n.view !== 'display' || displayEnabled)
  )
  const brandEmoji = themeEmoji(getStoredTheme())
  const ViewComponent = VIEW_COMPONENTS[effectiveView]

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
              <span className="text-amber-400 text-lg">{brandEmoji}</span>
            </div>
          </div>
          {allowedNavItems.map(({ view, label, icon: Icon }) => (
            <NavButton
              key={view}
              active={effectiveView === view}
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
                  <span className="text-amber-400 text-lg">{brandEmoji}</span>
                </div>
              </div>
              {allowedNavItems.map(({ view, label, icon: Icon }) => (
                <NavButton
                  key={view}
                  active={effectiveView === view}
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
            key={effectiveView}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15 }}
            className="min-h-screen"
          >
            <ViewErrorBoundary key={effectiveView} onReset={() => setCurrentView(effectiveView)}>
              <ViewComponent />
            </ViewErrorBoundary>
          </motion.div>
        </main>
      </div>
      <OfflineIndicator />
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
