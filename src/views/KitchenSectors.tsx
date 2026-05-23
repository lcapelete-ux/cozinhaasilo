import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Flame, Utensils, Star, QrCode, Keyboard, Hash, Package } from 'lucide-react'
import { subscribeOrders, getOrderByTicket, setOrderStatus, resolveFicha, subscribeActiveSession, type ActiveSessionData } from '../services/firebaseService'
import { useApp } from '../App'
import type { Order, OrderStatus } from '../types'

const SECTORS = [
  { name: 'Fritadeira', icon: Flame, color: 'text-orange-500', border: 'border-orange-400', bg: 'bg-orange-50' },
  { name: 'Lanches', icon: Utensils, color: 'text-blue-500', border: 'border-blue-400', bg: 'bg-blue-50' },
  { name: 'Outros', icon: Star, color: 'text-purple-500', border: 'border-purple-400', bg: 'bg-purple-50' },
]

interface SectorItem {
  name: string
  totalQty: number
  fichas: { ticket: string; orderId: string; status: OrderStatus }[]
}

export default function KitchenSectors() {
  const { addToast } = useApp()
  const [orders, setOrders] = useState<Order[]>([])
  const [manualInput, setManualInput] = useState('')
  const [inputMode, setInputMode] = useState<'qr' | 'keyboard' | null>(null)
  const [lastScanned, setLastScanned] = useState('')
  const [liveSession, setLiveSession] = useState<ActiveSessionData | null>(null)

  const bufferRef = useRef('')
  const lastKeyTimeRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const manualRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const unsub = subscribeOrders(['pending', 'preparing', 'ready'], setOrders)
    return unsub
  }, [])

  useEffect(() => {
    const unsub = subscribeActiveSession(setLiveSession)
    return unsub
  }, [])

  useEffect(() => {
    manualRef.current?.focus()
  }, [])

  const flashMode = useCallback((mode: 'qr' | 'keyboard') => {
    setInputMode(mode)
    setTimeout(() => setInputMode(null), 1500)
  }, [])

  const processTicket = useCallback(async (raw: string, isQr: boolean) => {
    if (isQr) flashMode('qr')
    else flashMode('keyboard')
    try {
      const ticket = await resolveFicha(raw)
      setLastScanned(ticket)
      const order = await getOrderByTicket(ticket)
      if (!order) { addToast(`Ficha #${ticket} não encontrada`); return }
      let nextStatus: OrderStatus | null = null
      if (order.status === 'pending' || order.status === 'preparing') nextStatus = 'ready'
      else if (order.status === 'ready') nextStatus = 'delivered'
      if (!nextStatus) { addToast(`Ficha #${ticket} já foi entregue`); return }
      await setOrderStatus(order.id, nextStatus)
      const label = nextStatus === 'ready' ? 'pronta' : 'entregue'
      addToast(`Ficha #${ticket} marcada como ${label}!`, 'success')
    } catch {
      addToast('Erro ao processar ficha')
    }
  }, [flashMode, addToast])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
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

  const getSectorItems = (sectorName: string): SectorItem[] => {
    const itemMap = new Map<string, SectorItem>()
    for (const order of orders) {
      for (const item of order.items) {
        if (item.sector !== sectorName) continue
        const existing = itemMap.get(item.name)
        if (existing) {
          existing.totalQty += item.quantity
          if (!existing.fichas.find((f) => f.ticket === order.ticket_number))
            existing.fichas.push({ ticket: order.ticket_number, orderId: order.id, status: order.status })
        } else {
          itemMap.set(item.name, {
            name: item.name,
            totalQty: item.quantity,
            fichas: [{ ticket: order.ticket_number, orderId: order.id, status: order.status }],
          })
        }
      }
    }
    return Array.from(itemMap.values())
  }

  const totalActive = orders.length

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif italic text-2xl md:text-3xl text-accent-dark">Monitor de Produção</h1>
          <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mt-0.5">Consolidado por setor</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Input mode indicator */}
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

          {/* Manual input — numeric keypad friendly */}
          <form onSubmit={handleManualSubmit} className="flex items-center gap-2">
            <div className="relative">
              <Hash size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-accent/60" />
              <input
                ref={manualRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Nº ficha"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                className="pl-8 pr-3 py-2.5 rounded-xl border-2 border-accent/40 focus:outline-none focus:border-accent text-base font-bold w-32 bg-white"
              />
            </div>
            <button type="submit" className="bg-accent hover:bg-accent-dark text-white px-4 py-2.5 rounded-xl text-sm transition-colors font-bold">
              ✓ OK
            </button>
          </form>

          {/* Active orders badge */}
          <div className="bg-accent/10 text-accent-dark text-sm font-bold px-3 py-2 rounded-xl">
            {totalActive} ativo{totalActive !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {lastScanned && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 bg-accent/10 border border-accent/20 rounded-2xl px-4 py-2 text-sm text-accent-dark"
        >
          Última ficha: <strong>#{lastScanned}</strong>
        </motion.div>
      )}

      {/* Sector columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {SECTORS.map(({ name, icon: Icon, color, border }) => {
          const items = getSectorItems(name)
          const count = items.reduce((s, i) => s + i.totalQty, 0)

          return (
            <div key={name} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
              {/* Column header */}
              <div className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon size={18} className={color} />
                  <span className="font-bold text-sm tracking-wider text-gray-700 uppercase">{name}</span>
                </div>
                <span className={`text-sm font-bold px-2 py-0.5 rounded-lg ${color} bg-gray-50`}>
                  {count}
                </span>
              </div>

              {/* Colored divider */}
              <div className={`h-0.5 w-full ${border} border-t-2`} />

              {/* Items */}
              <div className="p-3 min-h-[320px]">
                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-60 text-gray-300">
                    <Package size={48} className="mb-2" strokeWidth={1.5} />
                    <span className="text-xs font-semibold tracking-widest uppercase">Limpo</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <AnimatePresence>
                      {items.map((item) => (
                        <motion.div
                          key={item.name}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          className="border border-gray-100 rounded-xl p-3"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-sm text-gray-800">{item.name}</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-lg bg-gray-100 text-gray-700`}>
                              ×{item.totalQty}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {item.fichas.map(({ ticket, status }) => (
                              <FichaTag key={ticket} ticket={ticket} status={status} />
                            ))}
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Live session preview — bottom-right corner */}
      <AnimatePresence>
        {liveSession && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.95 }}
            className="fixed bottom-5 right-5 z-50 w-64 rounded-2xl shadow-2xl overflow-hidden border border-accent/30"
            style={{ background: '#fff' }}
          >
            {/* Header */}
            <div className="bg-accent px-4 py-2.5 flex items-center justify-between">
              <div>
                <p className="text-white/60 text-[10px] uppercase tracking-widest leading-none mb-0.5">Recepção — ao vivo</p>
                <p className="text-white font-black text-xl leading-none">#{liveSession.ficha}</p>
              </div>
              <motion.div
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="w-2.5 h-2.5 rounded-full bg-white/70"
              />
            </div>

            {/* Items */}
            <div className="p-3 max-h-52 overflow-y-auto">
              {liveSession.items.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-3 italic">Aguardando cupons...</p>
              ) : (
                <div className="space-y-1">
                  <AnimatePresence>
                    {liveSession.items.map((item) => (
                      <motion.div
                        key={item.name}
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center justify-between bg-gray-50 rounded-xl px-2.5 py-1.5"
                      >
                        <div>
                          <p className="text-xs font-semibold text-gray-700 leading-tight">{item.name}</p>
                          <p className="text-[10px] text-gray-400">{item.sector}</p>
                        </div>
                        <span className="font-black text-sm text-accent-dark bg-white rounded-lg px-2 py-0.5 border border-gray-200">
                          ×{item.quantity}
                        </span>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function FichaTag({ ticket, status }: { ticket: string; status: OrderStatus }) {
  const colors: Record<OrderStatus, string> = {
    pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    preparing: 'bg-blue-100 text-blue-700 border-blue-200',
    ready: 'bg-green-100 text-green-700 border-green-200',
    delivered: 'bg-gray-100 text-gray-500 border-gray-200',
  }
  return (
    <span className={`px-2 py-0.5 rounded-lg text-xs font-medium border ${colors[status]}`}>
      #{ticket}
    </span>
  )
}
