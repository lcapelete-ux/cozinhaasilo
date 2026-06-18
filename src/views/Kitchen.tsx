import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChefHat, Clock, CheckCircle2, Loader2, BellRing, PackageCheck, type LucideIcon } from 'lucide-react'
import { subscribeAllOrders } from '../services/firebaseService'
import { displayTicket } from '../utils/ticket'
import type { Order, OrderStatus } from '../types'

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bg: string; border: string; Icon: LucideIcon }> = {
  pending:   { label: 'Aguardando', color: 'text-yellow-700', bg: 'bg-yellow-50',  border: 'border-yellow-200', Icon: Clock },
  preparing: { label: 'Preparando', color: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-200',   Icon: Loader2 },
  ready:     { label: 'Pronto',     color: 'text-green-700',  bg: 'bg-green-50',   border: 'border-green-200',  Icon: BellRing },
  delivered: { label: 'Entregue',   color: 'text-gray-500',   bg: 'bg-gray-50',    border: 'border-gray-200',   Icon: PackageCheck },
}

function formatTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

function formatAge(date: Date): string {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000)
  if (mins < 1) return 'agora'
  if (mins === 1) return '1 min atrás'
  if (mins < 60) return `${mins} min atrás`
  const h = Math.floor(mins / 60)
  return `${h}h atrás`
}

export default function Kitchen() {
  const [orders, setOrders] = useState<Order[]>([])
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const unsub = subscribeAllOrders(setOrders)
    return unsub
  }, [])

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(t)
  }, [])

  const counts = {
    pending: orders.filter((o) => o.status === 'pending').length,
    preparing: orders.filter((o) => o.status === 'preparing').length,
    ready: orders.filter((o) => o.status === 'ready').length,
    delivered: orders.filter((o) => o.status === 'delivered').length,
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <ChefHat className="text-accent" size={28} />
          <div>
            <h1 className="font-serif italic text-2xl md:text-3xl text-accent-dark">Cozinha Geral</h1>
            <p className="text-gray-400 text-xs uppercase tracking-widest mt-0.5">Histórico de pedidos</p>
          </div>
        </div>

        {/* Summary chips */}
        <div className="flex flex-wrap gap-2 justify-end">
          {(Object.entries(counts) as [OrderStatus, number][]).map(([status, count]) => {
            const cfg = STATUS_CONFIG[status]
            return (
              <div key={status} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                <cfg.Icon size={12} />
                {count} {cfg.label}
              </div>
            )
          })}
        </div>
      </div>

      {/* Order list */}
      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-300">
          <ChefHat size={56} strokeWidth={1} className="mb-4" />
          <p className="text-sm font-semibold tracking-widest uppercase">Nenhum pedido ainda</p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {orders.map((order) => {
              const cfg = STATUS_CONFIG[order.status]
              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className={`rounded-2xl border p-4 ${cfg.bg} ${cfg.border}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Left: ficha + items */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="font-black text-xl text-accent-dark">#{displayTicket(order.ticket_number)}</span>
                        <span className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-lg border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                          <cfg.Icon size={11} />
                          {cfg.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                        {order.items.map((item, i) => (
                          <span key={i} className="text-sm text-gray-600">
                            <span className="font-medium">{item.name}</span>
                            <span className="text-gray-400 text-xs"> ×{item.quantity}</span>
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Right: times */}
                    <div className="text-right shrink-0">
                      <p className="font-black text-lg tabular-nums text-gray-700">{formatTime(order.created_at)}</p>
                      <p className="text-xs text-gray-400" suppressHydrationWarning key={now}>{formatAge(order.created_at)}</p>
                    </div>
                  </div>

                  {/* Delivered: show update time too */}
                  {order.status === 'delivered' && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-400">
                      <CheckCircle2 size={11} />
                      Entregue às {formatTime(order.updated_at)}
                    </div>
                  )}
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
