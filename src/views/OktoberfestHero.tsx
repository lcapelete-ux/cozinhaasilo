import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Heart, Trophy } from 'lucide-react'
import { subscribeDonations, subscribeDonationGoal, META_PADRAO } from '../services/firebaseService'
import { formatBRL, rankDonors, totalDonated } from '../utils/donations'
import type { Donation } from '../types'

// Doadômetro do Oktoberfest, na página pública. Mostra ao vivo quanto já foi
// doado, o quanto falta para a meta e o ranking dos doadores.
//
// A mesma tela serve o celular e o telão da festa (768x512). A partir de 700px
// ela vira duas colunas e ocupa exatamente uma tela, sem rolagem. Os tamanhos
// têm dois conjuntos de clamp(): o primeiro atende a tela empilhada do celular,
// e o prefixo telao: redimensiona para a COLUNA, que é metade da largura — com
// um único conjunto baseado na tela inteira, os valores do pódio invadiam o
// card vizinho e o total era cortado ao meio.

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
const VERDE = '#2E9E5B'

const PODIUM = [
  { medal: '🥇', ring: '#D4AF37', bg: '#FFFBEA', order: 'order-2' },
  { medal: '🥈', ring: '#9BA6B2', bg: '#F6F8FA', order: 'order-1' },
  { medal: '🥉', ring: '#C08457', bg: '#FDF4EE', order: 'order-3' },
]

