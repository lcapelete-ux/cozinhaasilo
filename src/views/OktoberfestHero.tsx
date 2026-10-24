import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Beer, Heart, Trophy } from 'lucide-react'
import { subscribeDonations, subscribeDonationGoal, META_PADRAO } from '../services/firebaseService'
import { formatBRL, rankDonors, totalDonated } from '../utils/donations'
import type { Donation } from '../types'

// Doadômetro do Oktoberfest, na página pública. Mostra ao vivo quanto já foi
// doado, o quanto falta para a meta e o ranking dos doadores.
//
// A mesma tela vai para o telão e para o celular, então os tamanhos usam
// clamp() com vw: o mínimo serve o celular e o máximo aproveita a TV sem que
// seja preciso uma versão separada.

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
  { medal: '🥇', ring: '#D4AF37', bg: '#FFFBEA', order: 'order-2' },
  { medal: '🥈', ring: '#9BA6B2', bg: '#F6F8FA', order: 'order-1' },
  { medal: '🥉', ring: '#C08457', bg: '#FDF4EE', order: 'order-3' },
]

// Tamanhos: mínimo (celular) → preferido (proporcional à largura) → máximo (telão)
const T = {
  caneca: 'clamp(2.5rem, 5vw, 3.5rem)',
  tarja: 'clamp(0.65rem, 1.05vw, 1.15rem)',
  emProl: 'clamp(0.9rem, 1.5vw, 1.6rem)',
  casa: 'clamp(1.5rem, 3.2vw, 2.75rem)',
  total: 'clamp(2rem, 9vw, 5rem)',
  meta: 'clamp(0.85rem, 1.6vw, 1.9rem)',
  medalha: 'clamp(1.5rem, 2.4vw, 3rem)',
  nome: 'clamp(0.75rem, 1.15vw, 1.4rem)',
  valor: 'clamp(0.9rem, 1.5vw, 1.9rem)',
  pos: 'clamp(0.8rem, 1.6vw, 1.9rem)',
  linha: 'clamp(0.8rem, 1.6vw, 1.9rem)',
}

