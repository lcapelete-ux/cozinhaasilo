import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { subscribeOrders } from '../services/firebaseService'
import type { Order } from '../types'

const CAIPIRA_MESSAGES = [
  'Uai sô! Ficha #{n} tá prontinha!',
  'Ocê pode vir buscar! Ficha #{n} tá pronta!',
  'Misericórdia! Ficha #{n} saiu quentinha!',
  'Vixe Maria! Ficha #{n} tá te esperando!',
  'Trem bom demais! Ficha #{n} pronta!',
  'Arrepia! Ficha #{n} saiu fresquinha!',
  'Bão demais da conta! Ficha #{n} prontinha!',
]

function getCaipiraMessage(ticket: string): string {
  const idx = Math.floor(Math.random() * CAIPIRA_MESSAGES.length)
  return CAIPIRA_MESSAGES[idx].replace('{n}', ticket)
}

function playChime() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const notes = [523, 659, 784, 1047]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = freq
      osc.type = 'sine'
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.15)
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + i * 0.15 + 0.05)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.4)
      osc.start(ctx.currentTime + i * 0.15)
      osc.stop(ctx.currentTime + i * 0.15 + 0.4)
    })
  } catch {
    // audio not available
  }
}

export default function Display() {
  const [readyOrders, setReadyOrders] = useState<Order[]>([])
  const [announcement, setAnnouncement] = useState<{ ticket: string; message: string } | null>(null)
  const prevTicketsRef = useRef<Set<string>>(new Set())
  const announcementTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const unsub = subscribeOrders(['ready'], (orders) => {
      const newTickets = new Set(orders.map((o) => o.ticket_number))

      // Find newly appeared tickets
      orders.forEach((order) => {
        if (!prevTicketsRef.current.has(order.ticket_number)) {
          playChime()
          const message = getCaipiraMessage(order.ticket_number)
          setAnnouncement({ ticket: order.ticket_number, message })
          if (announcementTimerRef.current) clearTimeout(announcementTimerRef.current)
          announcementTimerRef.current = setTimeout(() => setAnnouncement(null), 5000)
        }
      })

      prevTicketsRef.current = newTickets
      setReadyOrders(orders)
    })
    return () => {
      unsub()
      if (announcementTimerRef.current) clearTimeout(announcementTimerRef.current)
    }
  }, [])

  return (
    <div className="min-h-screen bg-[#1a1004] text-white overflow-hidden relative">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)',
        backgroundSize: '20px 20px',
      }} />

      {/* Announcement banner */}
      <AnimatePresence>
        {announcement && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="relative z-10 bg-amber-500 text-amber-900 text-center py-4 px-6"
          >
            <p className="font-serif italic text-2xl md:text-3xl font-bold">
              {announcement.message}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="relative z-10 text-center py-8 px-4">
        <div className="text-5xl mb-2">🌽</div>
        <h1 className="font-serif italic text-4xl md:text-5xl text-amber-400">Arraiá do</h1>
        <h2 className="font-serif italic text-2xl md:text-3xl text-amber-300">Lar São Cristóvão</h2>
        <div className="mt-3 inline-block bg-amber-500/20 border border-amber-500/40 rounded-2xl px-4 py-1">
          <p className="text-amber-400 text-sm font-medium">
            {readyOrders.length === 0 ? 'Nenhum pedido pronto' : `${readyOrders.length} pedido(s) pronto(s)!`}
          </p>
        </div>
      </div>

      {/* Ready tickets grid */}
      <div className="relative z-10 px-6 pb-8">
        {readyOrders.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-white/30 text-xl font-serif italic">Aguardando pedidos...</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 max-w-6xl mx-auto">
            <AnimatePresence>
              {readyOrders.map((order) => (
                <motion.div
                  key={order.id}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  className="aspect-square bg-amber-500 rounded-2xl flex flex-col items-center justify-center shadow-lg shadow-amber-900/50"
                >
                  <span className="text-amber-900 text-xs font-medium">Ficha</span>
                  <span className="text-amber-900 text-2xl md:text-3xl font-black">
                    #{order.ticket_number}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="relative z-10 text-center pb-4">
        <p className="text-white/20 text-xs">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>
    </div>
  )
}
