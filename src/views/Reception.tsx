import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Scan, Timer, CheckCircle, AlertCircle, ShoppingBag, Zap } from 'lucide-react'
import { subscribeMenuItems, createOrder, resolveFicha, setActiveSession, clearActiveSession } from '../services/firebaseService'
import { useApp } from '../App'
import type { MenuItem } from '../types'

interface SessionItem {
  name: string
  quantity: number
  sector: string
  price: number
  completed: boolean
}

interface Session {
  ficha: string
  items: SessionItem[]
}

function playOrderSentSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const notes = [784, 988, 1175, 988, 1175]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = freq; osc.type = 'triangle'
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.1)
      gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + i * 0.1 + 0.04)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.2)
      osc.start(ctx.currentTime + i * 0.1)
      osc.stop(ctx.currentTime + i * 0.1 + 0.2)
    })
  } catch { /* audio not available */ }
}

function playProductAddSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.frequency.value = 880; osc.type = 'sine'
    gain.gain.setValueAtTime(0.2, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.15)
  } catch { /* audio not available */ }
}

const COUNTDOWN_SECONDS = 14

export default function Reception() {
  const { addToast } = useApp()
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [session, setSession] = useState<Session | null>(null)
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS)
  const [lastScan, setLastScan] = useState<{ type: 'ficha' | 'product' | 'error'; label: string } | null>(null)
  const [sending, setSending] = useState(false)
  const [lastSent, setLastSent] = useState<string | null>(null)

  // Refs to avoid stale closures in callbacks
  const sessionRef = useRef<Session | null>(null)
  const menuItemsRef = useRef<MenuItem[]>([])
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const bufferRef = useRef('')
  const lastKeyTimeRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    sessionRef.current = session
    if (session) {
      setActiveSession({ ficha: session.ficha, items: session.items.map(i => ({ name: i.name, quantity: i.quantity, sector: i.sector })) })
    } else {
      clearActiveSession()
    }
  }, [session])
  useEffect(() => { menuItemsRef.current = menuItems }, [menuItems])

  useEffect(() => {
    const unsub = subscribeMenuItems(setMenuItems)
    return unsub
  }, [])

  // ── Submit current session ───────────────────────────────────────────────

  const submitSession = useCallback(async (sessionData?: Session) => {
    const s = sessionData ?? sessionRef.current
    if (!s || s.items.length === 0) {
      if (s && s.items.length === 0) {
        setSession(null)
        sessionRef.current = null
      }
      return
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
      countdownIntervalRef.current = null
    }
    setSending(true)
    try {
      await createOrder(s.ficha, s.items)
      playOrderSentSound()
      setLastSent(s.ficha)
      setSession(null)
      sessionRef.current = null
      setCountdown(COUNTDOWN_SECONDS)
      setLastScan(null)
    } catch {
      addToast('Erro ao enviar pedido para a cozinha')
    } finally {
      setSending(false)
    }
  }, [addToast])

  // ── Start / reset 14s countdown ──────────────────────────────────────────

  const startCountdown = useCallback(() => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
    setCountdown(COUNTDOWN_SECONDS)
    let remaining = COUNTDOWN_SECONDS
    countdownIntervalRef.current = setInterval(() => {
      remaining--
      setCountdown(remaining)
      if (remaining <= 0) {
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
        submitSession()
      }
    }, 1000)
  }, [submitSession])

  // ── Process QR scan ──────────────────────────────────────────────────────

  const processQrScan = useCallback(async (raw: string) => {
    const items = menuItemsRef.current

    // Extract first 4 digits from QR (product code detection)
    const digits = raw.replace(/\D/g, '')
    const codePrefix = digits.substring(0, 4).padStart(4, '0')
    const matchedProduct = items.find(m => m.code && m.code === codePrefix)

    if (matchedProduct) {
      // It's a product coupon
      if (!sessionRef.current) {
        setLastScan({ type: 'error', label: 'Bipe a ficha primeiro!' })
        return
      }
      playProductAddSound()
      setLastScan({ type: 'product', label: `+1 ${matchedProduct.name}` })
      setSession(prev => {
        if (!prev) return prev
        const existing = prev.items.find(i => i.name === matchedProduct.name)
        const updated: Session = existing
          ? { ...prev, items: prev.items.map(i => i.name === matchedProduct.name ? { ...i, quantity: i.quantity + 1 } : i) }
          : { ...prev, items: [...prev.items, { name: matchedProduct.name, quantity: 1, sector: matchedProduct.sector, price: matchedProduct.price, completed: false }] }
        sessionRef.current = updated
        return updated
      })
      startCountdown()
      return
    }

    // Try as ficha
    try {
      const ticket = await resolveFicha(raw)
      if (!ticket) return

      const current = sessionRef.current

      if (!current) {
        // Start new session
        const newSession: Session = { ficha: ticket, items: [] }
        setSession(newSession)
        sessionRef.current = newSession
        setLastScan({ type: 'ficha', label: `Ficha #${ticket} aberta` })
        startCountdown()
      } else if (current.ficha !== ticket) {
        // New ficha — submit current immediately, start new
        await submitSession(current)
        const newSession: Session = { ficha: ticket, items: [] }
        setSession(newSession)
        sessionRef.current = newSession
        setLastScan({ type: 'ficha', label: `Ficha #${ticket} aberta` })
        startCountdown()
      } else {
        // Same ficha — reset timer
        setLastScan({ type: 'ficha', label: `Ficha #${ticket} (continuando)` })
        startCountdown()
      }
    } catch {
      addToast('Erro ao processar QR Code')
    }
  }, [startCountdown, submitSession, addToast])

  // ── QR scanner keydown handler ───────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (bufferRef.current.length > 0) {
          e.preventDefault(); e.stopPropagation()
          if (timerRef.current) clearTimeout(timerRef.current)
          const val = bufferRef.current.trim()
          bufferRef.current = ''; lastKeyTimeRef.current = 0
          if (val) processQrScan(val)
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
          if (val) processQrScan(val)
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
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
    }
  }, [processQrScan])

  // ── Render ───────────────────────────────────────────────────────────────

  const totalItems = session?.items.reduce((s, i) => s + i.quantity, 0) ?? 0
  const countdownPct = (countdown / COUNTDOWN_SECONDS) * 100
  const sectors = session ? Array.from(new Set(session.items.map(i => i.sector))) : []

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <h1 className="font-serif italic text-3xl text-accent-dark">Recepção</h1>
          <p className="text-gray-500 text-sm">Bipe a ficha e os cupons dos produtos</p>
        </div>

        {/* Last sent confirmation */}
        <AnimatePresence>
          {lastSent && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              onAnimationComplete={() => setTimeout(() => setLastSent(null), 3000)}
              className="mb-4 flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl px-4 py-3"
            >
              <CheckCircle size={18} className="text-green-500 shrink-0" />
              <p className="text-green-700 text-sm font-medium">
                Pedido da Ficha <strong>#{lastSent}</strong> enviado para a cozinha!
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Last scan indicator */}
        <AnimatePresence>
          {lastScan && (
            <motion.div
              key={lastScan.label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className={`mb-4 flex items-center gap-3 rounded-2xl px-4 py-3 ${
                lastScan.type === 'ficha' ? 'bg-blue-50 border border-blue-200' :
                lastScan.type === 'product' ? 'bg-accent/10 border border-accent/20' :
                'bg-red-50 border border-red-200'
              }`}
            >
              {lastScan.type === 'error'
                ? <AlertCircle size={18} className="text-red-500 shrink-0" />
                : <Scan size={18} className={lastScan.type === 'ficha' ? 'text-blue-500' : 'text-accent'} />}
              <p className={`text-sm font-medium ${
                lastScan.type === 'ficha' ? 'text-blue-700' :
                lastScan.type === 'product' ? 'text-accent-dark' :
                'text-red-700'
              }`}>{lastScan.label}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main session card */}
        <AnimatePresence>
          {!session ? (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-white rounded-3xl shadow-sm p-12 text-center"
            >
              <motion.div
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Scan size={56} className="mx-auto text-gray-200 mb-4" />
              </motion.div>
              <p className="text-gray-400 font-medium">Aguardando leitura da ficha...</p>
              <p className="text-gray-300 text-sm mt-1">Bipe o QR Code da ficha para começar</p>
            </motion.div>
          ) : (
            <motion.div
              key="session"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="bg-white rounded-3xl shadow-sm overflow-hidden"
            >
              {/* Ficha header */}
              <div className="bg-accent px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="text-white/60 text-xs uppercase tracking-widest">Ficha ativa</p>
                  <p className="text-white font-black text-3xl">#{session.ficha}</p>
                </div>
                <div className="text-right">
                  <p className="text-white/60 text-xs">{totalItems} item(ns)</p>
                  <button
                    onClick={() => submitSession()}
                    disabled={sending || totalItems === 0}
                    className="mt-1 flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs px-3 py-1.5 rounded-xl font-medium transition-colors disabled:opacity-40"
                  >
                    <Zap size={13} />
                    Enviar agora
                  </button>
                </div>
              </div>

              {/* Countdown bar */}
              <div className="h-2 bg-gray-100 relative">
                <motion.div
                  className={`absolute left-0 top-0 h-full transition-colors ${
                    countdown <= 3 ? 'bg-red-400' : countdown <= 7 ? 'bg-orange-400' : 'bg-green-400'
                  }`}
                  style={{ width: `${countdownPct}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              <div className="px-6 py-3 flex items-center gap-2 bg-gray-50 border-b border-gray-100">
                <Timer size={14} className="text-gray-400" />
                <p className="text-xs text-gray-500">
                  Envio automático em <strong className={countdown <= 3 ? 'text-red-500' : 'text-gray-700'}>{countdown}s</strong>
                  {' — '}bipe mais produtos ou uma nova ficha
                </p>
              </div>

              {/* Items per sector */}
              <div className="p-4">
                {session.items.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <ShoppingBag size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Bipe os cupons dos produtos</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sectors.map(sector => (
                      <div key={sector}>
                        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">{sector}</p>
                        <div className="space-y-1.5">
                          {session.items.filter(i => i.sector === sector).map((item, idx) => (
                            <motion.div
                              key={item.name}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.05 }}
                              className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2"
                            >
                              <span className="text-sm text-gray-700 font-medium">{item.name}</span>
                              <span className="text-sm font-black text-accent-dark bg-white rounded-lg px-2 py-0.5 border border-gray-200">
                                ×{item.quantity}
                              </span>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Instruction footer */}
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          {[
            { icon: '🎫', label: 'Bipe a ficha' },
            { icon: '🍽️', label: 'Bipe os cupons' },
            { icon: '⏱️', label: '14s → envia' },
          ].map(({ icon, label }) => (
            <div key={label} className="bg-white rounded-2xl p-3 shadow-sm">
              <div className="text-2xl mb-1">{icon}</div>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
