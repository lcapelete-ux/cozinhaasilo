import { useState } from 'react'
import { motion } from 'framer-motion'
import { User, Lock, LogIn } from 'lucide-react'
import { getUserByNamePassword } from '../services/firebaseService'
import FestivalStats from './FestivalStats'
import OktoberfestHero from './OktoberfestHero'
import { LOGIN_THEMES, DEFAULT_LOGIN_THEME, type LoginThemeId } from '../data/loginThemes'
import type { AppUser } from '../types'

const THEME_KEY = 'login-theme'

interface Props {
  onLogin: (user: AppUser) => void
}

export default function Login({ onLogin }: Props) {
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [themeId, setThemeId] = useState<LoginThemeId>(() => {
    const saved = localStorage.getItem(THEME_KEY)
    return saved === 'oktoberfest' || saved === 'saojoao' ? saved : DEFAULT_LOGIN_THEME
  })

  const theme = LOGIN_THEMES[themeId]

  const changeTheme = (id: LoginThemeId) => {
    setThemeId(id)
    localStorage.setItem(THEME_KEY, id)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !password.trim()) {
      setError('Preencha todos os campos')
      return
    }
    setLoading(true)
    setError('')
    try {
      const user = await getUserByNamePassword(name.trim(), password.trim())
      if (!user) {
        setError('Usuário ou senha incorretos')
        return
      }
      const appUser: AppUser = {
        id: user.id,
        name: user.name,
        role: user.role,
        allowed_views: user.allowed_views.split(',').map((v) => v.trim()).filter(Boolean),
      }
      onLogin(appUser)
    } catch (err) {
      setError('Erro ao conectar. Verifique as credenciais do Firebase.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen py-8 px-4 flex flex-col items-center transition-colors duration-300"
      style={{
        backgroundColor: theme.bg,
        ['--login-primary' as string]: theme.primary,
      } as React.CSSProperties}
    >
      {/* Seletor de tema */}
      <div className="flex items-center gap-1 mb-8 bg-white rounded-full p-1 shadow-sm">
        {Object.values(LOGIN_THEMES).map((th) => (
          <button
            key={th.id}
            onClick={() => changeTheme(th.id)}
            className="px-4 py-2 rounded-full text-sm font-bold transition-colors"
            style={
              themeId === th.id
                ? { backgroundColor: theme.primary, color: '#fff' }
                : { color: '#9ca3af' }
            }
          >
            {th.switchEmoji} {th.switchLabel}
          </button>
        ))}
      </div>

      <motion.div
        key={themeId}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">{theme.emoji}</div>
          <h1 className={`${theme.titleClass} text-3xl`} style={{ color: theme.titleColor }}>{theme.titleTop}</h1>
          <h2 className={`${theme.titleClass} text-xl`} style={{ color: theme.primary }}>{theme.titleBottom}</h2>
          <p className="text-sm text-gray-500 mt-1">{theme.subtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-lg p-8 space-y-4">
          <div className="relative">
            <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Nome de usuário"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full pl-9 pr-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:border-[color:var(--login-primary)] text-sm"
              autoComplete="username"
            />
          </div>

          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="password"
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-9 pr-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:border-[color:var(--login-primary)] text-sm"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="text-red-500 text-xs text-center bg-red-50 rounded-xl py-2 px-3"
            >
              {error}
            </motion.p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full text-white py-3 rounded-2xl font-medium flex items-center justify-center gap-2 transition hover:brightness-90 disabled:opacity-50"
            style={{ backgroundColor: theme.primary }}
          >
            {loading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
              />
            ) : (
              <>
                <LogIn size={16} />
                Entrar
              </>
            )}
          </button>
        </form>

        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs text-amber-700">
          <p className="font-medium mb-1">Usuários de demonstração:</p>
          <p>admin / admin123 — acesso total</p>
          <p>cozinha / cozinha123 — módulo cozinha</p>
          <p>recepcao / recepcao123 — recepção</p>
          <p>entrega / entrega123 — entrega</p>
        </div>
      </motion.div>

      {/* Landing page pública — muda conforme o tema */}
      <div className="w-full mt-12 pt-10 border-t border-gray-200">
        {themeId === 'saojoao' ? <FestivalStats /> : <OktoberfestHero />}
      </div>
    </div>
  )
}
