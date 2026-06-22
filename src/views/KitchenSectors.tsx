import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Flame, Beef, Drumstick, QrCode, Keyboard, Hash, Package, AlertTriangle, Moon, Sun, Plane, Sparkles, Palette, LayoutGrid, LayoutList, Check } from 'lucide-react'
import { subscribeOrders, getActiveOrderByTicket, getOrderByTicket, setOrderStatus, deleteOrder, resolveFicha, subscribeActiveSession, subscribeMenuItems, subscribeAllOrders, type ActiveSessionData } from '../services/firebaseService'
import readySound from '../assets/ready.mp3'
import { useApp } from '../App'
import { useScanner } from '../hooks/useScanner'
import { isTakeoutTicket, displayTicket, parseManualTicket, isCupomCode } from '../utils/ticket'
import ZoomControls, { ZOOM_STEPS } from '../components/ZoomControls'
import { OrderCard, ColumnsControl, getAutoZoom, COLS_STEPS_RANGE } from '../components/OrderCard'
import type { Order, OrderStatus, MenuItem } from '../types'

const LOW_STOCK_THRESHOLD = 15
const ZOOM_KEY = 'sectors-zoom'
const NIGHT_KEY = 'sectors-night'
const SYMBOLS_KEY = 'sectors-symbols'
const COLORS_KEY = 'sectors-colors'
const LAYOUT_KEY = 'sectors-layout'
const COLS_KEY = 'sectors-cols'
const FOOTER_ZOOM_KEY = 'sectors-footer-zoom'
const ORDERS_ZOOM_KEY = 'sectors-orders-zoom'

