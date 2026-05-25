import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChefHat, UtensilsCrossed } from 'lucide-react'
import { subscribeOrders, setOrderStatus, resolveFicha } from '../services/firebaseService'
import type { Order } from '../types'

// ── Bunting flags ────────────────────────────────────────────────────────────
const FLAG_COLORS = ['#FFD700', '#FF4444', '#44BB44', '#4488FF', '#FF8800', '#CC44CC', '#FFD700', '#FF4444', '#44BB44', '#4488FF', '#FF8800', '#CC44CC', '#FFD700', '#FF4444', '#44BB44', '#4488FF', '#FF8800']

function Bunting() {
  return (
    <div className="relative w-full overflow-hidden" style={{ height: 36 }}>
      <svg width="100%" height="36" preserveAspectRatio="none">
        {/* String */}
        <path d="M0,8 Q50,4 100,8 Q150,12 200,8 Q250,4 300,8 Q350,12 400,8 Q450,4 500,8 Q550,12 600,8 Q650,4 700,8 Q750,12 800,8 Q850,4 900,8 Q950,12 1000,8 Q1100,4 1200,8 Q1300,12 1400,8" stroke="#888" strokeWidth="1.5" fill="none" />
        {FLAG_COLORS.map((color, i) => {
          const x = (i / (FLAG_COLORS.length - 1)) * 1400
          return (
            <polygon
              key={i}
              points={`${x - 10},4 ${x + 10},4 ${x},28`}
              fill={color}
              opacity={0.95}
            />
          )
        })}
      </svg>
    </div>
  )
}

// ── Animated fire ────────────────────────────────────────────────────────────
function FireAnimated({ size = 48 }: { size?: number }) {
  return (
    <motion.div
      style={{ fontSize: size, lineHeight: 1, display: 'inline-block', originY: 1 }}
      animate={{
        scaleY: [1, 1.08, 0.95, 1.06, 1],
        scaleX: [1, 0.96, 1.04, 0.97, 1],
        rotate: [-2, 2, -1, 3, -2],
      }}
      transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
    >
      🔥
    </motion.div>
  )
}

// ── Clock ────────────────────────────────────────────────────────────────────
function Clock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  const h = String(time.getHours()).padStart(2, '0')
  const m = String(time.getMinutes()).padStart(2, '0')
  return (
    <span className="font-black text-3xl md:text-4xl tabular-nums" style={{ color: '#FF8800' }}>
      {h}<motion.span animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1, repeat: Infinity }}>:</motion.span>{m}
    </span>
  )
}

// ── Sound ────────────────────────────────────────────────────────────────────
function playChime() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const notes = [523, 659, 784, 1047]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = freq; osc.type = 'sine'
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.15)
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + i * 0.15 + 0.05)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.4)
      osc.start(ctx.currentTime + i * 0.15)
      osc.stop(ctx.currentTime + i * 0.15 + 0.4)
    })
  } catch { /* audio not available */ }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function dedup(orders: Order[]): Order[] {
  const seen = new Set<string>()
  return orders.filter((o) => {
    if (seen.has(o.ticket_number)) return false
    seen.add(o.ticket_number)
    return true
  })
}

