import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { LOGIN_THEMES, type LoginTheme, type LoginThemeId } from '../data/loginThemes'

// Tela de boas-vindas (antes do login): o usuário escolhe a festa e o tema é
// aplicado imediatamente, seguindo para o login já com a identidade escolhida.
export default function ThemeChooser({ onPick }: { onPick: (id: LoginThemeId) => void }) {
  const themes = Object.values(LOGIN_THEMES)

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: 'linear-gradient(160deg, #1b1c22 0%, #2b2d36 100%)' }}>
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center mb-10"
      >
        <p className="text-white/50 text-xs font-semibold uppercase tracking-[0.3em] mb-2">Lar São Cristóvão</p>
        <h1 className="font-serif italic text-3xl md:text-4xl text-white">Escolha a festa</h1>
        <p className="text-white/60 text-sm mt-2">Selecione o tema para começar</p>
      </motion.div>

      <div className="grid sm:grid-cols-2 gap-5 w-full max-w-2xl">
        {themes.map((t, i) => (
          <ThemeCard key={t.id} theme={t} delay={i * 0.1} onPick={() => onPick(t.id)} />
        ))}
      </div>
    </div>
  )
}

function ThemeCard({ theme, delay, onPick }: { theme: LoginTheme; delay: number; onPick: () => void }) {
  return (
    <motion.button
      onClick={onPick}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      whileHover={{ y: -6, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="group relative overflow-hidden rounded-3xl p-8 text-left shadow-xl focus:outline-none"
      style={{ background: theme.bg }}
    >
      {/* Faixa de cor no topo */}
      <div className="absolute top-0 left-0 right-0 h-2" style={{ backgroundColor: theme.primary }} />

      <div className="text-6xl mb-4">{theme.emoji}</div>
      <h2 className={`${theme.titleClass} text-2xl md:text-3xl`} style={{ color: theme.titleColor }}>
        {theme.festivalName}
      </h2>
      <p className="text-sm text-gray-500 mt-1">{theme.tagline}</p>

      <span
        className="mt-6 inline-flex items-center gap-2 text-white text-sm font-bold rounded-full px-4 py-2 transition-transform group-hover:gap-3"
        style={{ backgroundColor: theme.primary }}
      >
        Entrar
        <ArrowRight size={16} />
      </span>
    </motion.button>
  )
}
