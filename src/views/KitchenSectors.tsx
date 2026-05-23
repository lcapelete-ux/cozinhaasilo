import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Flame, Utensils, Star, QrCode, Keyboard, Hash, Clock, CheckCircle2, type LucideIcon } from 'lucide-react'
import { subscribeOrders, getActiveOrderByTicket, setOrderStatus, resolveFicha, subscribeActiveSession, type ActiveSessionData } from '../services/firebaseService'
import readySound from '../assets/ready.mp3'
import { useApp } from '../App'
import type { Order, OrderStatus } from '../types'

function playReadySound() {
  try {
    const audio = new Audio(readySound)
    audio.play().catch(() => {})
  } catch { /* audio not available */ }
}

const SECTOR_META: Record<string, { icon: LucideIcon; color: string; bg: string }> = {
  Fritadeira: { icon: Flame,    color: 'text-orange-500', bg: 'bg-orange-50' },
  Lanches:    { icon: Utensils, color: 'text-blue-500',   bg: 'bg-blue-50'   },
  Outros:     { icon: Star,     color: 'text-purple-500', bg: 'bg-purple-50' },
}

function formatAge(date: Date, now: number): string {
  const mins = Math.floor((now - date.getTime()) / 60000)
  if (mins < 1) return 'agora'
  if (mins === 1) return '1 min'
  return `${mins} min`
}

function groupBySector(items: Order['items']): Map<string, { name: string; qty: number }[]> {
  const groups = new Map<string, { name: string; qty: number }[]>()
  for (const item of items) {
    const existing = groups.get(item.sector) ?? []
    const entry = existing.find((e) => e.name === item.name)
    if (entry) entry.qty += item.quantity
    else existing.push({ name: item.name, qty: item.quantity })
    groups.set(item.sector, existing)
  }
  return groups
}

export default function KitchenSectors() {
  const { addToast } = useApp()
  const [orders, setOrders] = useState<Order[]>([])
  const [manualInput, setManualInput] = useState('')
  const [inputMode, setInputMode] = useState<'qr' | 'keyboard' | null>(null)
  const [lastScanned, setLastScanned] = useState('')
  const [liveSession, setLiveSession] = useState<ActiveSessionData | null>(null)
  const [now, setNow] = useState(Date.now())

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

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(t)
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
        addToast(`Ficha #${ticket} entregue! ✅ Liberada para uso.`, 'success')
      }
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

  const pending = orders.filter((o) => o.status === 'pending' || o.status === 'preparing')
  const ready   = orders.filter((o) => o.status === 'ready')

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif italic text-2xl md:text-3xl text-accent-dark">Fila de Produção</h1>
          <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mt-0.5">
            {pending.length} em preparo · {ready.length} pronto{ready.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center gap-3">
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
        </div>
      </div>

      {lastScanned && (
        <motion.div
          key={lastScanned}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 bg-accent/10 border border-accent/20 rounded-2xl px-4 py-2 text-sm text-accent-dark"
        >
          Última ficha processada: <strong>#{lastScanned}</strong>
        </motion.div>
      )}

      {/* Empty state */}
      {orders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-gray-300">
          <CheckCircle2 size={56} strokeWidth={1} className="mb-4" />
          <p className="text-sm font-semibold tracking-widest uppercase">Cozinha livre</p>
        </div>
      )}

      {/* KDS Order cards — oldest first */}
      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {orders.map((order) => {
            const isReady = order.status === 'ready'
            const sectors = groupBySector(order.items)

            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 40, transition: { duration: 0.2 } }}
                className={`rounded-2xl border-2 overflow-hidden ${
                  isReady
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-100 bg-white'
                }`}
              >
                {/* Card header */}
                <div className={`px-4 py-3 flex items-center justify-between ${
                  isReady ? 'bg-green-500' : 'bg-accent'
                }`}>
                  <div className="flex items-center gap-3">
                    <span className="font-black text-3xl text-white leading-none">
                      #{order.ticket_number}
                    </span>
                    {isReady && (
                      <span className="flex items-center gap-1 bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-lg">
                        <CheckCircle2 size={12} />
                        Pronto
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-white/70 text-xs font-semibold">
                    <Clock size={12} />
                    {formatAge(order.created_at, now)}
                  </div>
                </div>

                {/* Items by sector */}
                <div className="px-4 py-3 flex flex-wrap gap-3">
                  {Array.from(sectors.entries()).map(([sectorName, items]) => {
                    const meta = SECTOR_META[sectorName]
                    const Icon = meta?.icon ?? Star
                    return (
                      <div key={sectorName} className={`flex-1 min-w-[140px] rounded-xl px-3 py-2 ${meta?.bg ?? 'bg-gray-50'}`}>
                        <div className={`flex items-center gap-1.5 mb-1.5 ${meta?.color ?? 'text-gray-500'}`}>
                          <Icon size={13} />
                          <span className="text-xs font-bold uppercase tracking-wider">{sectorName}</span>
                        </div>
                        <div className="space-y-0.5">
                          {items.map((item) => (
                            <div key={item.name} className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium text-gray-700">{item.name}</span>
                              <span className="text-sm font-black text-gray-900 bg-white rounded-lg px-2 py-0.5 border border-gray-200 shrink-0">
                                ×{item.qty}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
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
