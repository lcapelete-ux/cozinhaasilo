import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Flame, Beef, Drumstick, QrCode, Keyboard, Hash, Package, AlertTriangle, ZoomIn, ZoomOut, Moon, Sun, Plane } from 'lucide-react'
import { subscribeOrders, getActiveOrderByTicket, getOrderByTicket, setOrderStatus, deleteOrder, resolveFicha, subscribeActiveSession, subscribeMenuItems, subscribeAllOrders, type ActiveSessionData } from '../services/firebaseService'
import readySound from '../assets/ready.mp3'
import { useApp } from '../App'
import { isTakeoutTicket, displayTicket, parseManualTicket } from '../utils/ticket'
import type { Order, OrderStatus, MenuItem } from '../types'

const LOW_STOCK_THRESHOLD = 15
const ZOOM_KEY = 'sectors-zoom'
const NIGHT_KEY = 'sectors-night'
const ZOOM_STEPS = [0.75, 0.85, 1, 1.15, 1.3, 1.5, 1.75, 2, 2.3, 2.6, 3]

function playNewOrderSound() {
  try {
    const audio = new Audio(readySound)
    audio.play().catch(() => {})
  } catch { /* audio not available */ }
}

function playReadySound() {
  try {
    const ctx = new AudioContext()
    ;[0, 0.18].forEach((offset, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = i === 0 ? 660 : 880
      gain.gain.setValueAtTime(0, ctx.currentTime + offset)
      gain.gain.linearRampToValueAtTime(0.7, ctx.currentTime + offset + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.22)
      osc.start(ctx.currentTime + offset)
      osc.stop(ctx.currentTime + offset + 0.25)
    })
  } catch { /* audio not available */ }
}

function playCancelSound() {
  try {
    const ctx = new AudioContext()
    ;[0, 0.16].forEach((offset, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'square'
      osc.frequency.value = i === 0 ? 320 : 200
      gain.gain.setValueAtTime(0, ctx.currentTime + offset)
      gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + offset + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.25)
      osc.start(ctx.currentTime + offset)
      osc.stop(ctx.currentTime + offset + 0.28)
    })
  } catch { /* audio not available */ }
}

function ZoomControls({ zoom, onChange }: { zoom: number; onChange: (z: number) => void }) {
  const idx = ZOOM_STEPS.indexOf(zoom)
  const dec = () => { if (idx > 0) onChange(ZOOM_STEPS[idx - 1]) }
  const inc = () => { if (idx < ZOOM_STEPS.length - 1) onChange(ZOOM_STEPS[idx + 1]) }
  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-xl px-1 py-1">
      <button onClick={dec} disabled={idx === 0} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:bg-white hover:text-gray-800 disabled:opacity-30 transition-colors">
        <ZoomOut size={14} />
      </button>
      <span className="text-xs font-bold text-gray-500 w-10 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
      <button onClick={inc} disabled={idx === ZOOM_STEPS.length - 1} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:bg-white hover:text-gray-800 disabled:opacity-30 transition-colors">
        <ZoomIn size={14} />
      </button>
    </div>
  )
}

const SECTORS = [
  { name: 'Fritadeira', icon: Flame, color: 'text-orange-500', border: 'border-orange-400', bg: 'bg-orange-50' },
  { name: 'Chapa', icon: Beef, color: 'text-blue-500', border: 'border-blue-400', bg: 'bg-blue-50' },
  { name: 'Assados', icon: Drumstick, color: 'text-purple-500', border: 'border-purple-400', bg: 'bg-purple-50' },
]

// Compatibilidade com itens gravados antes da renomeação dos setores
const SECTOR_ALIASES: Record<string, string> = {
  Lanches: 'Chapa',
  Outros: 'Assados',
}

interface SectorItem {
  name: string
  totalQty: number
  fichas: { ticket: string; orderId: string; status: OrderStatus; qty: number }[]
}