export default function OktoberfestHero() {
  const [donations, setDonations] = useState<Donation[]>([])
  const [meta, setMeta] = useState(META_PADRAO)

  useEffect(() => subscribeDonations(setDonations), [])
  useEffect(() => subscribeDonationGoal(setMeta), [])

  const ranking = useMemo(() => rankDonors(donations), [donations])
  const total = useMemo(() => totalDonated(donations), [donations])

  const podium = ranking.slice(0, 3)
  const resto = ranking.slice(3)
  const maior = ranking[0]?.total ?? 0

  const pctMeta = meta > 0 ? (total / meta) * 100 : 0
  const bateuMeta = pctMeta >= 100

  return (
    <div className="w-full max-w-[min(1600px,95vw)] mx-auto px-4 pb-10 lg:pb-0 lg:h-full lg:grid lg:grid-cols-2 lg:gap-6 lg:items-stretch">
      {/* Doadômetro */}
      <div className="rounded-3xl overflow-hidden shadow-sm mb-4 lg:mb-0 lg:self-center">
        <div className="h-3" style={bavarianPattern} />
        <div className="bg-white px-5 py-[clamp(1.5rem,2.6vw,2.5rem)] text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="mb-2 leading-none"
            style={{ fontSize: T.caneca }}
          >
            🍺
          </motion.div>

          <div
            className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full px-3 sm:px-4 py-1.5 font-bold uppercase tracking-wide sm:tracking-widest mb-3"
            style={{ backgroundColor: '#E8F0FB', color: AZUL_ESCURO, fontSize: T.tarja }}
          >
            <Heart size={13} className="shrink-0" /> Doadômetro · Oktoberfest 2026
          </div>

          <h2 className="font-serif font-bold mb-4 px-2" style={{ color: AZUL_ESCURO, fontSize: T.casa }}>
            <span className="block font-normal text-gray-500 mb-0.5" style={{ fontSize: T.emProl }}>
              Em prol do
            </span>
            Lar São Cristóvão
          </h2>

          <motion.p
            key={total}
            initial={{ scale: 0.96, opacity: 0.6 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className="font-black leading-none tabular-nums break-words"
            style={{ color: AZUL, fontSize: T.total }}
          >
            {formatBRL(total)}
          </motion.p>

          {/* Barra da meta */}
          <div className="mx-auto mt-[clamp(1rem,2vw,2rem)] max-w-[min(1100px,92%)]">
            <div
              className="w-full rounded-full overflow-hidden"
              style={{ backgroundColor: '#E8F0FB', height: 'clamp(0.85rem, 1.9vw, 2.25rem)' }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: bateuMeta ? '#2E9E5B' : AZUL }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, pctMeta)}%` }}
                transition={{ type: 'spring', stiffness: 60, damping: 18 }}
              />
            </div>
            <p
              className="mt-2 font-semibold tabular-nums"
              style={{ color: bateuMeta ? '#2E9E5B' : '#6B7280', fontSize: T.meta }}
            >
              {bateuMeta ? (
                <>🎉 Meta de {formatBRL(meta)} atingida — {pctMeta.toFixed(0)}%!</>
              ) : (
                <>
                  {pctMeta.toFixed(1).replace('.', ',')}% da meta de{' '}
                  <strong style={{ color: AZUL_ESCURO }}>{formatBRL(meta)}</strong> · faltam{' '}
                  <strong style={{ color: AZUL_ESCURO }}>{formatBRL(meta - total)}</strong>
                </>
              )}
            </p>
          </div>

          <p className="text-gray-500 mt-3" style={{ fontSize: T.meta }}>
            {ranking.length === 0
              ? 'Seja o primeiro a doar!'
              : `${ranking.length} doador${ranking.length !== 1 ? 'es' : ''}`}
          </p>
        </div>
        <div className="h-3" style={bavarianPattern} />
      </div>

      <div className="lg:flex lg:flex-col lg:min-h-0">
      {ranking.length === 0 ? (
        <div className="bg-white rounded-3xl shadow-sm p-12 text-center">
          <Trophy size={44} className="mx-auto mb-3 text-gray-200" />
          <p className="text-gray-400" style={{ fontSize: T.meta }}>
            O ranking de doadores aparece aqui
          </p>
        </div>
      ) : (
        <>
          {/* Pódio */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 items-end shrink-0">
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
                  <div className="mb-1 leading-none" style={{ fontSize: T.medalha }}>
                    {style.medal}
                  </div>
                  <p
                    className="font-bold text-gray-800 leading-tight break-words"
                    style={{ fontSize: T.nome }}
                    title={r.donor}
                  >
                    {r.donor}
                  </p>
                  <p
                    className="font-black mt-1 tabular-nums leading-tight break-words"
                    style={{ color: AZUL_ESCURO, fontSize: T.valor }}
                  >
                    {formatBRL(r.total)}
                  </p>
                </motion.div>
              )
            })}
          </div>

          {/* Demais colocações — a lista rola quando passa da altura da tela */}
          {resto.length > 0 && (
            <div className="bg-white rounded-3xl shadow-sm p-4 sm:p-5 lg:flex-1 lg:min-h-0 lg:flex lg:flex-col">
              <div className="space-y-1.5 max-h-[45vh] lg:max-h-none lg:flex-1 lg:min-h-0 overflow-y-auto">
                {resto.map((r, i) => {
                  const pos = i + 4
                  const pct = maior > 0 ? Math.max(6, (r.total / maior) * 100) : 0
                  return (
                    <motion.div
                      key={r.donor}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(i * 0.04, 0.4) }}
                      className="relative flex items-center gap-3 px-3 py-[clamp(0.5rem,0.9vw,1rem)] rounded-xl overflow-hidden bg-white border border-gray-100"
                    >
                      {/* Barra proporcional ao primeiro colocado */}
                      <div
                        className="absolute inset-y-0 left-0"
                        style={{ width: `${pct}%`, backgroundColor: '#CEE2F8' }}
                      />
                      <span
                        className="relative text-center font-black shrink-0"
                        style={{ color: AZUL, fontSize: T.pos, width: 'clamp(2rem, 3vw, 3.5rem)' }}
                      >
                        {pos}º
                      </span>
                      <span
                        className="relative flex-1 font-semibold text-gray-700 truncate"
                        style={{ fontSize: T.linha }}
                      >
                        {r.donor}
                      </span>
                      <span
                        className="relative font-black tabular-nums shrink-0"
                        style={{ color: AZUL_ESCURO, fontSize: T.linha }}
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

      <p className="text-center text-gray-400 mt-3 shrink-0 flex items-center justify-center gap-1.5" style={{ fontSize: T.tarja }}>
        <Beer size={13} /> Obrigado por ajudar o Lar São Cristóvão — Prost! 🎉
      </p>
      </div>
    </div>
  )
}
