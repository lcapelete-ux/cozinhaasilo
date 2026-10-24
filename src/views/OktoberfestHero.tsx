import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Beer, Heart, Trophy } from 'lucide-react'
import { subscribeDonations } from '../services/firebaseService'
import { formatBRL, rankDonors, totalDonated } from '../utils/donations'
import type { Donation } from '../types'

// Doadômetro do Oktoberfest, exibido abaixo do login quando o tema Oktoberfest
// está selecionado. É página pública (antes do login): mostra quanto já foi
// doado e o ranking dos doadores, lido ao vivo do banco.

// Padrão losango azul/branco da bandeira da Baviera
const bavarianPattern: React.CSSProperties = {
  backgroundColor: '#1565C0',
  backgroundImage:
    'linear-gradient(135deg, #fff 25%, transparent 25%), linear-gradient(225deg, #fff 25%, transparent 25%), linear-gradient(45deg, #fff 25%, transparent 25%), linear-gradient(315deg, #fff 25%, transparent 25%)',
  backgroundPosition: '12px 0, 12px 0, 0 0, 0 0',
  backgroundSize: '24px 24px',
  opacity: 0.9,
}

const AZUL = '#1565C0'
const AZUL_ESCURO = '#0D47A1'

const PODIUM = [
  { medal: '🥇', ring: '#D4AF37', bg: '#FFFBEA', order: 'order-2 sm:order-2' },
  { medal: '🥈', ring: '#9BA6B2', bg: '#F6F8FA', order: 'order-1 sm:order-1' },
  { medal: '🥉', ring: '#C08457', bg: '#FDF4EE', order: 'order-3 sm:order-3' },
]

export default function OktoberfestHero() {
  const [donations, setDonations] = useState<Donation[]>([])

  useEffect(() => subscribeDonations(setDonations), [])

  const ranking = useMemo(() => rankDonors(donations), [donations])
  const total = useMemo(() => totalDonated(donations), [donations])

  const podium = ranking.slice(0, 3)
  const resto = ranking.slice(3)
  const maior = ranking[0]?.total ?? 0

  return (
    <div className="w-full max-w-5xl mx-auto px-4 pb-16">
      {/* Doadômetro */}
      <div className="rounded-3xl overflow-hidden shadow-sm mb-6">
        <div className="h-3" style={bavarianPattern} />
        <div className="bg-white px-5 py-9 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="text-5xl mb-2"
          >
            🍺
          </motion.div>

          <div
            className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full px-3 sm:px-4 py-1.5 text-xs font-bold uppercase tracking-wide sm:tracking-widest mb-3"
            style={{ backgroundColor: '#E8F0FB', color: AZUL_ESCURO }}
          >
            <Heart size={13} className="shrink-0" /> Doadômetro · Oktoberfest 2026
          </div>

          <h2 className="font-serif font-bold text-2xl md:text-3xl mb-5" style={{ color: AZUL_ESCURO }}>
            Lar São Cristóvão
          </h2>

          <motion.p
            key={total}
            initial={{ scale: 0.96, opacity: 0.6 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className="font-black leading-none tabular-nums"
            style={{ color: AZUL, fontSize: 'clamp(2.25rem, 9vw, 4.5rem)' }}
          >
            {formatBRL(total)}
          </motion.p>

          <p className="text-gray-500 text-sm mt-3">
            {ranking.length === 0
              ? 'Seja o primeiro a doar!'
              : `arrecadados com ${ranking.length} doador${ranking.length !== 1 ? 'es' : ''}`}
          </p>
        </div>
        <div className="h-3" style={bavarianPattern} />
      </div>

      {ranking.length === 0 ? (
        <div className="bg-white rounded-3xl shadow-sm p-12 text-center">
          <Trophy size={44} className="mx-auto mb-3 text-gray-200" />
          <p className="text-gray-400 text-sm">O ranking de doadores aparece aqui</p>
        </div>
      ) : (
        <>
          {/* Pódio */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4 items-end">
            {podium.map((r, i) => {
              const style = PODIUM[i]
              const alturas = ['pt-5 pb-6', 'pt-4 pb-5', 'pt-3 pb-4']
              return (
                <motion.div
                  key={r.donor}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className={`${style.order} rounded-3xl shadow-sm px-2 sm:px-4 ${alturas[i]} text-center border-2`}
                  style={{ borderColor: style.ring, backgroundColor: style.bg }}
                >
                  <div className="text-2xl sm:text-4xl mb-1">{style.medal}</div>
                  <p
                    className="font-bold text-gray-800 text-xs sm:text-base leading-tight break-words"
                    title={r.donor}
                  >
                    {r.donor}
                  </p>
                  <p
                    className="font-black mt-1 text-sm sm:text-xl tabular-nums leading-tight"
                    style={{ color: AZUL_ESCURO }}
                  >
                    {formatBRL(r.total)}
                  </p>
                </motion.div>
              )
            })}
          </div>

          {/* Demais colocações — a lista rola quando passa da altura da tela */}
          {resto.length > 0 && (
            <div className="bg-white rounded-3xl shadow-sm p-4 sm:p-5">
              <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
                {resto.map((r, i) => {
                  const pos = i + 4
                  const pct = maior > 0 ? Math.max(6, (r.total / maior) * 100) : 0
                  return (
                    <motion.div
                      key={r.donor}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(i * 0.04, 0.4) }}
                      className="relative flex items-center gap-3 px-3 py-2.5 rounded-xl overflow-hidden bg-white border border-gray-100"
                    >
                      {/* Barra proporcional ao primeiro colocado */}
                      <div
                        className="absolute inset-y-0 left-0"
                        style={{ width: `${pct}%`, backgroundColor: '#CEE2F8' }}
                      />
                      <span className="relative w-8 text-center font-black text-sm shrink-0" style={{ color: AZUL }}>
                        {pos}º
                      </span>
                      <span className="relative flex-1 text-sm font-semibold text-gray-700 truncate">
                        {r.donor}
                      </span>
                      <span
                        className="relative text-sm font-black tabular-nums shrink-0"
                        style={{ color: AZUL_ESCURO }}
                      >
                        {formatBRL(r.total)}
                      </span>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      <p className="text-center text-[11px] text-gray-400 mt-8 flex items-center justify-center gap-1.5">
        <Beer size={13} /> Obrigado por ajudar o Lar São Cristóvão — Prost! 🎉
      </p>
    </div>
  )
}
