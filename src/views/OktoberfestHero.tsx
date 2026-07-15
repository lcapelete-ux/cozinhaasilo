import { motion } from 'framer-motion'
import { Beer, Sparkles, TrendingUp, ShoppingBag, Receipt, CalendarDays } from 'lucide-react'

// Seção temática do Oktoberfest exibida abaixo do login quando o tema Oktoberfest
// está selecionado. A festa ainda não aconteceu, então mostramos um destaque
// "em breve" com o mesmo layout de KPIs da retrospectiva, porém reservado.

// Padrão losango azul/branco da bandeira da Baviera
const bavarianPattern: React.CSSProperties = {
  backgroundColor: '#1565C0',
  backgroundImage:
    'linear-gradient(135deg, #fff 25%, transparent 25%), linear-gradient(225deg, #fff 25%, transparent 25%), linear-gradient(45deg, #fff 25%, transparent 25%), linear-gradient(315deg, #fff 25%, transparent 25%)',
  backgroundPosition: '12px 0, 12px 0, 0 0, 0 0',
  backgroundSize: '24px 24px',
  opacity: 0.9,
}

const PLACEHOLDER_KPIS = [
  { icon: <TrendingUp size={16} />, label: 'Faturamento' },
  { icon: <ShoppingBag size={16} />, label: 'Itens vendidos' },
  { icon: <Receipt size={16} />, label: 'Ticket médio' },
  { icon: <CalendarDays size={16} />, label: 'Melhor dia' },
]

const TEASERS = [
  { emoji: '🍺', nome: 'Chopp Gelado' },
  { emoji: '🥨', nome: 'Pretzel' },
  { emoji: '🌭', nome: 'Salsichão' },
  { emoji: '🎵', nome: 'Música ao vivo' },
]

export default function OktoberfestHero() {
  return (
    <div className="w-full max-w-5xl mx-auto px-4 pb-16">
      {/* Banner bávaro */}
      <div className="rounded-3xl overflow-hidden shadow-sm mb-8">
        <div className="h-3" style={bavarianPattern} />
        <div className="bg-white px-6 py-10 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="text-6xl mb-3"
          >
            🍺
          </motion.div>
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest mb-3"
            style={{ backgroundColor: '#E8F0FB', color: '#0D47A1' }}>
            <Sparkles size={13} /> Em breve
          </div>
          <h2 className="font-serif font-bold text-3xl md:text-4xl" style={{ color: '#0D47A1' }}>
            Oktoberfest — Lar São Cristóvão
          </h2>
          <p className="text-gray-500 text-sm mt-2 max-w-lg mx-auto">
            A próxima grande festa está chegando! Quando ela acontecer, a
            retrospectiva completa aparece aqui — faturamento, rankings e gráficos,
            igual à do Arraiá.
          </p>
        </div>
        <div className="h-3" style={bavarianPattern} />
      </div>

      {/* KPIs reservados (em breve) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {PLACEHOLDER_KPIS.map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-2xl shadow-sm p-4 flex flex-col border border-dashed border-gray-200">
            <div className="flex items-center gap-2 mb-1" style={{ color: '#1565C0' }}>
              {kpi.icon}
              <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">{kpi.label}</span>
            </div>
            <p className="font-black text-2xl md:text-3xl text-gray-300 leading-tight">—</p>
            <p className="text-xs text-gray-300 mt-0.5">aguardando a festa</p>
          </div>
        ))}
      </div>

      {/* Prévia temática */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {TEASERS.map((it, i) => (
          <motion.div
            key={it.nome}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="bg-white rounded-2xl shadow-sm p-5 flex flex-col items-center text-center gap-2"
          >
            <span className="text-3xl">{it.emoji}</span>
            <span className="text-sm font-semibold text-gray-700">{it.nome}</span>
          </motion.div>
        ))}
      </div>

      <p className="text-center text-[11px] text-gray-400 mt-8 flex items-center justify-center gap-1.5">
        <Beer size={13} /> Prepare-se — Prost! 🎉
      </p>
    </div>
  )
}
