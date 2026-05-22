import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChefHat, ArrowRight, Clock } from 'lucide-react'
import { subscribeOrders, advanceOrderStatus } from '../services/firebaseService'
import { useApp } from '../App'
import StatusBadge from '../components/StatusBadge'
import type { Order } from '../types'

export default function Kitchen() {
  const { addToast } = useApp()
  const [orders, setOrders] = useState<Order[]>([])

  useEffect(() => {
    const unsub = subscribeOrders(['pending', 'preparing'], setOrders)
    return unsub
  }, [])

  const handleAdvance = async (order: Order) => {
    try {
      await advanceOrderStatus(order.id, order.status)
    } catch {
      addToast('Erro ao atualizar pedido')
    }
  }

  const pending = orders.filter((o) => o.status === 'pending')
  const preparing = orders.filter((o) => o.status === 'preparing')

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <ChefHat className="text-accent" size={28} />
        <div>
          <h1 className="font-serif italic text-3xl text-accent-dark">Cozinha Geral</h1>
          <p className="text-gray-500 text-sm">{orders.length} pedido(s) em andamento</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Column
          title="Aguardando"
          count={pending.length}
          color="yellow"
          orders={pending}
          onAdvance={handleAdvance}
          actionLabel="Iniciar preparo"
        />
        <Column
          title="Preparando"
          count={preparing.length}
          color="blue"
          orders={preparing}
          onAdvance={handleAdvance}
          actionLabel="Marcar como pronto"
        />
      </div>
    </div>
  )
}

function Column({
  title,
  count,
  color,
  orders,
  onAdvance,
  actionLabel,
}: {
  title: string
  count: number
  color: 'yellow' | 'blue'
  orders: Order[]
  onAdvance: (o: Order) => void
  actionLabel: string
}) {
  const headerColor = color === 'yellow' ? 'text-yellow-600' : 'text-blue-600'
  const countBg = color === 'yellow' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'

  return (
    <div className="bg-white rounded-3xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <h2 className={`font-serif italic text-xl ${headerColor}`}>{title}</h2>
        <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${countBg}`}>{count}</span>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <ChefHat size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhum pedido</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {orders.map((order) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="border border-gray-100 rounded-2xl p-3"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className="font-bold text-lg text-accent-dark">#{order.ticket_number}</span>
                    <StatusBadge status={order.status} />
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <Clock size={12} />
                    {formatAge(order.created_at)}
                  </div>
                </div>

                <ul className="space-y-1 mb-3">
                  {order.items.map((item, i) => (
                    <li key={i} className="flex justify-between text-sm">
                      <span className="text-gray-700">{item.name}</span>
                      <span className="text-gray-400 text-xs">x{item.quantity} · {item.sector}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => onAdvance(order)}
                  className="w-full flex items-center justify-center gap-1.5 bg-accent/10 hover:bg-accent/20 text-accent-dark text-sm py-2 rounded-xl transition-colors font-medium"
                >
                  {actionLabel}
                  <ArrowRight size={14} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

function formatAge(date: Date): string {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000)
  if (mins < 1) return 'agora'
  if (mins === 1) return '1 min'
  return `${mins} min`
}
