import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Package, Check, QrCode, Keyboard, Hash, Moon, Sun, Clock, Flame, Beef, Drumstick, Plane } from 'lucide-react'
import { subscribeOrders, setOrderStatus, resolveFicha, getActiveOrderByTicket, getOrderByTicket, deleteOrder, subscribeAllOrders } from '../services/firebaseService'
import readySound from '../assets/ready.mp3'
import { useApp } from '../App'
import { isTakeoutTicket } from '../utils/ticket'
import type { Order, OrderStatus } from '../types'

const NIGHT_KEY = 'dispatch-night'

function playReadySound() {
  try {
    const ctx = new AudioContext()
    ;[0, 0.18].forEach((offset, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.type = 'sine'; osc.frequency.value = i === 0 ? 660 : 880
      gain.gain.setValueAtTime(0, ctx.currentTime + offset)
      gain.gain.linearRampToValueAtTime(0.7, ctx.currentTime + offset + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.22)
      osc.start(ctx.currentTime + offset); osc.stop(ctx.currentTime + offset + 0.25)
    })
  } catch { /* audio not available */ }
}

function playDeliveredSound() {
  try {
    const audio = new Audio(readySound)
    audio.play().catch(() => {})
  } catch { /* audio not available */ }
}

function playCancelSound() {
  try {
    const ctx = new AudioContext()
    ;[0, 0.16].forEach((offset, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.type = 'square'; osc.frequency.value = i === 0 ? 320 : 200
      gain.gain.setValueAtTime(0, ctx.currentTime + offset)
      gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + offset + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.25)
      osc.start(ctx.currentTime + offset); osc.stop(ctx.currentTime + offset + 0.28)
    })
  } catch { /* audio not available */ }
}

const SECTOR_STYLE: Record<string, { icon: React.ElementType; light: string; dark: string }> = {
  Fritadeira: { icon: Flame,    light: 'text-orange-500 bg-orange-50',  dark: 'text-orange-400 bg-orange-950/40' },
  Chapa:      { icon: Beef,     light: 'text-blue-500 bg-blue-50',      dark: 'text-blue-400 bg-blue-950/40' },
  Assados:    { icon: Drumstick,light: 'text-purple-500 bg-purple-50',  dark: 'text-purple-400 bg-purple-950/40' },
}

const STATUS_STYLE: Record<OrderStatus, { light: string; dark: string; label: string }> = {
  pending:   { light: 'bg-yellow-100 text-yellow-700 border-yellow-200', dark: 'bg-yellow-900/40 text-yellow-300 border-yellow-700', label: 'Aguardando' },
  preparing: { light: 'bg-blue-100 text-blue-700 border-blue-200',       dark: 'bg-blue-900/40 text-blue-300 border-blue-700',       label: 'Preparando' },
  ready:     { light: 'bg-green-100 text-green-700 border-green-200',    dark: 'bg-green-900/40 text-green-300 border-green-700',    label: 'Pronto! ✓' },
  delivered: { light: 'bg-gray-100 text-gray-500 border-gray-200',       dark: 'bg-gray-800 text-gray-400 border-gray-700',         label: 'Entregue' },
}

