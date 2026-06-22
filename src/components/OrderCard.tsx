import { motion } from 'framer-motion'
import { Plane, Clock, Flame, Beef, Drumstick, Minus, Plus, LayoutGrid } from 'lucide-react'
import { isTakeoutTicket, displayTicket } from '../utils/ticket'
import type { Order, OrderStatus } from '../types'

// Card de pedido usado tanto na tela Entrega quanto no modo "Entrega" da tela
// Setores — assim as duas telas ficam visualmente idênticas e nunca divergem.

export const SECTOR_STYLE: Record<string, { icon: React.ElementType; light: string; dark: string }> = {
  Fritadeira: { icon: Flame,    light: 'text-orange-500 bg-orange-50',  dark: 'text-orange-400 bg-orange-950/40' },
  Chapa:      { icon: Beef,     light: 'text-blue-500 bg-blue-50',      dark: 'text-blue-400 bg-blue-950/40' },
  Assados:    { icon: Drumstick,light: 'text-purple-500 bg-purple-50',  dark: 'text-purple-400 bg-purple-950/40' },
}

export const STATUS_STYLE: Record<OrderStatus, { light: string; dark: string; label: string }> = {
  pending:   { light: 'bg-yellow-100 text-yellow-700 border-yellow-200', dark: 'bg-yellow-900/40 text-yellow-300 border-yellow-700', label: 'Aguardando' },
  preparing: { light: 'bg-blue-100 text-blue-700 border-blue-200',       dark: 'bg-blue-900/40 text-blue-300 border-blue-700',       label: 'Preparando' },
  ready:     { light: 'bg-green-100 text-green-700 border-green-200',    dark: 'bg-green-900/40 text-green-300 border-green-700',    label: 'Pronto! ✓' },
  delivered: { light: 'bg-gray-100 text-gray-500 border-gray-200',       dark: 'bg-gray-800 text-gray-400 border-gray-700',         label: 'Entregue' },
}

