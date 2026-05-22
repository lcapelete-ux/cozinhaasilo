import { useState } from 'react'
import { motion } from 'framer-motion'
import { User, Lock, LogIn } from 'lucide-react'
import { getUserByNamePassword } from '../services/firebaseService'
import type { AppUser } from '../types'

interface Props {
  onLogin: (user: AppUser) => void
}

export default function Login({ onLogin }: Props) {
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">🌽</div>
          <h1 className="font-serif italic text-3xl text-accent-dark">Arraiá do</h1>
          <h2 className="font-serif italic text-xl text-accent">Lar São Cristóvão</h2>
          <p className="text-sm text-gray-500 mt-1">Sistema de Gestão de Pedidos</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-lg p-8 space-y-4">
          <div className="relative">
            <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Nome de usuário"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full pl-9 pr-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:border-accent text-sm"
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
              className="w-full pl-9 pr-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:border-accent text-sm"
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
            className="w-full bg-accent hover:bg-accent-dark text-white py-3 rounded-2xl font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
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
    </div>
  )
}