function formatAge(created: Date, now: number): string {
  const mins = Math.floor((now - created.getTime()) / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

interface CardProps {
  order: Order
  idx: number
  nightMode: boolean
  now: number
  onDeliver: (order: Order) => void
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

function OrderCard({ order, idx, nightMode: n, now, onDeliver }: CardProps) {
  const theme = CARD_THEME[order.status]
  const isReady = order.status === 'ready'
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

      {/* Diagonal slash for ready-but-not-delivered */}
      {isReady && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <line
            x1="100%" y1="0"
            x2="0"   y2="100%"
            stroke={nn ? 'rgba(74,222,128,0.18)' : 'rgba(34,197,94,0.30)'}
            strokeWidth="3"
          />
        </svg>
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
                {order.ticket_number}
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
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => isReady && onDeliver(order)}
          disabled={!isReady}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl font-bold text-sm transition-colors ${
            isReady
              ? nn
                ? 'bg-green-600 hover:bg-green-500 text-white'
                : 'bg-green-500 hover:bg-green-600 text-white'
              : nn
                ? 'bg-gray-700/50 text-gray-600 cursor-not-allowed'
                : 'bg-gray-100/80 text-gray-400 cursor-not-allowed'
          }`}
        >
          <Check size={15} />
          {isReady ? 'Entregar' : 'Aguardando cozinha…'}
        </motion.button>
      </div>
    </motion.div>
  )
}

export default function DispatchStation() {
  const { addToast } = useApp()
  const [orders, setOrders] = useState<Order[]>([])
  const [inputMode, setInputMode] = useState<'qr' | 'keyboard' | null>(null)
  const [manualInput, setManualInput] = useState('')
  const [nightMode, setNightMode] = useState(() => localStorage.getItem(NIGHT_KEY) === 'true')
  const [now, setNow] = useState(Date.now())

  const [releasedFicha, setReleasedFicha] = useState<string | null>(null)
  const [cancelledFicha, setCancelledFicha] = useState<string | null>(null)
  const [lastScanned, setLastScanned] = useState('')

  const ordersRef = useRef<Order[]>([])
  const prevStatusMapRef = useRef<Map<string, string>>(new Map())
  const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scanTicketRef = useRef<string | null>(null)
  const scanCountRef = useRef(0)
  const scanTimeRef = useRef(0)
  const bufferRef = useRef('')
  const lastKeyTimeRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const manualRef = useRef<HTMLInputElement>(null)

  const n = nightMode

  useEffect(() => { ordersRef.current = orders }, [orders])

  useEffect(() => {
    const unsub = subscribeOrders(['pending', 'preparing', 'ready'], (incoming) => {
      setOrders([...incoming].sort((a, b) => a.created_at.getTime() - b.created_at.getTime()))
    })
    return unsub
  }, [])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const unsub = subscribeAllOrders((allOrders) => {
      allOrders.forEach((order) => {
        const prev = prevStatusMapRef.current.get(order.id)
        if (prev && prev !== 'delivered' && order.status === 'delivered') {
          setReleasedFicha(order.ticket_number)
          if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current)
          releaseTimerRef.current = setTimeout(() => setReleasedFicha(null), 6000)
        }
        prevStatusMapRef.current.set(order.id, order.status)
      })
    })
    return () => {
      unsub()
      if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current)
    }
  }, [])

  useEffect(() => {
    return () => { if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current) }
  }, [])

  const toggleNight = () => {
    const next = !nightMode
    setNightMode(next)
    localStorage.setItem(NIGHT_KEY, String(next))
  }

  const flashMode = useCallback((mode: 'qr' | 'keyboard') => {
    setInputMode(mode)
    setTimeout(() => setInputMode(null), 1500)
  }, [])

  const handleDeliver = useCallback(async (order: Order) => {
    try {
      await setOrderStatus(order.id, 'delivered')
      addToast(`Ficha #${order.ticket_number} entregue! ✅`, 'success')
    } catch {
      addToast('Erro ao entregar')
    }
  }, [addToast])

  const processTicket = useCallback(async (raw: string, isQr: boolean) => {
    if (isQr) flashMode('qr')
    else flashMode('keyboard')
    try {
      const ticket = await resolveFicha(raw)
      setLastScanned(ticket)

      // 3 bipadas seguidas na mesma ficha (em até 5s) = pedido entrou errado, cancelar
      const now = Date.now()
      if (scanTicketRef.current === ticket && now - scanTimeRef.current < 5000) {
        scanCountRef.current += 1
      } else {
        scanTicketRef.current = ticket
        scanCountRef.current = 1
      }
      scanTimeRef.current = now

      if (scanCountRef.current >= 3) {
        scanCountRef.current = 0
        scanTicketRef.current = null
        const order = await getOrderByTicket(ticket)
        if (!order) { addToast(`Ficha #${ticket} não encontrada`); return }
        await deleteOrder(order.id)
        playCancelSound()
        addToast(`Pedido da ficha #${ticket} cancelado! Ficha liberada.`, 'success')
        setCancelledFicha(ticket)
        if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current)
        cancelTimerRef.current = setTimeout(() => setCancelledFicha(null), 6000)
        return
      }

      const order = await getActiveOrderByTicket(ticket)
      if (!order) { addToast(`Ficha #${ticket} não encontrada ou já entregue`); return }
      let nextStatus: OrderStatus | null = null
      if (order.status === 'pending' || order.status === 'preparing') nextStatus = 'ready'
      else if (order.status === 'ready') nextStatus = 'delivered'
      if (!nextStatus) return
      await setOrderStatus(order.id, nextStatus)
      if (nextStatus === 'ready') {
        playReadySound()
        addToast(`Ficha #${ticket} pronta! 🔔 Aparece no painel.`, 'success')
      } else {
        playDeliveredSound()
        addToast(`Ficha #${ticket} entregue! ✅ Liberada para uso.`, 'success')
      }
    } catch {
      addToast('Erro ao processar ficha')
    }
  }, [flashMode, addToast])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Tab') { e.preventDefault(); return }
      if (document.activeElement === manualRef.current) return
      if (e.key === 'Enter') {
        if (bufferRef.current.length > 0) {
          e.preventDefault(); e.stopPropagation()
          if (timerRef.current) clearTimeout(timerRef.current)
          const val = bufferRef.current.trim()
          bufferRef.current = ''; lastKeyTimeRef.current = 0
          if (val) processTicket(val, true)
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
          if (val) processTicket(val, true)
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
  }, [processTicket])

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (manualInput.trim()) { processTicket(manualInput.trim(), false); setManualInput('') }
  }

  const readyCount = orders.filter((o) => o.status === 'ready').length
  const totalCount = orders.length

  return (
    <div className={`min-h-screen transition-colors duration-300 ${n ? 'bg-gray-950' : 'bg-background'}`}>
      <div className="p-4 md:p-6 max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div>
            <h1 className={`font-serif italic text-2xl md:text-3xl flex items-center gap-2 ${n ? 'text-white' : 'text-accent-dark'}`}>
              <Package className="text-accent" size={26} />
              Separação de Pedidos
            </h1>
            <p className={`text-xs font-semibold uppercase tracking-widest mt-0.5 ${n ? 'text-gray-500' : 'text-gray-400'}`}>
              {totalCount} pedido{totalCount !== 1 ? 's' : ''} na fila
              {readyCount > 0 && (
                <span className="ml-2 text-green-500">· {readyCount} pronto{readyCount !== 1 ? 's' : ''}</span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-3 ml-auto flex-wrap">
            <AnimatePresence>
              {inputMode && (
                <motion.div
                  key={inputMode}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold ${
                    inputMode === 'qr' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {inputMode === 'qr' ? <QrCode size={13} /> : <Keyboard size={13} />}
                  {inputMode === 'qr' ? 'QR Code' : 'Teclado'}
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleManualSubmit} className="flex items-center gap-2">
              <div className="relative">
                <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-accent/60" />
                <input
                  ref={manualRef}
                  type="text"
                  inputMode="numeric"
                  placeholder="Nº ficha"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  className={`pl-8 pr-3 py-2 rounded-xl border-2 focus:outline-none text-sm font-bold w-28 ${
                    n
                      ? 'bg-gray-800 border-gray-600 text-white focus:border-accent'
                      : 'bg-white border-accent/40 focus:border-accent'
                  }`}
                />
              </div>
              <button type="submit" className="bg-accent hover:bg-accent-dark text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors">
                ✓ OK
              </button>
            </form>

            <button
              onClick={toggleNight}
              title={n ? 'Modo diurno' : 'Modo noturno'}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                n ? 'bg-gray-700 text-yellow-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {n ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>

        {/* Released ficha banner */}
        <AnimatePresence>
          {releasedFicha && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 rounded-2xl border border-green-300 bg-green-50 px-5 py-3 flex items-center gap-3"
            >
              <motion.span
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 0.6, repeat: 2 }}
                className="text-2xl"
              >
                ✅
              </motion.span>
              <div>
                <p className="font-black text-green-800 text-base">
                  Ficha <span className="text-2xl">#{releasedFicha}</span> liberada!
                </p>
                <p className="text-xs text-green-600 font-medium">Entregue ao cliente — pode usar de novo.</p>
              </div>
              {isTakeoutTicket(releasedFicha) && (
                <span className="flex items-center gap-1 bg-purple-100 text-purple-700 border border-purple-300 px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wide">
                  <Plane size={12} />
                  Para Viagem
                </span>
              )}
              <button
                onClick={() => setReleasedFicha(null)}
                className="ml-auto text-green-400 hover:text-green-700 text-lg font-black"
              >
                ×
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Cancelled order banner */}
        <AnimatePresence>
          {cancelledFicha && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 rounded-2xl border border-red-300 bg-red-50 px-5 py-3 flex items-center gap-3"
            >
              <motion.span
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 0.6, repeat: 2 }}
                className="text-2xl"
              >
                🗑️
              </motion.span>
              <div>
                <p className="font-black text-red-800 text-base">
                  Pedido da ficha <span className="text-2xl">#{cancelledFicha}</span> cancelado!
                </p>
                <p className="text-xs text-red-600 font-medium">Removido da tela — a ficha já pode ser usada de novo.</p>
              </div>
              <button
                onClick={() => setCancelledFicha(null)}
                className="ml-auto text-red-400 hover:text-red-700 text-lg font-black"
              >
                ×
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {lastScanned && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mb-4 rounded-2xl px-4 py-2 text-sm border flex items-center gap-2 ${
              n ? 'bg-accent/20 border-accent/30 text-accent' : 'bg-accent/10 border-accent/20 text-accent-dark'
            }`}
          >
            Última ficha: <strong>#{lastScanned}</strong>
            {isTakeoutTicket(lastScanned) && (
              <span className="flex items-center gap-1 bg-purple-100 text-purple-700 border border-purple-300 px-2 py-0.5 rounded-full text-xs font-black uppercase tracking-wide">
                <Plane size={11} />
                Para Viagem
              </span>
            )}
          </motion.div>
        )}

        {/* Orders grid */}
        {orders.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`rounded-3xl p-16 text-center shadow-sm ${n ? 'bg-gray-800' : 'bg-white'}`}
          >
            <Package size={52} className={`mx-auto mb-4 ${n ? 'text-gray-600' : 'text-gray-300'}`} strokeWidth={1.5} />
            <p className={`text-lg font-semibold ${n ? 'text-gray-500' : 'text-gray-400'}`}>
              Nenhum pedido na fila
            </p>
            <p className={`text-sm mt-1 ${n ? 'text-gray-600' : 'text-gray-300'}`}>
              Os pedidos aparecerão aqui assim que entrarem
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <AnimatePresence mode="popLayout">
              {orders.map((order, idx) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  idx={idx}
                  nightMode={n}
                  now={now}
                  onDeliver={handleDeliver}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}