// Mesma faixa de zoom reduzida usada na barra de "Prontas" da tela Entrega.
const FOOTER_ZOOM_STEPS = [0.4, 0.5, 0.6, 0.7, 0.75, 0.85, 1, 1.15, 1.3, 1.5]

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
  const [now, setNow] = useState(Date.now())
  const [manualInput, setManualInput] = useState('')
  const [inputMode, setInputMode] = useState<'qr' | 'keyboard' | null>(null)
  const [liveSession, setLiveSession] = useState<ActiveSessionData | null>(null)
  const [lowStock, setLowStock] = useState<MenuItem[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [zoom, setZoom] = useState<number>(() => {
    const saved = localStorage.getItem(ZOOM_KEY)
    const val = saved ? parseFloat(saved) : 1
    return ZOOM_STEPS.includes(val) ? val : 1
  })
  const [nightMode, setNightMode] = useState(() => localStorage.getItem(NIGHT_KEY) === 'true')
  const [symbolMode, setSymbolMode] = useState(() => localStorage.getItem(SYMBOLS_KEY) === 'true')
  const [colorMode, setColorMode] = useState(() => localStorage.getItem(COLORS_KEY) !== 'false')
  const [layout, setLayout] = useState<'sectors' | 'orders'>(() =>
    localStorage.getItem(LAYOUT_KEY) === 'orders' ? 'orders' : 'sectors'
  )
  const [colsOverride, setColsOverride] = useState<number | null>(() => {
    const saved = localStorage.getItem(COLS_KEY)
    const val = saved ? parseInt(saved, 10) : NaN
    return COLS_STEPS_RANGE.includes(val) ? val : 6
  })
  const [footerZoom, setFooterZoom] = useState<number>(() => {
    const saved = localStorage.getItem(FOOTER_ZOOM_KEY)
    const val = saved ? parseFloat(saved) : 1
    return FOOTER_ZOOM_STEPS.includes(val) ? val : 1
  })
  // Zoom do layout "Entrega" é independente do zoom da página em "Setores" —
  // mesma lógica (auto por quantidade de fichas, com override manual) da tela de Entrega.
  const [ordersZoomOverride, setOrdersZoomOverride] = useState<number | null>(() => {
    const saved = localStorage.getItem(ORDERS_ZOOM_KEY)
    const val = saved ? parseFloat(saved) : NaN
    return ZOOM_STEPS.includes(val) ? val : null
  })

  const handleZoom = (z: number) => {
    setZoom(z)
    localStorage.setItem(ZOOM_KEY, String(z))
  }

  const handleOrdersZoom = (z: number) => {
    setOrdersZoomOverride(z)
    localStorage.setItem(ORDERS_ZOOM_KEY, String(z))
  }

  const toggleLayout = () => {
    const next = layout === 'orders' ? 'sectors' : 'orders'
    setLayout(next)
    localStorage.setItem(LAYOUT_KEY, next)
  }

  const handleCols = (cols: number | null) => {
    setColsOverride(cols)
    if (cols === null) localStorage.removeItem(COLS_KEY)
    else localStorage.setItem(COLS_KEY, String(cols))
  }

  const handleFooterZoom = (z: number) => {
    setFooterZoom(z)
    localStorage.setItem(FOOTER_ZOOM_KEY, String(z))
  }

  const handleDeliver = useCallback(async (order: Order) => {
    try {
      await setOrderStatus(order.id, 'delivered')
      addToast(`Ficha #${displayTicket(order.ticket_number)} entregue! ✅`, 'success')
    } catch {
      addToast('Erro ao entregar')
    }
  }, [addToast])

  const [releasedFicha, setReleasedFicha] = useState<string | null>(null)
  const prevStatusMapRef = useRef<Map<string, string>>(new Map())
  const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [cancelledFicha, setCancelledFicha] = useState<string | null>(null)
  const cancelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scanTicketRef = useRef<string | null>(null)
  const scanCountRef = useRef(0)
  const scanTimeRef = useRef(0)

  const knownOrderIdsRef = useRef<Set<string>>(new Set())

  const manualRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

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

    // Bipe errado de cupom (formato "0844-124791") não pode ser confundido
    // com ficha — ficha é número puro.
    if (isCupomCode(raw)) {
      addToast('Isso é um cupom, não uma ficha! Bipe a ficha.')
      return
    }

    // Manual numeric keypad shows/expects the on-screen number (100-120);
    // QR/barcode scans already carry the real ficha (200-220) — untouched.
    if (!isQr) raw = parseManualTicket(raw)
    try {
      const ticket = await resolveFicha(raw)
      if (!ticket) {
        addToast('Leitura não reconhecida — bipe novamente')
        return
      }

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

  useScanner((val) => processTicket(val, true))

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

  const fichaIndexMap = useMemo(
    () => assignFichaIndices(orders.map((o) => o.ticket_number)),
    [orders]
  )

  const totalActive = orders.length
  const ordersQueueCount = orders.filter((o) => o.status !== 'ready').length
  const delayedOrders = orders
    .filter((o) => (o.status === 'pending' || o.status === 'preparing') && (now - o.created_at.getTime()) > 10 * 60 * 1000)
    .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
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

  const toggleSymbols = () => {
    const next = !symbolMode
    setSymbolMode(next)
    localStorage.setItem(SYMBOLS_KEY, String(next))
  }

  const toggleColors = () => {
    const next = !colorMode
    setColorMode(next)
    localStorage.setItem(COLORS_KEY, String(next))
  }

  const n = nightMode // shorthand for conditional classes

  return (
    <div className={n ? 'min-h-screen bg-gray-950' : ''}>
    <div
      style={{ zoom: layout === 'sectors' ? zoom : 1 }}
      className={`p-4 md:p-6 ${layout === 'sectors' ? 'max-w-7xl mx-auto' : ''}`}
    >
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

          <button
            onClick={toggleLayout}
            title={layout === 'orders' ? 'Ver consolidado por setor' : 'Ver como a tela de Entrega (cards por pedido)'}
            className={`flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-bold transition-colors ${
              layout === 'orders'
                ? n ? 'bg-accent/30 text-accent' : 'bg-accent/15 text-accent-dark'
                : n ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {layout === 'orders' ? <LayoutList size={15} /> : <LayoutGrid size={15} />}
            {layout === 'orders' ? 'Entrega' : 'Setores'}
          </button>

          {layout === 'sectors' && (
            <>
              <button
                onClick={toggleColors}
                title={colorMode ? 'Desativar cores por ficha' : 'Ativar cores por ficha'}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                  colorMode
                    ? n ? 'bg-accent/30 text-accent' : 'bg-accent/15 text-accent-dark'
                    : n ? 'bg-gray-700 text-gray-400 hover:bg-gray-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                <Palette size={16} />
              </button>

              <button
                onClick={toggleSymbols}
                title={symbolMode ? 'Desativar símbolos por ficha' : 'Ativar símbolos por ficha'}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                  symbolMode
                    ? n ? 'bg-accent/30 text-accent' : 'bg-accent/15 text-accent-dark'
                    : n ? 'bg-gray-700 text-gray-400 hover:bg-gray-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                <Sparkles size={16} />
              </button>
            </>
          )}

          {layout === 'orders' && <ColumnsControl cols={colsOverride} onChange={handleCols} />}

          {layout === 'orders' ? (
            <ZoomControls zoom={ordersZoomOverride ?? getAutoZoom(ordersQueueCount)} onChange={handleOrdersZoom} />
          ) : (
            <ZoomControls zoom={zoom} onChange={handleZoom} />
          )}

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

      {delayedOrders.length > 0 && <DelayedMarquee orders={delayedOrders} />}

      {/* Sector columns */}
      {layout === 'sectors' && (
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
                      <div>
                        <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${n ? 'text-gray-600' : 'text-gray-300'}`}>
                          Sem pedidos — produtos do setor
                        </p>
                        <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))' }}>
                          {registered.map((item) => (
                            <div
                              key={item.id}
                              className={`flex items-center justify-center text-center rounded-lg px-2 py-1.5 ${n ? 'border border-gray-800 bg-gray-900/20' : 'border border-gray-50 bg-gray-50/60'}`}
                            >
                              <span className={`font-medium leading-tight ${n ? 'text-gray-400 text-xs' : 'text-gray-400 text-xs'}`}>{item.name}</span>
                            </div>
                          ))}
                        </div>
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
                              <FichaTag
                                key={ticket}
                                ticket={ticket}
                                status={status}
                                qty={qty}
                                nightMode={n}
                                symbolMode={symbolMode}
                                colorMode={colorMode}
                                idx={fichaIndexMap.get(ticket) ?? ficheNaturalIndex(ticket)}
                              />
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
      )}

      {/* Layout "Entrega" — cards por pedido, igual à tela de Entrega */}
      {layout === 'orders' && (
        <OrdersLayout
          orders={orders}
          nightMode={n}
          now={now}
          colsOverride={colsOverride}
          zoomOverride={ordersZoomOverride}
          footerZoom={footerZoom}
          onFooterZoom={handleFooterZoom}
          onDeliver={handleDeliver}
        />
      )}

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

