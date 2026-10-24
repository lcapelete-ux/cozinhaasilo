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
// ou a retrospectiva do Arraiá (tema São João). O cadeado leva a equipe direto
// para o sistema.
//
// No telão (700px+) a página ocupa exatamente uma tela. O botão de trocar festa
// e o cadeado ficam sobrepostos nos cantos, em vez de ocupar uma faixa própria:
// numa tela de 512px de altura, cada linha de moldura sai do conteúdo.
export default function PublicHome({ onEnter, onBack }: Props) {
  const themeId = getStoredTheme()
  const theme = LOGIN_THEMES[themeId]
  // Só o Doadômetro é feito para caber numa tela. A retrospectiva do Arraiá é
  // uma página longa, com gráficos, e precisa continuar rolando.
  const umaTelaSo = themeId !== 'saojoao'

  if (themeId === 'oktoberfest') return (
    <div className="relative">
      <OktoberfestHero />
      <div className="absolute bottom-1 right-4 flex gap-2 text-[#b8c6d4] opacity-20 hover:opacity-100 focus-within:opacity-100">
        {onBack && <button onClick={onBack} className="inline-flex items-center gap-2 px-4 py-2 text-xs rounded-full border border-white/20 hover:bg-white/10"><ArrowLeft size={14} />Trocar festa</button>}
        <button onClick={onEnter} aria-label="Acessar o sistema da equipe" className="inline-flex items-center gap-2 px-4 py-2 text-xs rounded-full border border-white/20 hover:bg-white/10"><Lock size={14} />Equipe</button>
      </div>
    </div>
  )

  return (
    <div
      className={`relative min-h-screen flex flex-col px-3 py-3 telao:px-4 transition-colors duration-300 ${
        umaTelaSo ? 'telao:h-screen telao:overflow-hidden' : ''
      }`}
      style={{ backgroundColor: theme.bg }}
    >
      {onBack && (
        <button
          onClick={onBack}
          className="absolute top-2 left-2 z-20 inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1 bg-white/70 hover:bg-white transition-colors"
          style={{ color: theme.primary }}
        >
          <ArrowLeft size={13} />
          Trocar festa
        </button>
      )}

      <motion.div
        key={themeId}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex-1 min-h-0 w-full"
      >
        {themeId === 'saojoao' ? <FestivalStats /> : <OktoberfestHero />}
      </motion.div>

      {/* Cadeado — entrada da equipe no sistema */}
      <button
        onClick={onEnter}
        title="Acessar o sistema"
        aria-label="Acessar o sistema"
        className="absolute bottom-2 right-2 z-20 w-9 h-9 rounded-full bg-white/60 hover:bg-white text-gray-400 hover:text-gray-700 shadow-sm flex items-center justify-center transition-colors"
      >
        <Lock size={16} />
      </button>
    </div>
  )
}