// ── Main Display ─────────────────────────────────────────────────────────────
export default function Display() {
  const [activeOrders, setActiveOrders] = useState<Order[]>([])
  const [readyOrders, setReadyOrders] = useState<Order[]>([])
  const [announcement, setAnnouncement] = useState<string | null>(null)
  const [deliveredMsg, setDeliveredMsg] = useState<string | null>(null)
  const prevReadyRef = useRef<Set<string>>(new Set())
  const announcementTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const deliveredTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const readyOrdersRef = useRef<Order[]>([])
  const activeOrdersRef = useRef<Order[]>([])
  const bufferRef = useRef('')
  const lastKeyTimeRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const deliveryInputRef = useRef<HTMLInputElement>(null)
  const [deliveryInput, setDeliveryInput] = useState('')

  useEffect(() => {
    readyOrdersRef.current = readyOrders
  }, [readyOrders])

  useEffect(() => {
    activeOrdersRef.current = activeOrders
  }, [activeOrders])

  const confirmDelivery = useCallback(async (raw: string) => {
    const ticket = await resolveFicha(raw)
    const order =
      readyOrdersRef.current.find((o) => o.ticket_number === ticket) ??
      activeOrdersRef.current.find((o) => o.ticket_number === ticket)
    if (!order) return
    await setOrderStatus(order.id, 'delivered')
    setDeliveredMsg(ticket)
    if (deliveredTimer.current) clearTimeout(deliveredTimer.current)
    deliveredTimer.current = setTimeout(() => setDeliveredMsg(null), 4000)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (document.activeElement === deliveryInputRef.current) return
      if (e.key === 'Enter') {
        if (bufferRef.current.length > 0) {
          e.preventDefault(); e.stopPropagation()
          if (timerRef.current) clearTimeout(timerRef.current)
          const val = bufferRef.current.trim()
          bufferRef.current = ''; lastKeyTimeRef.current = 0
          if (val) confirmDelivery(val)
        }
        return
      }
      if (e.key.length !== 1) return
      const now = Date.now()
      const delta = now - lastKeyTimeRef.current
      if (lastKeyTimeRef.current !== 0 && delta < 80) {
        e.preventDefault(); e.stopPropagation()
        bufferRef.current += e.key
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
          const val = bufferRef.current.trim()
          bufferRef.current = ''; lastKeyTimeRef.current = 0
          if (val) confirmDelivery(val)
        }, 150)
      } else {
        bufferRef.current = e.key
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => { bufferRef.current = '' }, 200)
      }
      lastKeyTimeRef.current = now
    }
    window.addEventListener('keydown', handler, { capture: true })
    return () => {
      window.removeEventListener('keydown', handler, { capture: true })
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [confirmDelivery])

  useEffect(() => {
    const unsub1 = subscribeOrders(['pending', 'preparing'], (orders) => setActiveOrders(dedup(orders)))
    return unsub1
  }, [])

  useEffect(() => {
    const unsub2 = subscribeOrders(['ready'], (orders) => {
      const unique = dedup(orders)
      unique.forEach((o) => {
        if (!prevReadyRef.current.has(o.ticket_number)) {
          setAnnouncement(o.ticket_number)
          if (announcementTimer.current) clearTimeout(announcementTimer.current)
          announcementTimer.current = setTimeout(() => setAnnouncement(null), 5000)
        }
      })
      prevReadyRef.current = new Set(unique.map((o) => o.ticket_number))
      setReadyOrders(unique)
    })
    return () => {
      unsub2()
      if (announcementTimer.current) clearTimeout(announcementTimer.current)
      if (deliveredTimer.current) clearTimeout(deliveredTimer.current)
    }
  }, [])

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#111111' }}>
      {/* Bunting */}
      <Bunting />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ background: '#1a1a1a' }}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
            style={{ background: 'linear-gradient(135deg, #FF6B00, #FF2200)' }}>
            🔥
          </div>
          <div>
            <h1 className="font-black text-xl md:text-2xl uppercase italic tracking-wide"
              style={{ color: '#FFD700', textShadow: '0 0 20px rgba(255,200,0,0.5)' }}>
              Arraiá do Lar São Cristóvão
            </h1>
            <p className="text-xs font-semibold tracking-widest" style={{ color: '#FF8800' }}>
              ✦ Festa de São João 2026
            </p>
          </div>
        </div>
        <Clock />
      </div>

      {/* Ready announcement banner */}
      <AnimatePresence>
        {announcement && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
            style={{ background: '#FFD700' }}
          >
            <p className="text-center py-3 font-black text-xl text-black uppercase tracking-wide">
              🎉 Uai sô! Ficha #{announcement} tá prontinha no balcão! 🎉
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delivered confirmation banner */}
      <AnimatePresence>
        {deliveredMsg && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
            style={{ background: '#44BB44' }}
          >
            <p className="text-center py-3 font-black text-xl text-white uppercase tracking-wide">
              ✅ Ficha #{deliveredMsg} entregue! Pode usar de novo, sô! 🎊
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main panels */}
      <div className="flex flex-1 divide-x divide-white/10">
        {/* LEFT — Em produção */}
        <div className="flex-1 flex flex-col" style={{ background: '#161616' }}>
          {/* Panel header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <motion.div
                animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="w-3 h-3 rounded-full bg-orange-500"
              />
              <h2 className="font-black text-lg md:text-xl uppercase italic tracking-wide text-orange-400">
                Esquentando o Fuzuê
              </h2>
            </div>
            <ChefHat size={22} className="text-white/30" />
          </div>

          {/* Orders list */}
          <div className="flex-1 p-4 overflow-auto">
            {activeOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 opacity-30">
                <ChefHat size={48} className="text-white" strokeWidth={1} />
                <p className="text-white/60 text-sm italic">Cozinha livre no momento</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <AnimatePresence>
                  {activeOrders.map((order) => (
                    <motion.div
                      key={order.id}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      className="rounded-2xl p-3 flex flex-col items-center gap-2"
                      style={{ background: '#222' }}
                    >
                      <FireAnimated size={36} />
                      <div className="text-center">
                        <p className="text-white/40 text-xs uppercase tracking-widest">Ficha</p>
                        <p className="font-black text-2xl text-white">#{order.ticket_number}</p>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — Pronto */}
        <div className="flex-1 flex flex-col" style={{ background: '#1a1a1a' }}>
          {/* Panel header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <motion.div
                animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
                transition={{ duration: 0.6, repeat: Infinity }}
                className="w-3 h-3 rounded-full bg-yellow-400"
              />
              <h2 className="font-black text-lg md:text-xl uppercase italic tracking-wide text-white">
                Tá no Ponto, Sô!
              </h2>
            </div>
            <span className="font-black text-xs px-3 py-1 rounded-full uppercase tracking-wider"
              style={{ background: '#FFD700', color: '#111' }}>
              Balcão
            </span>
          </div>

          {/* Ready list */}
          <div className="flex-1 p-4 overflow-auto">
            {readyOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 opacity-30">
                <UtensilsCrossed size={48} className="text-white" strokeWidth={1} />
                <p className="text-white/60 text-sm italic uppercase tracking-widest">O Arraiá tá começando...</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <AnimatePresence>
                  {readyOrders.map((order) => (
                    <motion.div
                      key={order.id}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      className="rounded-2xl p-3 flex flex-col items-center gap-2 border"
                      style={{ background: '#222', borderColor: '#FFD70040' }}
                    >
                      <div className="text-center">
                        <p className="text-yellow-400/60 text-xs uppercase tracking-widest">Ficha</p>
                        <motion.p
                          className="font-black text-4xl"
                          style={{ color: '#FFD700' }}
                          animate={{ scale: [1, 1.18, 1], textShadow: ['0 0 0px #FFD700', '0 0 24px #FFD700', '0 0 0px #FFD700'] }}
                          transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
                        >
                          #{order.ticket_number}
                        </motion.p>
                      </div>
                      <span className="text-xs font-bold px-3 py-0.5 rounded-full uppercase"
                        style={{ background: '#FFD700', color: '#111' }}>
                        Pronto!
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Manual delivery input — subtle footer for staff */}
      <form
        onSubmit={(e) => { e.preventDefault(); if (deliveryInput.trim()) { confirmDelivery(deliveryInput.trim()); setDeliveryInput('') } }}
        className="flex items-center justify-end gap-2 px-4 py-2"
        style={{ background: '#0d0d0d' }}
      >
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#555' }}>Confirmar entrega:</span>
        <input
          ref={deliveryInputRef}
          type="text"
          inputMode="numeric"
          placeholder="Nº ficha"
          value={deliveryInput}
          onChange={(e) => setDeliveryInput(e.target.value)}
          className="w-24 px-3 py-1.5 rounded-xl text-sm font-bold text-center focus:outline-none"
          style={{ background: '#222', color: '#FFD700', border: '1px solid #333' }}
        />
        <button type="submit"
          className="px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition-colors"
          style={{ background: '#333', color: '#FFD700' }}>
          OK
        </button>
      </form>
    </div>
  )
}
