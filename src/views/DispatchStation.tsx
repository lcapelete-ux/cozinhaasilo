import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Package, Check, QrCode, Keyboard, Hash, Moon, Sun, Plane, AlertTriangle, Clock } from 'lucide-react'
import { subscribeOrders, setOrderStatus, resolveFicha, getActiveOrderByTicket, getOrderByTicket, deleteOrder, subscribeAllOrders, subscribeMenuItems, createOrder, setActiveSession, clearActiveSession } from '../services/firebaseService'
import readySound from '../assets/ready.mp3'
import { useApp } from '../App'
import { useScanner } from '../hooks/useScanner'
import { isTakeoutTicket, displayTicket, parseManualTicket, isCupomCode, matchProductByScan } from '../utils/ticket'
import ZoomControls, { ZOOM_STEPS } from '../components/ZoomControls'
import { OrderCard, ColumnsControl, getAutoZoom, COLS_STEPS_RANGE } from '../components/OrderCard'

// A barra de "Prontas" precisa encolher mais que a grade principal em TVs
// grandes, então tem sua própria faixa de zoom com mínimos menores.
const FOOTER_ZOOM_STEPS = [0.4, 0.5, 0.6, 0.7, 0.75, 0.85, 1, 1.15, 1.3, 1.5]
import type { Order, OrderStatus, MenuItem } from '../types'

const NIGHT_KEY = 'dispatch-night'
const ZOOM_KEY = 'dispatch-zoom'
const COLS_KEY = 'dispatch-cols'
const FOOTER_ZOOM_KEY = 'dispatch-footer-zoom'

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

