import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'
import { subscribeOrders } from '../services/firebaseService'
import type { Order, ViewName } from '../types'

const LATE_MS = 10 * 60 * 1000 // 10 minutes

// Only show alert on internal production panels
const INTERNAL_VIEWS: ViewName[] = ['kitchen', 'kitchen-scanner', 'kitchen-sectors', 'dispatch']

function formatDelay(ms: number): string {
  const mins = Math.floor(ms / 60_000)
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

function playLateAlert() {
  try {
    const ctx = new AudioContext()
    // 3 short urgent beeps — distinct from the ready sound
    ;[0, 0.22, 0.44].forEach((offset) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = 1100
      gain.gain.setValueAtTime(0, ctx.currentTime + offset)
      gain.gain.linearRampToValueAtTime(0.45, ctx.currentTime + offset + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.18)
      osc.start(ctx.currentTime + offset)
      osc.stop(ctx.currentTime + offset + 0.2)
    })
  } catch { /* audio not available */ }
}

interface Props {
  currentView: ViewName
}

export default function LateOrdersAlert({ currentView }: Props) {
  const [orders, setOrders] = useState<Order[]>([])
  const [now, setNow] = useState(Date.now())
  const prevLateCount = useRef(0)

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

  // Play sound when new late orders appear
  useEffect(() => {
    if (late.length > prevLateCount.current) playLateAlert()
    prevLateCount.current = late.length
  }, [late.length])

  // Only render on internal kitchen views
  if (!INTERNAL_VIEWS.includes(currentView)) return null
  if (late.length === 0) return null

  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 flex flex-wrap items-center justify-center gap-2 max-w-[92vw]">
      <AnimatePresence>
        {late.map((order) => {
          const delay = now - order.created_at.getTime()
          return (
            <motion.div
              key={order.id}
              layout
              initial={{ opacity: 0, scale: 0.7, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.7, y: -10 }}
              className="flex items-center gap-1.5 bg-red-500 text-white pl-2.5 pr-3 py-1.5 rounded-full shadow-lg text-xs font-bold whitespace-nowrap"
            >
              <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1.2, repeat: Infinity }}>
                <AlertTriangle size={12} className="shrink-0" />
              </motion.div>
              #{order.ticket_number}
              <span className="text-red-100 font-semibold">· {formatDelay(delay)}</span>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
