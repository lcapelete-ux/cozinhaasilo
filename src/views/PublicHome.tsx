import { motion } from 'framer-motion'
import { Lock, ArrowLeft } from 'lucide-react'
import FestivalStats from './FestivalStats'
import OktoberfestHero from './OktoberfestHero'
import { LOGIN_THEMES } from '../data/loginThemes'
import { getStoredTheme } from '../utils/theme'

interface Props {
  onEnter: () => void
  onBack?: () => void
}

// Página que o público vê ao abrir o sistema: o Doadômetro (tema Oktoberfest)
// ou a retrospectiva do Arraiá (tema São João). O cadeado no rodapé leva a
// equipe direto para o sistema.
export default function PublicHome({ onEnter, onBack }: Props) {
  const themeId = getStoredTheme()
  const theme = LOGIN_THEMES[themeId]

  return (
    <div
      className="min-h-screen lg:h-screen lg:overflow-hidden flex flex-col py-6 px-4 transition-colors duration-300"
      style={{ backgroundColor: theme.bg }}
    >
      {onBack && (
        <button
          onClick={onBack}
          className="self-start inline-flex items-center gap-1.5 text-sm font-semibold rounded-full px-3 py-1.5 bg-white/70 hover:bg-white transition-colors"
          style={{ color: theme.primary }}
        >
          <ArrowLeft size={15} />
          Trocar festa
        </button>
      )}

      <motion.div
        key={themeId}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex-1 min-h-0 w-full mt-6"
      >
        {themeId === 'saojoao' ? <FestivalStats /> : <OktoberfestHero />}
      </motion.div>

      {/* Cadeado — entrada da equipe no sistema */}
      <div className="flex justify-center pt-4 pb-2 shrink-0">
        <button
          onClick={onEnter}
          title="Acessar o sistema"
          aria-label="Acessar o sistema"
          className="w-11 h-11 rounded-full bg-white/70 hover:bg-white text-gray-400 hover:text-gray-700 shadow-sm flex items-center justify-center transition-colors"
        >
          <Lock size={18} />
        </button>
      </div>
    </div>
  )
}