// Layout alternativo da tela Setores: mostra os pedidos em cards, idêntico à
// tela de Entrega (reaproveita o mesmo OrderCard), com a barra de "Prontas"
// embaixo. Útil para os turnos que preferem ver a mesma tela da Entrega.
function OrdersLayout({
  orders, nightMode: n, now, colsOverride, zoomOverride, footerZoom, onFooterZoom, onDeliver,
}: {
  orders: Order[]
  nightMode: boolean
  now: number
  colsOverride: number | null
  zoomOverride: number | null
  footerZoom: number
  onFooterZoom: (z: number) => void
  onDeliver: (order: Order) => void
}) {
  const sorted = [...orders].sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
  const queueOrders = sorted.filter((o) => o.status !== 'ready')
  const readyOrdersList = sorted.filter((o) => o.status === 'ready')

  return (
    <>
      {queueOrders.length === 0 ? (
        <div className={`rounded-3xl p-16 text-center shadow-sm ${n ? 'bg-gray-800' : 'bg-white'}`}>
          <Package size={52} className={`mx-auto mb-4 ${n ? 'text-gray-600' : 'text-gray-300'}`} strokeWidth={1.5} />
          <p className={`text-lg font-semibold ${n ? 'text-gray-500' : 'text-gray-400'}`}>Nenhum pedido na fila</p>
        </div>
      ) : (
        <div
          className={colsOverride === null ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4' : 'grid gap-4'}
          style={{
            zoom: zoomOverride ?? getAutoZoom(queueOrders.length),
            ...(colsOverride !== null ? { gridTemplateColumns: `repeat(${colsOverride}, minmax(0, 1fr))` } : {}),
          }}
        >
          <AnimatePresence mode="popLayout">
            {queueOrders.map((order, idx) => (
              <OrderCard key={order.id} order={order} idx={idx} nightMode={n} now={now} />
            ))}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {readyOrdersList.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className={`mt-4 rounded-3xl px-4 py-3 border max-h-[35vh] flex flex-col ${
              n ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
            }`}
          >
            <div className="flex items-center gap-3 mb-2 shrink-0">
              <span className={`text-base font-black uppercase tracking-widest shrink-0 ${n ? 'text-green-400' : 'text-green-600'}`}>
                Prontas ({readyOrdersList.length})
              </span>
              <div className="flex-1" />
              <span className={`text-xs font-bold uppercase tracking-widest shrink-0 ${n ? 'text-gray-400' : 'text-gray-400'}`}>
                Zoom
              </span>
              <div className={`rounded-xl ${n ? 'bg-gray-800' : 'bg-gray-100'}`}>
                <ZoomControls zoom={footerZoom} onChange={onFooterZoom} steps={FOOTER_ZOOM_STEPS} />
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap overflow-y-auto flex-1 min-h-0" style={{ zoom: footerZoom }}>
              <AnimatePresence mode="popLayout">
                {readyOrdersList.map((order) => (
                  <motion.button
                    key={order.id}
                    layout
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.7 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => onDeliver(order)}
                    title="Marcar como entregue"
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-full font-black text-2xl transition-colors ${
                      isTakeoutTicket(order.ticket_number)
                        ? 'bg-purple-500 hover:bg-purple-600 text-white'
                        : 'bg-green-500 hover:bg-green-600 text-white'
                    }`}
                  >
                    <Check size={20} />
                    #{displayTicket(order.ticket_number)}
                    {isTakeoutTicket(order.ticket_number) && <Plane size={18} />}
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// Letreiro passando as fichas atrasadas (>10min sem ficar pronta) — substitui
// o aviso de "última ficha" enquanto houver alguma atrasada, pois é a
// informação mais urgente para a cozinha ver.
function DelayedMarquee({ orders }: { orders: Order[] }) {
  const tickets = orders.map((o) => displayTicket(o.ticket_number))
  const text = tickets.map((t) => `#${t}`).join('     •     ')

  return (
    <div className="mb-4 rounded-2xl px-4 py-2 bg-red-600 text-white overflow-hidden flex items-center gap-2">
      <style>{`
        @keyframes ks-delayed-marquee {
          from { transform: translateX(100%); }
          to   { transform: translateX(-100%); }
        }
      `}</style>
      <AlertTriangle size={16} className="shrink-0" />
      <span className="text-xs font-black uppercase tracking-widest shrink-0">Atrasadas:</span>
      <div className="flex-1 overflow-hidden">
        <div
          className="whitespace-nowrap font-black text-sm inline-block"
          style={{ animation: `ks-delayed-marquee ${Math.max(8, tickets.length * 3)}s linear infinite` }}
        >
          {text}
        </div>
      </div>
    </div>
  )
}

// Cores e símbolos fixos por número de ficha (mesmo índice) para identificar
// rapidamente o mesmo pedido entre as colunas de setores diferentes.
const FICHA_DOT_COLORS = [
  'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-amber-500',
  'bg-pink-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-lime-500',
  'bg-orange-500', 'bg-teal-500',
]

// Formas simples e bem distintas entre si, fáceis de guardar e achar na tela.
const FICHA_SYMBOLS = ['★', '●', '▲', '♦', '♥', '✿', '☀', '⚡', '✦', '◆']

function ficheNaturalIndex(ticket: string): number {
  const num = parseInt(ticket, 10)
  const idx = !isNaN(num) ? num : ticket.split('').reduce((s, c) => s + c.charCodeAt(0), 0)
  return idx % FICHA_DOT_COLORS.length
}

// Cada ficha tenta usar sua cor/símbolo "natural" (pelo número), mas se isso
// colidir com outra ficha já ativa, ela cede para o próximo símbolo livre.
// Assim, enquanto duas fichas estiverem ativas ao mesmo tempo, nunca repetem
// — o que confundiria quem está acompanhando pela tela.
function assignFichaIndices(tickets: string[]): Map<string, number> {
  const n = FICHA_DOT_COLORS.length
  const unique = Array.from(new Set(tickets)).sort((a, b) => {
    const na = parseInt(a, 10)
    const nb = parseInt(b, 10)
    if (!isNaN(na) && !isNaN(nb)) return na - nb
    return a.localeCompare(b)
  })
  const used = new Set<number>()
  const map = new Map<string, number>()
  for (const ticket of unique) {
    let idx = ficheNaturalIndex(ticket)
    for (let attempts = 0; attempts < n && used.has(idx); attempts++) {
      idx = (idx + 1) % n
    }
    used.add(idx)
    map.set(ticket, idx)
  }
  return map
}

function FichaTag({ ticket, status, qty, nightMode, symbolMode, colorMode, idx }: { ticket: string; status: OrderStatus; qty: number; nightMode?: boolean; symbolMode?: boolean; colorMode?: boolean; idx: number }) {
  const isReady = status === 'ready'
  const isTakeout = isTakeoutTicket(ticket)
  const dotColor = FICHA_DOT_COLORS[idx]
  const symbol = FICHA_SYMBOLS[idx]
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
      {colorMode && <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />}
      {symbolMode && <span className="shrink-0 leading-none">{symbol}</span>}
      {isTakeout && <Plane size={nightMode ? 13 : 11} className="shrink-0" />}
      <span className={isReady ? 'line-through decoration-2 decoration-gray-400/60' : ''}>#{displayTicket(ticket)}</span>
      <span className="opacity-70">×{qty}</span>
    </span>
  )
}
