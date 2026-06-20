import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Scan, Timer, CheckCircle, AlertCircle, ShoppingBag, Zap, History, PenLine, X, Plus, Minus, Send } from 'lucide-react'
import { subscribeMenuItems, createOrder, resolveFicha, setActiveSession, clearActiveSession, getActiveOrderByTicket, setOrderStatus } from '../services/firebaseService'
import { useApp } from '../App'
import { displayTicket, isCupomCode } from '../utils/ticket'
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

const COUNTDOWN_SECONDS = 45

interface SentOrder {
  ficha: string
  items: SessionItem[]
  sentAt: Date
}

// ── Manual Entry Drawer ──────────────────────────────────────────────────────

function ManualEntryDrawer({
  menuItems,
  onClose,
  onSend,
}: {
  menuItems: MenuItem[]
  onClose: () => void
  onSend: (ficha: string, items: SessionItem[]) => Promise<void>
}) {
  const [ficha, setFicha] = useState('')
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [sending, setSending] = useState(false)
  const fichaInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { fichaInputRef.current?.focus() }, [])

  const sectors = Array.from(new Set(menuItems.map(m => m.sector))).sort()
  const totalItems = Object.values(quantities).reduce((sum, q) => sum + q, 0)

  const handleSend = async () => {
    if (!ficha.trim() || totalItems === 0) return
    setSending(true)
    try {
      const items: SessionItem[] = menuItems
        .filter(m => (quantities[m.name] || 0) > 0)
        .map(m => ({ name: m.name, quantity: quantities[m.name], sector: m.sector, price: m.price, completed: false }))
      await onSend(ficha.trim(), items)
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 400 }}
        className="w-full max-w-lg bg-white rounded-t-3xl shadow-2xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <PenLine size={18} className="text-accent" />
            <h2 className="font-bold text-gray-800">Entrada Manual</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100 transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="px-5 py-4 border-b border-gray-100">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 block">Número da Ficha</label>
          <input
            ref={fichaInputRef}
            type="text"
            inputMode="numeric"
            value={ficha}
            onChange={e => setFicha(e.target.value.replace(/\D/g, ''))}
            placeholder="Ex: 42"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-2xl font-black text-accent-dark focus:outline-none focus:ring-2 focus:ring-accent/30 text-center"
          />
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-3">
          {sectors.map(sector => (
            <div key={sector} className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">{sector}</p>
              <div className="space-y-1.5">
                {menuItems.filter(m => m.sector === sector).map(item => (
                  <div key={item.name} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5">
                    <span className="text-sm text-gray-700 font-medium flex-1 mr-3">{item.name}</span>
                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={() => setQuantities(q => ({ ...q, [item.name]: Math.max(0, (q[item.name] || 0) - 1) }))}
                        className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 active:scale-95 transition"
                      >
                        <Minus size={13} />
                      </button>
                      <span className="w-6 text-center text-sm font-black text-accent-dark">
                        {quantities[item.name] || 0}
                      </span>
                      <button
                        onClick={() => setQuantities(q => ({ ...q, [item.name]: (q[item.name] || 0) + 1 }))}
                        className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center text-white hover:bg-accent-dark active:scale-95 transition"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-4 border-t border-gray-100">
          <button
            onClick={handleSend}
            disabled={sending || !ficha.trim() || totalItems === 0}
            className="w-full flex items-center justify-center gap-2 bg-accent text-white rounded-2xl py-3.5 font-bold text-base disabled:opacity-40 transition-colors hover:bg-accent-dark active:scale-[0.98]"
          >
            <Send size={16} />
            {sending ? 'Enviando...' : `Enviar para a cozinha${totalItems > 0 ? ` (${totalItems} item${totalItems !== 1 ? 's' : ''})` : ''}`}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export default function Reception() {
  const { addToast } = useApp()
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [session, setSession] = useState<Session | null>(null)
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS)
  const [lastScan, setLastScan] = useState<{ type: 'ficha' | 'product' | 'error'; label: string } | null>(null)
  const [sending, setSending] = useState(false)
  const [lastSent, setLastSent] = useState<string | null>(null)
  const [sentHistory, setSentHistory] = useState<SentOrder[]>([])
  const [showManual, setShowManual] = useState(false)

  // Refs to avoid stale closures in callbacks
  const sessionRef = useRef<Session | null>(null)
  const menuItemsRef = useRef<MenuItem[]>([])
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const bufferRef = useRef('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastKeyTimeRef = useRef(0)

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
      setSentHistory(prev => [{ ficha: s.ficha, items: s.items, sentAt: new Date() }, ...prev].slice(0, 20))
      setSession(null)
      sessionRef.current = null
      setCountdown(COUNTDOWN_SECONDS)
      setLastScan(null)
    } catch (err) {
      console.error('createOrder error:', err)
      addToast('Erro ao enviar pedido para a cozinha')
    } finally {
      setSending(false)
    }
  }, [addToast])

  const handleManualSend = useCallback(async (ficha: string, items: SessionItem[]) => {
    try {
      await createOrder(ficha, items)
      playOrderSentSound()
      setLastSent(ficha)
      setSentHistory(prev => [{ ficha, items, sentAt: new Date() }, ...prev].slice(0, 20))
      setShowManual(false)
    } catch (err) {
      console.error('manual createOrder error:', err)
      addToast('Erro ao enviar pedido manual')
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
  // QR do cupom físico: "0844-124791" → 4 primeiros dígitos = código do produto
  // Fichas: número puro 1–999 (String(n) sem zeros à esquerda, sem traços)

  const processQrScan = useCallback(async (raw: string) => {
    const items = menuItemsRef.current
    const rawTrimmed = raw.trim()
    const digits = rawTrimmed.replace(/\D/g, '')
    const first4 = digits.substring(0, 4)

    // Tenta match de produto para qualquer código de 4+ dígitos cadastrado no cardápio.
    // Isso suporta tanto códigos padrão 08XX/09XX quanto códigos personalizados (ex: 1120).
    if (digits.length >= 4) {
      const matchedProduct = items.find(m => m.code && first4 === m.code)

      if (matchedProduct) {
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

      // Código 08XX/09XX não cadastrado no cardápio → erro explícito
      if (/^0[89]/.test(first4)) {
        setLastScan({ type: 'error', label: `Código ${first4} não cadastrado — vá em Configurações → Cardápio` })
        return
      }
    }

    // Cupom de produto não cadastrado (formato "0844-124791") não pode cair no
    // fallback de ficha — os dígitos do cupom não são um número de ficha.
    if (isCupomCode(rawTrimmed)) {
      setLastScan({ type: 'error', label: 'Código de produto não cadastrado — vá em Configurações → Cardápio' })
      return
    }

    // É uma ficha (1–200)
    try {
      const ticket = await resolveFicha(raw)
      if (!ticket) return

      const current = sessionRef.current

      // Check for existing active order first
      const existing = await getActiveOrderByTicket(ticket)

      // Ready order → confirm delivery immediately (single-computer: Reception intercepts all scans)
      if (existing?.status === 'ready') {
        await setOrderStatus(existing.id, 'delivered')
        setLastScan({ type: 'ficha', label: `Ficha #${displayTicket(ticket)} entregue!` })
        return
      }

      if (!current) {
        if (existing) {
          setLastScan({ type: 'error', label: `Ficha #${displayTicket(ticket)} já está na cozinha (em preparo)` })
          return
        }
        const newSession: Session = { ficha: ticket, items: [] }
        setSession(newSession)
        sessionRef.current = newSession
        setLastScan({ type: 'ficha', label: `Ficha #${displayTicket(ticket)} aberta` })
        startCountdown()
      } else if (current.ficha !== ticket) {
        if (existing) {
          setLastScan({ type: 'error', label: `Ficha #${displayTicket(ticket)} já está na cozinha (em preparo)` })
          return
        }
        await submitSession(current)
        const newSession: Session = { ficha: ticket, items: [] }
        setSession(newSession)
        sessionRef.current = newSession
        setLastScan({ type: 'ficha', label: `Ficha #${displayTicket(ticket)} aberta` })
        startCountdown()
      } else {
        setLastScan({ type: 'ficha', label: `Ficha #${displayTicket(ticket)} (continuando)` })
        startCountdown()
      }
    } catch {
      addToast('Erro ao processar QR Code')
    }
  }, [startCountdown, submitSession, addToast])

  // ── QR scanner keydown handler ───────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) return
      if (e.key === 'Enter') {
        e.preventDefault(); e.stopPropagation()
        if (timerRef.current) clearTimeout(timerRef.current)
        const val = bufferRef.current.trim()
        bufferRef.current = ''
        if (val.length >= 1) processQrScan(val)
        return
      }
      if (e.key.length !== 1) return
      e.preventDefault(); e.stopPropagation()
      // Use the event's own timestamp, not Date.now(): under heavy render
      // load the 150ms cleanup timer can fire late, letting leftover digits
      // from a previous scan bleed into the next one. Comparing real key
      // timestamps catches that gap even when the JS thread is backed up.
      const now = e.timeStamp
      if (bufferRef.current && now - lastKeyTimeRef.current > 300) bufferRef.current = ''
      lastKeyTimeRef.current = now
      bufferRef.current += e.key
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        const val = bufferRef.current.trim()
        bufferRef.current = ''
        if (val.length >= 2) processQrScan(val)
      }, 150)
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
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-serif italic text-3xl text-accent-dark">Recepção</h1>
            <p className="text-gray-500 text-sm">Bipe a ficha e os cupons dos produtos</p>
          </div>
          <button
            onClick={() => setShowManual(true)}
            className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 rounded-2xl px-4 py-2.5 text-sm font-medium shadow-sm hover:bg-gray-50 transition-colors"
          >
            <PenLine size={15} className="text-accent" />
            Manual
          </button>
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
                  <p className="text-white font-black text-3xl">#{displayTicket(session.ficha)}</p>
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
                    countdown <= 3 ? 'bg-red-400' : countdown <= 6 ? 'bg-orange-400' : 'bg-green-400'
                  }`}
                  style={{ width: `${countdownPct}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              <div className="px-6 py-3 flex items-center gap-2 bg-gray-50 border-b border-gray-100">
                <Timer size={14} className="text-gray-400" />
                <p className="text-xs text-gray-500">
                  Enviando em <strong className={countdown <= 2 ? 'text-red-500' : 'text-gray-700'}>{countdown}s</strong>
                  {' — '}bipe mais produtos ou pressione Enviar agora
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
            { icon: '⏱️', label: '12s → envia' },
          ].map(({ icon, label }) => (
            <div key={label} className="bg-white rounded-2xl p-3 shadow-sm">
              <div className="text-2xl mb-1">{icon}</div>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          ))}
        </div>

        {/* Sent orders history */}
        {sentHistory.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-3">
              <History size={16} className="text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Pedidos enviados hoje</h2>
            </div>
            <div className="space-y-2">
              <AnimatePresence>
                {sentHistory.map((order, idx) => (
                  <motion.div
                    key={`${order.ficha}-${order.sentAt.getTime()}`}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx === 0 ? 0 : 0 }}
                    className="bg-white rounded-2xl shadow-sm px-4 py-3 flex items-start justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
                        <CheckCircle size={18} className="text-green-500" />
                      </div>
                      <div>
                        <p className="font-bold text-accent-dark text-sm">Ficha #{displayTicket(order.ficha)}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {order.items.map(i => `${i.name} ×${i.quantity}`).join(' · ')}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-300 shrink-0 mt-1">
                      {order.sentAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>

      {/* Manual entry drawer */}
      <AnimatePresence>
        {showManual && (
          <ManualEntryDrawer
            menuItems={menuItems}
            onClose={() => setShowManual(false)}
            onSend={handleManualSend}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