export default function DispatchStation() {
  const { addToast } = useApp()
  const [orders, setOrders] = useState<Order[]>([])
  const [inputMode, setInputMode] = useState<'qr' | 'keyboard' | null>(null)
  const [manualInput, setManualInput] = useState('')
  const [nightMode, setNightMode] = useState(() => localStorage.getItem(NIGHT_KEY) === 'true')
  const [zoomOverride, setZoomOverride] = useState<number | null>(() => {
    const saved = localStorage.getItem(ZOOM_KEY)
    const val = saved ? parseFloat(saved) : NaN
    return ZOOM_STEPS.includes(val) ? val : null
  })
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
  const [now, setNow] = useState(Date.now())

  const [releasedFicha, setReleasedFicha] = useState<string | null>(null)
  const [cancelledFicha, setCancelledFicha] = useState<string | null>(null)
  const [lastScanned, setLastScanned] = useState('')
  const [deliveredOrders, setDeliveredOrders] = useState<Order[]>([])
  const [clockTime, setClockTime] = useState(() =>
    new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  )

  const ordersRef = useRef<Order[]>([])
  const prevStatusMapRef = useRef<Map<string, string>>(new Map())
  const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scanTicketRef = useRef<string | null>(null)
  const scanCountRef = useRef(0)
  const scanTimeRef = useRef(0)
  const manualRef = useRef<HTMLInputElement>(null)

  // Background order entry (hidden — same as Display panel)
  const menuItemsRef = useRef<MenuItem[]>([])
  const bgFichaRef = useRef<string | null>(null)
  const bgItemsRef = useRef<Order['items']>([])
  const bgCountdownRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const n = nightMode

  useEffect(() => { ordersRef.current = orders }, [orders])

  useEffect(() => {
    return subscribeMenuItems((items) => { menuItemsRef.current = items })
  }, [])

  const confirmBgSession = useCallback(async () => {
    const ficha = bgFichaRef.current
    const items = bgItemsRef.current
    bgFichaRef.current = null
    bgItemsRef.current = []
    await clearActiveSession()
    if (!ficha || items.length === 0) return
    try {
      await createOrder(ficha, items)
    } catch (e) {
      console.error('Dispatch bg-entry failed:', e)
    }
  }, [])

  const restartBgCountdown = useCallback(() => {
    if (bgCountdownRef.current) clearTimeout(bgCountdownRef.current)
    bgCountdownRef.current = setTimeout(confirmBgSession, 45000)
  }, [confirmBgSession])

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
      setDeliveredOrders(allOrders.filter((o) => o.status === 'delivered'))
    })
    return () => {
      unsub()
      if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current)
    }
  }, [])

  // Tempo médio de entrega — mesmo cálculo do Dashboard/Setores (minutos
  // entre criação e entrega, descartando < 0 e ≥ 180 min).
  const avgDeliveryTime = useMemo(() => {
    const times = deliveredOrders
      .map((o) => (o.updated_at.getTime() - o.created_at.getTime()) / 60000)
      .filter((t) => t > 0 && t < 180)
    return times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0
  }, [deliveredOrders])

  useEffect(() => {
    const id = setInterval(() => {
      setClockTime(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
    }, 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    return () => {
      if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current)
      if (bgCountdownRef.current) clearTimeout(bgCountdownRef.current)
    }
  }, [])

  const toggleNight = () => {
    const next = !nightMode
    setNightMode(next)
    localStorage.setItem(NIGHT_KEY, String(next))
  }

  const handleZoom = (z: number) => {
    setZoomOverride(z)
    localStorage.setItem(ZOOM_KEY, String(z))
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

  const flashMode = useCallback((mode: 'qr' | 'keyboard') => {
    setInputMode(mode)
    setTimeout(() => setInputMode(null), 1500)
  }, [])

  const handleDeliver = useCallback(async (order: Order) => {
    try {
      await setOrderStatus(order.id, 'delivered')
      addToast(`Ficha #${displayTicket(order.ticket_number)} entregue! ✅`, 'success')
    } catch {
      addToast('Erro ao entregar')
    }
  }, [addToast])

  const processTicket = useCallback(async (raw: string, isQr: boolean) => {
    if (isQr) flashMode('qr')
    else flashMode('keyboard')

    // Manual numeric keypad shows/expects the on-screen number (100-120);
    // QR/barcode scans already carry the real ficha (200-220) — untouched.
    if (!isQr) raw = parseManualTicket(raw)

    // Check product code first (4+ digits matching a menu item) — hidden, no feedback
    const digits = raw.trim().replace(/\D/g, '')
    if (digits.length >= 4) {
      const matched = matchProductByScan(menuItemsRef.current, digits)
      if (matched) {
        if (bgFichaRef.current) {
          const existing = bgItemsRef.current.find((i) => i.name === matched.name)
          if (existing) existing.quantity += 1
          else bgItemsRef.current.push({ name: matched.name, quantity: 1, sector: matched.sector, price: matched.price, completed: false })
          setActiveSession({ ficha: bgFichaRef.current, items: bgItemsRef.current.map((i) => ({ name: i.name, quantity: i.quantity, sector: i.sector })) })
          restartBgCountdown()
        }
        return
      }
    }

    // Cupom de produto não cadastrado (formato "0844-124791") não pode cair no
    // fallback de ficha — os dígitos do cupom não são um número de ficha.
    if (isCupomCode(raw)) {
      addToast('Código de produto não cadastrado — vá em Configurações → Cardápio')
      return
    }

    // Ficha logic
    try {
      const ticket = await resolveFicha(raw)
      if (!ticket) {
        addToast('Leitura não reconhecida — bipe novamente')
        return
      }
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
      if (!order) {
        // No active order → start a background session for this ficha
        if (bgCountdownRef.current) clearTimeout(bgCountdownRef.current)
        await confirmBgSession()
        bgFichaRef.current = ticket
        bgItemsRef.current = []
        setActiveSession({ ficha: ticket, items: [] })
        restartBgCountdown()
        return
      }
      let nextStatus: OrderStatus | null = null
      if (order.status === 'pending' || order.status === 'preparing') nextStatus = 'ready'
      else if (order.status === 'ready') nextStatus = 'delivered'
      if (!nextStatus) return
      await setOrderStatus(order.id, nextStatus)
      if (nextStatus === 'ready') {
        playReadySound()
        addToast(`Ficha #${displayTicket(ticket)} pronta! 🔔 Aparece no painel.`, 'success')
      } else {
        playDeliveredSound()
        addToast(`Ficha #${displayTicket(ticket)} entregue! ✅ Liberada para uso.`, 'success')
      }
    } catch {
      addToast('Erro ao processar ficha')
    }
  }, [flashMode, addToast, confirmBgSession, restartBgCountdown])

  useScanner((val) => processTicket(val, true))

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (manualInput.trim()) { processTicket(manualInput.trim(), false); setManualInput('') }
  }

  const queueOrders = orders.filter((o) => o.status !== 'ready')
  const readyOrdersList = orders.filter((o) => o.status === 'ready')
  const readyCount = readyOrdersList.length
  const totalCount = orders.length
  const oldCount = orders.filter((o) => (now - o.created_at.getTime()) > 10 * 60 * 1000).length

  return (
    <div className={`min-h-screen transition-colors duration-300 ${n ? 'bg-gray-950' : 'bg-background'}`}>
      <div className="p-4 md:p-6">

        {/* Header */}
        <div className="relative flex flex-wrap items-center gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className={`font-serif italic text-2xl md:text-3xl flex items-center gap-2 ${n ? 'text-white' : 'text-accent-dark'}`}>
                <Package className="text-accent" size={26} />
                Separação de Pedidos
              </h1>
              {avgDeliveryTime > 0 && (
                <div className="flex flex-col items-start">
                  <span className={`text-[10px] font-semibold tracking-widest uppercase ${n ? 'text-gray-500' : 'text-gray-400'}`}>
                    Tempo médio de entrega do pedido
                  </span>
                  <span
                    title="Tempo médio de entrega (mesmo cálculo do Dashboard)"
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-sm font-bold ${
                      n ? 'bg-orange-950/40 text-orange-300' : 'bg-orange-50 text-orange-600'
                    }`}
                  >
                    <Clock size={15} />
                    {avgDeliveryTime} min
                  </span>
                </div>
              )}
            </div>
            <p className={`text-xs font-semibold uppercase tracking-widest mt-0.5 ${n ? 'text-gray-500' : 'text-gray-400'}`}>
              {totalCount} pedido{totalCount !== 1 ? 's' : ''} na fila
              {readyCount > 0 && (
                <span className="ml-2 text-green-500">· {readyCount} pronto{readyCount !== 1 ? 's' : ''}</span>
              )}
            </p>
          </div>

          {/* Clock — centered */}
          <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none select-none hidden md:block">
            <span className={`font-mono font-black text-3xl md:text-4xl tracking-widest tabular-nums ${n ? 'text-white/25' : 'text-gray-200'}`}>
              {clockTime}
            </span>
          </div>

          <div className="flex flex-col items-end gap-1.5 ml-auto">
            <div className="flex items-center gap-3 flex-wrap">
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

              <ZoomControls
                zoom={zoomOverride ?? getAutoZoom(queueOrders.length)}
                onChange={handleZoom}
              />

              <ColumnsControl cols={colsOverride} onChange={handleCols} />
            </div>

            <AnimatePresence>
              {oldCount > 0 && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: [1, 1.08, 1] }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  transition={{ scale: { duration: 1.2, repeat: Infinity } }}
                  className="flex items-center gap-1 bg-red-500 text-white text-xs font-black px-2.5 py-1 rounded-full"
                  title="Fichas com mais de 10 minutos na fila"
                >
                  <AlertTriangle size={12} />
                  {oldCount} atrasada{oldCount !== 1 ? 's' : ''}
                </motion.span>
              )}
            </AnimatePresence>
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
            className={`mb-4 rounded-2xl px-4 py-2 text-sm border flex items-center gap-2 ${
              n ? 'bg-accent/20 border-accent/30 text-accent' : 'bg-accent/10 border-accent/20 text-accent-dark'
            }`}
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

        {/* Orders grid */}
        {queueOrders.length === 0 ? (
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
          <div
            className={colsOverride === null ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4' : 'grid gap-4'}
            style={{
              zoom: zoomOverride ?? getAutoZoom(queueOrders.length),
              ...(colsOverride !== null ? { gridTemplateColumns: `repeat(${colsOverride}, minmax(0, 1fr))` } : {}),
            }}
          >
            <AnimatePresence mode="popLayout">
              {queueOrders.map((order, idx) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  idx={idx}
                  nightMode={n}
                  now={now}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Ready section — fichas prontas para entregar, logo abaixo da fila de pedidos */}
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
                  <ZoomControls zoom={footerZoom} onChange={handleFooterZoom} steps={FOOTER_ZOOM_STEPS} />
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
                      onClick={() => handleDeliver(order)}
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
      </div>
    </div>
  )
}