export function formatAge(created: Date, now: number): string {
  const mins = Math.floor((now - created.getTime()) / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

// Ajusta o tamanho dos cards conforme a quantidade de pedidos na fila. A
// grade padrão é de 6 colunas, então 6 fichas é a referência de tamanho
// "cheio"; a partir daí o zoom encolhe por linha (de 6 em 6) para caber
// tudo em um monitor de 21" sem precisar rolar a tela.
export function getAutoZoom(count: number): number {
  if (count <= 2) return 1.4
  if (count <= 4) return 1.2
  if (count <= 6) return 1.05
  if (count <= 12) return 0.85
  if (count <= 18) return 0.7
  if (count <= 24) return 0.6
  return 0.5
}

export const COLS_STEPS_RANGE = [1, 2, 3, 4, 5, 6, 7, 8]

export function ColumnsControl({ cols, onChange }: { cols: number | null; onChange: (c: number | null) => void }) {
  const dec = () => {
    if (cols === null) return
    onChange(cols <= COLS_STEPS_RANGE[0] ? null : cols - 1)
  }
  const inc = () => {
    if (cols === null) { onChange(COLS_STEPS_RANGE[0]); return }
    if (cols < COLS_STEPS_RANGE[COLS_STEPS_RANGE.length - 1]) onChange(cols + 1)
  }
  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-xl px-1 py-1" title="Fichas por linha">
      <button onClick={dec} disabled={cols === null} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:bg-white hover:text-gray-800 disabled:opacity-30 transition-colors">
        <Minus size={14} />
      </button>
      <span className="flex items-center gap-1 text-xs font-bold text-gray-500 w-14 justify-center tabular-nums">
        <LayoutGrid size={12} />
        {cols ?? 'Auto'}
      </span>
      <button onClick={inc} disabled={cols === COLS_STEPS_RANGE[COLS_STEPS_RANGE.length - 1]} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:bg-white hover:text-gray-800 disabled:opacity-30 transition-colors">
        <Plus size={14} />
      </button>
    </div>
  )
}

interface CardProps {
  order: Order
  idx: number
  nightMode: boolean
  now: number
}

const CARD_THEME: Record<OrderStatus, {
  light: { card: string; header: string; divider: string; row: string; qty: string; seq: string; fichaLabel: string; fichaNum: string }
  dark:  { card: string; header: string; divider: string; row: string; qty: string; seq: string; fichaLabel: string; fichaNum: string }
  wrapClass: string
}> = {
  pending: {
    light: { card: 'border-yellow-300 bg-yellow-50',      header: 'bg-yellow-100',    divider: 'bg-yellow-200',  row: 'bg-yellow-100/70',  qty: 'bg-yellow-200 text-yellow-800 border-yellow-300',   seq: 'bg-yellow-200 text-yellow-700',   fichaLabel: 'text-yellow-600', fichaNum: 'text-gray-900' },
    dark:  { card: 'border-yellow-500 bg-yellow-950/30',  header: 'bg-yellow-900/50', divider: 'bg-yellow-700',  row: 'bg-yellow-950/40',  qty: 'bg-yellow-900 text-yellow-300 border-yellow-700',   seq: 'bg-yellow-900/70 text-yellow-400',fichaLabel: 'text-yellow-500', fichaNum: 'text-white'     },
    wrapClass: '',
  },
  preparing: {
    light: { card: 'border-blue-300 bg-blue-50',          header: 'bg-blue-100',      divider: 'bg-blue-200',    row: 'bg-blue-100/70',    qty: 'bg-blue-200 text-blue-800 border-blue-300',         seq: 'bg-blue-200 text-blue-700',       fichaLabel: 'text-blue-600',   fichaNum: 'text-gray-900' },
    dark:  { card: 'border-blue-500 bg-blue-950/30',      header: 'bg-blue-900/50',   divider: 'bg-blue-700',    row: 'bg-blue-950/40',    qty: 'bg-blue-900 text-blue-300 border-blue-700',         seq: 'bg-blue-900/70 text-blue-400',    fichaLabel: 'text-blue-400',   fichaNum: 'text-white'     },
    wrapClass: '',
  },
  ready: {
    light: { card: 'border-green-200 bg-green-50/50',     header: 'bg-green-50',      divider: 'bg-green-100',   row: 'bg-white/60',       qty: 'bg-white text-gray-500 border-gray-200',            seq: 'bg-green-100 text-green-600',     fichaLabel: 'text-green-600',  fichaNum: 'text-gray-600'  },
    dark:  { card: 'border-green-600 bg-green-950/15',    header: 'bg-green-950/30',  divider: 'bg-green-800',   row: 'bg-gray-900/30',    qty: 'bg-gray-700/60 text-gray-400 border-gray-600',      seq: 'bg-green-900/50 text-green-600',  fichaLabel: 'text-green-600',  fichaNum: 'text-gray-400'  },
    wrapClass: 'opacity-75',
  },
  delivered: {
    light: { card: 'border-gray-100 bg-white',            header: 'bg-gray-50',       divider: 'bg-gray-100',    row: 'bg-gray-50',        qty: 'bg-white text-gray-700 border-gray-200',            seq: 'bg-gray-200 text-gray-500',       fichaLabel: 'text-gray-400',   fichaNum: 'text-gray-900'  },
    dark:  { card: 'border-gray-500 bg-gray-800',         header: 'bg-gray-900/50',   divider: 'bg-gray-600',    row: 'bg-gray-900/50',    qty: 'bg-gray-700 text-white border-gray-600',            seq: 'bg-gray-700 text-gray-400',       fichaLabel: 'text-gray-500',   fichaNum: 'text-white'     },
    wrapClass: '',
  },
}

export function OrderCard({ order, idx, nightMode: n, now }: CardProps) {
  const theme = CARD_THEME[order.status]
  const isTakeout = isTakeoutTicket(order.ticket_number)
  // "Para viagem" cards stay light/white even in night mode, to stand out
  const nn = n && !isTakeout
  const t = nn ? theme.dark : theme.light
  const status = STATUS_STYLE[order.status]
  const age = formatAge(order.created_at, now)
  const isOld = (now - order.created_at.getTime()) > 10 * 60 * 1000

  const bySector = order.items.reduce<Record<string, typeof order.items>>((acc, item) => {
    const s = item.sector || 'Outros'
    ;(acc[s] ??= []).push(item)
    return acc
  }, {})

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
      className={`relative flex flex-col rounded-3xl overflow-hidden shadow-md border ${t.card} ${theme.wrapClass} ${
        isTakeout ? 'ring-2 ring-purple-400' : ''
      }`}
    >
      {/* Para Viagem banner */}
      {isTakeout && (
        <div className="flex items-center justify-center gap-1.5 py-1.5 text-xs font-black uppercase tracking-widest bg-purple-500 text-white">
          <Plane size={12} />
          Para Viagem
        </div>
      )}

      {/* Card header */}
      <div className={`px-4 pt-4 pb-3 flex items-start justify-between ${t.header}`}>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-black tabular-nums px-1.5 py-0.5 rounded-lg ${t.seq}`}>
            #{String(idx + 1).padStart(2, '0')}
          </span>
          <div>
            <p className={`text-xs uppercase tracking-widest font-semibold ${t.fichaLabel}`}>
              Ficha
            </p>
            <div className="flex items-center gap-2">
              <p className={`font-black text-3xl leading-none ${t.fichaNum}`}>
                {displayTicket(order.ticket_number)}
              </p>
              {isTakeout && <Plane size={26} className="text-purple-500 shrink-0" />}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${nn ? status.dark : status.light}`}>
            {status.label}
          </span>
          <span className={`flex items-center gap-1 text-xs font-semibold ${
            isOld ? 'text-red-500' : nn ? 'text-gray-500' : 'text-gray-400'
          }`}>
            <Clock size={11} />
            {age}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className={`h-px w-full ${t.divider}`} />

      {/* Items */}
      <div className="flex-1 p-4 space-y-3">
        {Object.entries(bySector).map(([sector, items]) => {
          const style = SECTOR_STYLE[sector]
          const Icon = style?.icon
          return (
            <div key={sector}>
              <div className="flex items-center gap-1.5 mb-1.5">
                {Icon && <Icon size={11} className={nn ? style.dark.split(' ')[0] : style.light.split(' ')[0]} />}
                <span className={`text-xs font-black uppercase tracking-widest ${nn ? 'text-gray-500' : 'text-gray-400'}`}>{sector}</span>
              </div>
              <div className="space-y-1">
                {items.map((item, i) => (
                  <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-xl ${t.row}`}>
                    <span className={`text-sm font-semibold leading-tight ${nn ? 'text-gray-200' : 'text-gray-800'}`}>
                      {item.name}
                    </span>
                    <span className={`text-sm font-black ml-3 shrink-0 px-2 py-0.5 rounded-lg border ${t.qty}`}>
                      ×{item.quantity}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="px-4 pb-4">
        <div
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl font-bold text-sm ${
            nn ? 'bg-gray-700/50 text-gray-600' : 'bg-gray-100/80 text-gray-400'
          }`}
        >
          Aguardando cozinha…
        </div>
      </div>
    </motion.div>
  )
}