export default function KitchenSectors() {
  const { addToast } = useApp()
  const [orders, setOrders] = useState<Order[]>([])
  const [manualInput, setManualInput] = useState('')
  const [inputMode, setInputMode] = useState<'qr' | 'keyboard' | null>(null)
  const [lastScanned, setLastScanned] = useState('')
  const [liveSession, setLiveSession] = useState<ActiveSessionData | null>(null)
  const [lowStock, setLowStock] = useState<MenuItem[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [zoom, setZoom] = useState<number>(() => {
    const saved = localStorage.getItem(ZOOM_KEY)
    const val = saved ? parseFloat(saved) : 1
    return ZOOM_STEPS.includes(val) ? val : 1
  })
  const [nightMode, setNightMode] = useState(() => localStorage.getItem(NIGHT_KEY) === 'true')

  const handleZoom = (z: number) => {
    setZoom(z)
    localStorage.setItem(ZOOM_KEY, String(z))
  }

  const [releasedFicha, setReleasedFicha] = useState<string | null>(null)
  const prevStatusMapRef = useRef<Map<string, string>>(new Map())
  const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [cancelledFicha, setCancelledFicha] = useState<string | null>(null)
  const cancelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scanTicketRef = useRef<string | null>(null)
  const scanCountRef = useRef(0)
  const scanTimeRef = useRef(0)

  const knownOrderIdsRef = useRef<Set<string>>(new Set())

  const bufferRef = useRef('')
  const lastKeyTimeRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const manualRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const unsub = subscribeOrders(['pending', 'preparing', 'ready'], (incoming) => {
      const isFirstLoad = knownOrderIdsRef.current.size === 0
      let hasNew = false
      for (const o of incoming) {
        if (!knownOrderIdsRef.current.has(o.id)) {
          knownOrderIdsRef.current.add(o.id)
          if (!isFirstLoad) hasNew = true
        }
      }
      if (hasNew) playNewOrderSound()
      setOrders(incoming)
    })
    return unsub
  }, [])

  useEffect(() => {
    const unsub = subscribeActiveSession(setLiveSession)
    return unsub
  }, [])

  useEffect(() => {
    const unsub = subscribeMenuItems((items) => {
      setMenuItems(items)
      setLowStock(items.filter((i) => i.stock_initial && i.stock !== undefined && i.stock <= LOW_STOCK_THRESHOLD))
    })
    return unsub
  }, [])

  useEffect(() => {
    manualRef.current?.focus()
  }, [])

  useEffect(() => {
    return () => { if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current) }
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

  const flashMode = useCallback((mode: 'qr' | 'keyboard') => {
    setInputMode(mode)
    setTimeout(() => setInputMode(null), 1500)
  }, [])

  const processTicket = useCallback(async (raw: string, isQr: boolean) => {
    if (isQr) flashMode('qr')
    else flashMode('keyboard')

    // Manual numeric keypad shows/expects the on-screen number (100-120);
    // QR/barcode scans already carry the real ficha (200-220) — untouched.
    if (!isQr) raw = parseManualTicket(raw)
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
        if (!order) { addToast(`Ficha #${displayTicket(ticket)} não encontrada`); return }
        await deleteOrder(order.id)
        playCancelSound()
        addToast(`Pedido da ficha #${displayTicket(ticket)} cancelado! Ficha liberada.`, 'success')
        setCancelledFicha(ticket)
        if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current)
        cancelTimerRef.current = setTimeout(() => setCancelledFicha(null), 6000)
        return
      }

      const order = await getActiveOrderByTicket(ticket)
      if (!order) { addToast(`Ficha #${displayTicket(ticket)} não encontrada ou já entregue`); return }
      let nextStatus: OrderStatus | null = null
      if (order.status === 'pending' || order.status === 'preparing') nextStatus = 'ready'
      else if (order.status === 'ready') nextStatus = 'delivered'
      if (!nextStatus) return
      await setOrderStatus(order.id, nextStatus)
      if (nextStatus === 'ready') {
        playReadySound()
        addToast(`Ficha #${displayTicket(ticket)} pronta! 🔔 Aparece no painel.`, 'success')
      } else {
        addToast(`Ficha #${displayTicket(ticket)} entregue! ✅ Liberada para uso.`, 'success')
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

  const getSectorItems = (sectorName: string): SectorItem[] => {
    const itemMap = new Map<string, SectorItem>()
    for (const order of orders) {
      for (const item of order.items) {
        const sector = SECTOR_ALIASES[item.sector] ?? item.sector
        if (sector !== sectorName) continue
        const pendingQty = order.status !== 'ready' ? item.quantity : 0
        const existing = itemMap.get(item.name)
        if (existing) {
          existing.totalQty += pendingQty
          const fichaEntry = existing.fichas.find((f) => f.ticket === order.ticket_number)
          if (fichaEntry) {
            fichaEntry.qty += item.quantity
          } else {
            existing.fichas.push({ ticket: order.ticket_number, orderId: order.id, status: order.status, qty: item.quantity })
          }
        } else {
          itemMap.set(item.name, {
            name: item.name,
            totalQty: pendingQty,
            fichas: [{ ticket: order.ticket_number, orderId: order.id, status: order.status, qty: item.quantity }],
          })
        }
      }
    }
    return Array.from(itemMap.values()).sort((a, b) => b.totalQty - a.totalQty)
  }

  const getRegisteredItems = (sectorName: string): MenuItem[] => {
    return menuItems
      .filter((i) => (SECTOR_ALIASES[i.sector] ?? i.sector) === sectorName)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name))
  }

  const totalActive = orders.length
  const [clockTime, setClockTime] = useState(() =>
    new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  )

  useEffect(() => {
    const id = setInterval(() => {
      setClockTime(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
    }, 1000)
    return () => clearInterval(id)
  }, [])

  const toggleNight = () => {
    const next = !nightMode
    setNightMode(next)
    localStorage.setItem(NIGHT_KEY, String(next))
  }

  const n = nightMode // shorthand for conditional classes

  return (
    <div className={n ? 'min-h-screen bg-gray-950' : ''}>
    <div style={{ zoom }} className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="relative flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className={`font-serif italic text-2xl md:text-3xl ${n ? 'text-white' : 'text-accent-dark'}`}>Monitor de Produção</h1>
          <p className={`text-xs font-semibold tracking-widest uppercase mt-0.5 ${n ? 'text-gray-500' : 'text-gray-400'}`}>Consolidado por setor</p>
        </div>

        {/* Clock — centered */}
        <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none select-none">
          <span className={`font-mono font-black text-3xl md:text-4xl tracking-widest tabular-nums ${n ? 'text-white/25' : 'text-gray-200'}`}>
            {clockTime}
          </span>
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

          <button
            onClick={toggleNight}
            title={n ? 'Modo diurno' : 'Modo noturno'}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
              n ? 'bg-gray-700 text-yellow-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {n ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <ZoomControls zoom={zoom} onChange={handleZoom} />

          <div className={`text-sm font-bold px-3 py-2 rounded-xl ${n ? 'bg-gray-800 text-gray-300' : 'bg-accent/10 text-accent-dark'}`}>
            {totalActive} ativo{totalActive !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Low stock alert banner */}
      <AnimatePresence>
        {lowStock.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-4 rounded-2xl border border-orange-300 bg-orange-50 px-4 py-3 flex items-center gap-3"
          >
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              <AlertTriangle size={18} className="text-orange-500 shrink-0" />
            </motion.div>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-black uppercase tracking-widest text-orange-700 mr-2">Estoque baixo:</span>
              <span className="text-sm text-orange-800">
                {lowStock.map((i) => (
                  <span key={i.id} className={`inline-flex items-center mr-2 font-semibold ${i.stock === 0 ? 'text-red-600' : ''}`}>
                    {i.name}
                    <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-lg font-black ${i.stock === 0 ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-700'}`}>
                      {i.stock === 0 ? 'ZERADO' : `${i.stock}`}
                    </span>
                  </span>
                ))}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                Ficha <span className="text-2xl">#{displayTicket(releasedFicha)}</span> liberada!
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
                Pedido da ficha <span className="text-2xl">#{displayTicket(cancelledFicha)}</span> cancelado!
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
          className="mb-4 bg-accent/10 border border-accent/20 rounded-2xl px-4 py-2 text-sm text-accent-dark flex items-center gap-2"
        >
          Última ficha: <strong>#{displayTicket(lastScanned)}</strong>
          {isTakeoutTicket(lastScanned) && (
            <span className="flex items-center gap-1 bg-purple-100 text-purple-700 border border-purple-300 px-2 py-0.5 rounded-full text-xs font-black uppercase tracking-wide">
              <Plane size={11} />
              Para Viagem
            </span>
          )}
        </motion.div>
      )}

      {/* Sector columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {SECTORS.map(({ name, icon: Icon, color, border }) => {
          const items = getSectorItems(name)
          const count = items.reduce((s, i) => s + i.totalQty, 0)

          return (
            <div key={name} className={`rounded-2xl shadow-sm overflow-hidden ${n ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100'}`}>
              <div className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon size={n ? 22 : 18} className={color} />
                  <span className={`font-bold tracking-wider uppercase ${n ? 'text-base text-gray-100' : 'text-sm text-gray-700'}`}>{name}</span>
                </div>
                <span className={`font-black px-2 py-0.5 rounded-lg ${n ? 'text-2xl text-white bg-gray-700' : `text-sm ${color} bg-gray-50`}`}>
                  {count}
                </span>
              </div>

              <div className={`h-0.5 w-full ${border} border-t-2`} />

              <div className="p-3 min-h-[320px]">
                {items.length === 0 ? (
                  (() => {
                    const registered = getRegisteredItems(name)
                    return registered.length === 0 ? (
                      <div className={`flex flex-col items-center justify-center h-60 ${n ? 'text-gray-700' : 'text-gray-300'}`}>
                        <Package size={48} className="mb-2" strokeWidth={1.5} />
                        <span className="text-xs font-semibold tracking-widest uppercase">Limpo</span>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${n ? 'text-gray-600' : 'text-gray-300'}`}>
                          Sem pedidos — produtos do setor
                        </p>
                        {registered.map((item) => (
                          <div
                            key={item.id}
                            className={`flex items-center justify-between rounded-xl px-3 py-2 ${n ? 'border border-gray-800 bg-gray-900/20' : 'border border-gray-50 bg-gray-50/60'}`}
                          >
                            <span className={`font-medium ${n ? 'text-gray-400 text-base' : 'text-gray-400 text-sm'}`}>{item.name}</span>
                            <Package size={14} className={n ? 'text-gray-700' : 'text-gray-200'} />
                          </div>
                        ))}
                      </div>
                    )
                  })()
                ) : (
                  <div className="space-y-2">
                    <AnimatePresence>
                      {items.map((item) => (
                        <motion.div
                          key={item.name}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          className={`rounded-xl p-3 ${n ? 'border border-gray-700 bg-gray-900/40' : 'border border-gray-100'}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className={`font-semibold ${n ? 'text-white text-lg' : 'text-gray-800 text-sm'}`}>{item.name}</span>
                            <span className={`font-black px-2 py-0.5 rounded-lg ${n ? 'text-2xl bg-gray-700 text-white' : 'text-xs bg-gray-100 text-gray-700'}`}>
                              ×{item.totalQty}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {item.fichas.map(({ ticket, status, qty }) => (
                              <FichaTag key={ticket} ticket={ticket} status={status} qty={qty} nightMode={n} />
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
            <div className="bg-accent px-4 py-2.5 flex items-center justify-between">
              <div>
                <p className="text-white/60 text-[10px] uppercase tracking-widest leading-none mb-0.5">Recepção — ao vivo</p>
                <p className="text-white font-black text-xl leading-none">#{displayTicket(liveSession.ficha)}</p>
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
                          <p className="text-[10px] text-gray-400">{SECTOR_ALIASES[item.sector] ?? item.sector}</p>
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
    </div>
  )
}

function FichaTag({ ticket, status, qty, nightMode }: { ticket: string; status: OrderStatus; qty: number; nightMode?: boolean }) {
  const isReady = status === 'ready'
  const isTakeout = isTakeoutTicket(ticket)
  const lightColors: Record<OrderStatus, string> = {
    pending:   'bg-yellow-100 text-yellow-700 border-yellow-200',
    preparing: 'bg-blue-100 text-blue-700 border-blue-200',
    ready:     'bg-gray-100 text-gray-500 border-gray-200',
    delivered: 'bg-gray-100 text-gray-400 border-gray-200',
  }
  const darkColors: Record<OrderStatus, string> = {
    pending:   'bg-yellow-900/60 text-yellow-300 border-yellow-700',
    preparing: 'bg-blue-900/60 text-blue-300 border-blue-700',
    ready:     'bg-gray-700 text-gray-400 border-gray-600',
    delivered: 'bg-gray-800 text-gray-500 border-gray-700',
  }
  const takeoutColors = nightMode
    ? 'bg-purple-900/60 text-purple-300 border-purple-600'
    : 'bg-purple-100 text-purple-700 border-purple-300'
  const colors = nightMode ? darkColors : lightColors
  const size = nightMode ? 'text-sm' : 'text-xs'
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-bold border ${size} ${isTakeout ? takeoutColors : colors[status]}`}>
      {isTakeout && <Plane size={nightMode ? 13 : 11} className="shrink-0" />}
      <span className={isReady ? 'line-through decoration-2 decoration-gray-400/60' : ''}>#{displayTicket(ticket)}</span>
      <span className="opacity-70">×{qty}</span>
    </span>
  )
}
