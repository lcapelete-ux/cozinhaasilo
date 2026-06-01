import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { subscribeOrders } from '../services/firebaseService'
import type { Order } from '../types'

const LATE_MS = 10 * 60 * 1000 // 10 minutes

function formatDelay(ms: number): string {
  const mins = Math.floor(ms / 60_000)
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

export default function LateOrdersAlert() {
  const [orders, setOrders] = useState<Order[]>([])
  const [now, setNow] = useState(Date.now())
  const [expanded, setExpanded] = useState(true)

  useEffect(() => {
    const unsub = subscribeOrders(['pending', 'preparing'], setOrders)
    return unsub
  }, [])

  // Refresh time every 30s so delays stay accurate
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  const late = orders.filter((o) => now - o.created_at.getTime() > LATE_MS)

  // Auto-expand whenever a new late order appears
  useEffect(() => {
    if (late.length > 0) setExpanded(true)
  }, [late.length])

  if (late.length === 0) return null

  return (
    <div className="fixed bottom-4 left-4 md:left-24 z-50 w-60">
      {/* Header button */}
      <motion.button
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-2xl shadow-lg transition-colors"
      >
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        >
          <AlertTriangle size={14} className="shrink-0" />
        </motion.div>
        <span className="text-xs font-bold flex-1 text-left">
          {late.length} ficha{late.length > 1 ? 's' : ''} atrasada{late.length > 1 ? 's' : ''}
        </span>
        {expanded ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
      </motion.button>

      {/* Expandable list */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -4 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-1 bg-white rounded-2xl shadow-lg border border-red-100 overflow-hidden">
              {late.map((order, i) => {
                const delay = now - order.created_at.getTime()
                return (
                  <div
                    key={order.id}
                    className={`flex items-center justify-between px-3 py-2 ${
                      i > 0 ? 'border-t border-gray-100' : ''
                    }`}
                  >
                    <span className="font-black text-gray-800 text-sm">
                      #{order.ticket_number}
                    </span>
                    <span className="text-xs font-semibold text-red-500 bg-red-50 px-2 py-0.5 rounded-lg">
                      {formatDelay(delay)}
                    </span>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