const S = {
  caneca: 'text-[clamp(1.75rem,6vw,2.5rem)] telao:text-[clamp(1.4rem,2.5vw,3rem)]',
  tarja: 'text-[clamp(0.6rem,2.5vw,0.8rem)] telao:text-[clamp(0.58rem,1vw,1.05rem)]',
  emProl: 'text-[clamp(0.8rem,3.2vw,1.1rem)] telao:text-[clamp(0.72rem,1.25vw,1.5rem)]',
  casa: 'text-[clamp(1.25rem,5.5vw,2rem)] telao:text-[clamp(1.05rem,2.3vw,2.75rem)]',
  total: 'text-[clamp(2rem,10vw,3.5rem)] telao:text-[clamp(1.6rem,4.6vw,5rem)]',
  meta: 'text-[clamp(0.72rem,3vw,1rem)] telao:text-[clamp(0.68rem,1.25vw,1.6rem)]',
  medalha: 'text-[clamp(1.25rem,5vw,2rem)] telao:text-[clamp(1rem,1.9vw,2.5rem)]',
  nome: 'text-[clamp(0.68rem,2.5vw,0.95rem)] telao:text-[clamp(0.62rem,1vw,1.3rem)]',
  valor: 'text-[clamp(0.8rem,3.2vw,1.15rem)] telao:text-[clamp(0.72rem,1.3vw,1.8rem)]',
  linha: 'text-[clamp(0.75rem,2.9vw,1rem)] telao:text-[clamp(0.7rem,1.25vw,1.7rem)]',
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
    <div className="w-full max-w-[min(1600px,94vw)] mx-auto pb-8 telao:pb-0 telao:h-full telao:grid telao:grid-cols-2 telao:gap-3 telao:items-stretch">
      {/* Medidor */}
      <div className="rounded-2xl overflow-hidden shadow-sm mb-3 telao:mb-0 telao:self-center">
        <div className="h-2" style={bavarianPattern} />
        <div className="bg-white px-4 py-[clamp(1rem,2.4vw,2rem)] text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className={`mb-1 leading-none ${S.caneca}`}
          >
            🍺
          </motion.div>

          <div
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-bold uppercase tracking-wide mb-2 ${S.tarja}`}
            style={{ backgroundColor: '#E8F0FB', color: AZUL_ESCURO }}
          >
            <Heart size={12} className="shrink-0" /> Doadômetro · Oktoberfest 2026
          </div>

          <h2 className={`font-serif font-bold mb-2 px-1 leading-tight ${S.casa}`} style={{ color: AZUL_ESCURO }}>
            <span className={`block font-normal text-gray-500 ${S.emProl}`}>Em prol do</span>
            Lar São Cristóvão
          </h2>

          <motion.p
            key={total}
            initial={{ scale: 0.96, opacity: 0.6 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className={`font-black leading-none tabular-nums break-words ${S.total}`}
            style={{ color: AZUL }}
          >
            {formatBRL(total)}
          </motion.p>

          {/* Barra da meta */}
          <div className="mx-auto mt-[clamp(0.6rem,1.5vw,1.5rem)] max-w-[94%]">
            <div
              className="w-full rounded-full overflow-hidden h-[clamp(0.55rem,2.2vw,0.85rem)] telao:h-[clamp(0.55rem,1.3vw,1.6rem)]"
              style={{ backgroundColor: '#E8F0FB' }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: bateuMeta ? VERDE : AZUL }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, pctMeta)}%` }}
                transition={{ type: 'spring', stiffness: 60, damping: 18 }}
              />
            </div>
            <p
              className={`mt-1.5 font-semibold tabular-nums leading-tight ${S.meta}`}
              style={{ color: bateuMeta ? VERDE : '#6B7280' }}
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

          <p className={`text-gray-500 mt-1.5 ${S.meta}`}>
            {ranking.length === 0
              ? 'Seja o primeiro a doar!'
              : `${ranking.length} doador${ranking.length !== 1 ? 'es' : ''}`}
          </p>
        </div>
        <div className="h-2" style={bavarianPattern} />
      </div>

      {/* Pódio + ranking */}
      <div className="telao:flex telao:flex-col telao:min-h-0">
        {ranking.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-10 text-center telao:flex-1 telao:flex telao:flex-col telao:items-center telao:justify-center">
            <Trophy size={40} className="mx-auto mb-2 text-gray-200" />
            <p className={`text-gray-400 ${S.meta}`}>O ranking de doadores aparece aqui</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 mb-2 items-end shrink-0">
              {podium.map((r, i) => {
                const style = PODIUM[i]
                const alturas = ['pt-3 pb-4', 'pt-2.5 pb-3', 'pt-2 pb-2.5']
                return (
                  <motion.div
                    key={r.donor}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className={`${style.order} rounded-2xl shadow-sm px-1.5 ${alturas[i]} text-center border-2 overflow-hidden`}
                    style={{ borderColor: style.ring, backgroundColor: style.bg }}
                  >
                    <div className={`mb-0.5 leading-none ${S.medalha}`}>{style.medal}</div>
                    <p
                      className={`font-bold text-gray-800 leading-tight break-words ${S.nome}`}
                      title={r.donor}
                    >
                      {r.donor}
                    </p>
                    <p
                      className={`font-black mt-0.5 tabular-nums leading-tight break-words ${S.valor}`}
                      style={{ color: AZUL_ESCURO }}
                    >
                      {formatBRL(r.total)}
                    </p>
                  </motion.div>
                )
              })}
            </div>

            {resto.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm p-2.5 telao:flex-1 telao:min-h-0 telao:flex telao:flex-col">
                <div className="space-y-1 max-h-[45vh] telao:max-h-none telao:flex-1 telao:min-h-0 overflow-y-auto">
                  {resto.map((r, i) => {
                    const pos = i + 4
                    const pct = maior > 0 ? Math.max(6, (r.total / maior) * 100) : 0
                    return (
                      <motion.div
                        key={r.donor}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(i * 0.04, 0.4) }}
                        className="relative flex items-center gap-2 px-2 py-[clamp(0.3rem,0.7vw,0.75rem)] rounded-lg overflow-hidden bg-white border border-gray-100"
                      >
                        <div
                          className="absolute inset-y-0 left-0"
                          style={{ width: `${pct}%`, backgroundColor: '#CEE2F8' }}
                        />
                        <span
                          className={`relative text-center font-black shrink-0 w-[clamp(1.5rem,2.4vw,3rem)] ${S.linha}`}
                          style={{ color: AZUL }}
                        >
                          {pos}º
                        </span>
                        <span className={`relative flex-1 font-semibold text-gray-700 truncate ${S.linha}`}>
                          {r.donor}
                        </span>
                        <span
                          className={`relative font-black tabular-nums shrink-0 ${S.linha}`}
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
      </div>
    </div>
  )
}
