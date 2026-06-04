import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Package, Check, QrCode, Keyboard, Hash, Moon, Sun, Clock, Flame, Beef, Drumstick } from 'lucide-react'
import { subscribeOrders, setOrderStatus, resolveFicha } from '../services/firebaseService'
import { useApp } from '../App'
import type { Order, OrderStatus } from '../types'

const NIGHT_KEY = 'dispatch-night'

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

function OrderCard({ order, idx, nightMode: n, now, onDeliver }: CardProps) {
  const status = STATUS_STYLE[order.status]
  const isReady = order.status === 'ready'
  const age = formatAge(order.created_at, now)
  const isOld = (now - order.created_at.getTime()) > 10 * 60 * 1000

  // Group items by sector
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
      className={`flex flex-col rounded-3xl overflow-hidden shadow-md border ${
        n
          ? isReady ? 'border-green-700 bg-gray-800' : 'border-gray-700 bg-gray-800'
          : isReady ? 'border-green-200 bg-white' : 'border-gray-100 bg-white'
      }`}
    >
      {/* Card header */}
      <div className={`px-4 pt-4 pb-3 flex items-start justify-between ${
        n ? 'bg-gray-900/50' : 'bg-gray-50'
      }`}>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-black tabular-nums px-1.5 py-0.5 rounded-lg ${
            n ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500'
          }`}>
            #{String(idx + 1).padStart(2, '0')}
          </span>
          <div>
            <p className={`text-xs uppercase tracking-widest font-semibold ${n ? 'text-gray-500' : 'text-gray-400'}`}>
              Ficha
            </p>
            <p className={`font-black text-3xl leading-none ${n ? 'text-white' : 'text-gray-900'}`}>
              {order.ticket_number}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${n ? status.dark : status.light}`}>
            {status.label}
          </span>
          <span className={`flex items-center gap-1 text-xs font-semibold ${
            isOld ? 'text-red-500' : n ? 'text-gray-500' : 'text-gray-400'
          }`}>
            <Clock size={11} />
            {age}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className={`h-px w-full ${isReady ? 'bg-green-200' : n ? 'bg-gray-700' : 'bg-gray-100'}`} />

      {/* Items */}
      <div className="flex-1 p-4 space-y-3">
        {Object.entries(bySector).map(([sector, items]) => {
          const style = SECTOR_STYLE[sector]
          const Icon = style?.icon
          return (
            <div key={sector}>
              <div className={`flex items-center gap-1.5 mb-1.5`}>
                {Icon && <Icon size={11} className={n ? (style.dark.split(' ')[0]) : (style.light.split(' ')[0])} />}
                <span className={`text-xs font-black uppercase tracking-widest ${
                  n ? 'text-gray-500' : 'text-gray-400'
                }`}>{sector}</span>
              </div>
              <div className="space-y-1">
                {items.map((item, i) => (
                  <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-xl ${
                    n ? 'bg-gray-900/50' : 'bg-gray-50'
                  }`}>
                    <span className={`text-sm font-semibold leading-tight ${n ? 'text-gray-200' : 'text-gray-800'}`}>
                      {item.name}
                    </span>
                    <span className={`text-sm font-black ml-3 shrink-0 px-2 py-0.5 rounded-lg ${
                      n ? 'bg-gray-700 text-white' : 'bg-white text-gray-700 border border-gray-200'
                    }`}>
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
              ? n
                ? 'bg-green-600 hover:bg-green-500 text-white'
                : 'bg-green-500 hover:bg-green-600 text-white'
              : n
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
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

  const ordersRef = useRef<Order[]>([])
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
      const order = ordersRef.current.find((o) => o.ticket_number === ticket)
      if (!order) { addToast(`Ficha #${ticket} não encontrada`); return }
      if (order.status !== 'ready') { addToast(`Ficha #${ticket} ainda não está pronta`); return }
      await handleDeliver(order)
    } catch {
      addToast('Erro ao processar ficha')
    }
  }, [flashMode, addToast, handleDeliver])

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
