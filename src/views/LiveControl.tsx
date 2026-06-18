import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, ChefHat, ArrowRight, PackageX, Bell, BellOff } from 'lucide-react'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { displayTicket } from '../utils/ticket'
import {
  subscribeOrders,
  subscribeAllOrders,
  subscribeMenuItems,
  subscribeActiveSession,
  type ActiveSessionData,
} from '../services/firebaseService'
import type { Order, MenuItem, OrderStatus } from '../types'

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Aguardando',
  preparing: 'Em produção',
  ready: 'Pronto',
  delivered: 'Entregue',
}

const STATUS_PILL: Record<OrderStatus, string> = {
  pending:   'bg-yellow-100 text-yellow-800',
  preparing: 'bg-blue-100   text-blue-800',
  ready:     'bg-green-100  text-green-700',
  delivered: 'bg-gray-100   text-gray-500',
}

const SECTOR_COLOR: Record<string, string> = {
  Fritadeira: '#FF8800',
  Chapa:      '#4488FF',
  Assados:    '#9966CC',
}

interface ActivityEvent {
  id: number
  time: Date
  type: 'new' | 'status'
  ticket: string
  status?: OrderStatus
  prevStatus?: OrderStatus
  items?: string
}

function isToday(d: Date) {
  const n = new Date()
  return d.getDate() === n.getDate() && d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear()
}

function ageMin(d: Date) {
  return Math.floor((Date.now() - d.getTime()) / 60000)
}

function AgeBadge({ createdAt }: { createdAt: Date }) {
  const min = ageMin(createdAt)
  const cls =
    min >= 15 ? 'text-red-600 font-black animate-pulse' :
    min >= 10 ? 'text-orange-600 font-bold' :
    min >= 5  ? 'text-yellow-600 font-semibold' :
                'text-gray-400'
  return (
    <span className={`text-xs tabular-nums shrink-0 ${cls}`}>
      {min}min{min >= 10 ? ' ⚠️' : ''}
    </span>
  )
}

export default function LiveControl() {
  const [activeOrders, setActiveOrders]     = useState<Order[]>([])
  const [todayDelivered, setTodayDelivered] = useState<Order[]>([])
  const [lowStock, setLowStock]             = useState<MenuItem[]>([])
  const [activityLog, setActivityLog]       = useState<ActivityEvent[]>([])
  const [liveSession, setLiveSession]       = useState<ActiveSessionData | null>(null)
  const [, setTick]                         = useState(0)

  const prevStatusMap  = useRef<Map<string, OrderStatus>>(new Map())
  const isInitialLoad  = useRef(true)
  const eventIdCounter = useRef(0)

  // Refresh age badges every 30s
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30000)
    return () => clearInterval(t)
  }, [])

  // Active orders
  useEffect(() => {
    return subscribeOrders(['pending', 'preparing', 'ready'], (orders) =>
      setActiveOrders([...orders].sort((a, b) => a.created_at.getTime() - b.created_at.getTime()))
    )
  }, [])

  // All orders → activity log + today delivered
  useEffect(() => {
    return subscribeAllOrders((all) => {
      setTodayDelivered(all.filter((o) => o.status === 'delivered' && isToday(o.created_at)))

      if (isInitialLoad.current) {
        all.forEach((o) => prevStatusMap.current.set(o.id, o.status))
        isInitialLoad.current = false
        return
      }

      const newEvents: ActivityEvent[] = []
      all.forEach((order) => {
        const prev = prevStatusMap.current.get(order.id)
        if (prev === undefined) {
          newEvents.push({
            id: ++eventIdCounter.current,
            time: new Date(),
            type: 'new',
            ticket: order.ticket_number,
            items: order.items.slice(0, 3).map((i) => i.name).join(', ') + (order.items.length > 3 ? '…' : ''),
          })
        } else if (prev !== order.status) {
          newEvents.push({
            id: ++eventIdCounter.current,
            time: new Date(),
            type: 'status',
            ticket: order.ticket_number,
            status: order.status,
            prevStatus: prev,
          })
        }
        prevStatusMap.current.set(order.id, order.status)
      })

      if (newEvents.length > 0) {
        setActivityLog((prev) => [...newEvents.reverse(), ...prev].slice(0, 40))
      }
    })
  }, [])

  // Low stock
  useEffect(() => {
    return subscribeMenuItems((items) =>
      setLowStock(items.filter((i) => i.stock_initial && i.stock !== undefined && i.stock <= 15))
    )
  }, [])

  // Reception live session
  useEffect(() => {
    return subscribeActiveSession(setLiveSession)
  }, [])

  // ── Derived values ──────────────────────────────────────────────────────────
  const pending   = activeOrders.filter((o) => o.status === 'pending')
  const preparing = activeOrders.filter((o) => o.status === 'preparing')
  const ready     = activeOrders.filter((o) => o.status === 'ready')

  const todayRevenue = useMemo(
    () => todayDelivered.reduce((s, o) => s + o.items.reduce((is, i) => is + i.price * i.quantity, 0), 0),
    [todayDelivered]
  )

  const slowOrders = activeOrders.filter(
    (o) => o.status !== 'ready' && ageMin(o.created_at) >= 10
  )

  const sectorLoad = useMemo(() => {
    const map: Record<string, { qty: number; fichas: Set<string> }> = {}
    activeOrders
      .filter((o) => o.status !== 'ready')
      .forEach((order) => {
        order.items.forEach((item) => {
          const rawSector = item.sector || 'Assados'
          const s = ({ Lanches: 'Chapa', Outros: 'Assados' } as Record<string, string>)[rawSector] ?? rawSector
          if (!map[s]) map[s] = { qty: 0, fichas: new Set() }
          map[s].qty += item.quantity
          map[s].fichas.add(order.ticket_number)
        })
      })
    return Object.entries(map).sort((a, b) => b[1].qty - a[1].qty)
  }, [activeOrders])

  const maxSectorQty = sectorLoad[0]?.[1].qty ?? 1

  const alerts: { severity: 'danger' | 'warn'; text: string }[] = [
    ...slowOrders.map((o) => ({
      severity: (ageMin(o.created_at) >= 15 ? 'danger' : 'warn') as 'danger' | 'warn',
      text: `Ficha #${displayTicket(o.ticket_number)} em ${STATUS_LABEL[o.status].toLowerCase()} há ${ageMin(o.created_at)}min`,
    })),
    ...lowStock.map((i) => ({
      severity: (i.stock === 0 ? 'danger' : 'warn') as 'danger' | 'warn',
      text: `${i.name}: ${i.stock === 0 ? 'ZERADO' : `${i.stock} un. restantes`}`,
    })),
  ]

  const kpis = [
    { label: 'Aguardando',      value: pending.length,        color: 'text-yellow-700', bg: 'bg-yellow-50',  border: 'border-yellow-200' },
    { label: 'Em produção',     value: preparing.length,      color: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-200'   },
    { label: 'Prontos',         value: ready.length,          color: 'text-green-700',  bg: 'bg-green-50',   border: 'border-green-200'  },
    { label: 'Entregues hoje',  value: todayDelivered.length, color: 'text-accent',     bg: 'bg-accent/10',  border: 'border-accent/20'  },
    {
      label: 'Faturamento hoje',
      value: `R$ ${todayRevenue.toFixed(2).replace('.', ',')}`,
      color: 'text-purple-700',
      bg: 'bg-purple-50',
      border: 'border-purple-200',
    },
  ]

  const push = usePushNotifications()

  return (
    <div className="space-y-4">

      {/* Live header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ opacity: [1, 0.2, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            className="w-3 h-3 rounded-full bg-red-500"
          />
          <span className="text-xs font-black uppercase tracking-widest text-red-600">Ao Vivo</span>
        </div>
        {alerts.length > 0 && (
          <motion.span
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="text-xs font-bold bg-red-100 text-red-700 px-3 py-1 rounded-full flex items-center gap-1"
          >
            <AlertTriangle size={11} />
            {alerts.length} alerta{alerts.length !== 1 ? 's' : ''}
          </motion.span>
        )}
        {push.supported && (
          <button
            onClick={() => (push.subscribed ? push.unsubscribe() : push.subscribe())}
            disabled={push.loading}
            className={`ml-auto text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-colors ${
              push.subscribed ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            title={push.subscribed ? 'Desativar alertas no celular' : 'Receber alertas de estoque baixo no celular'}
          >
            {push.subscribed ? <Bell size={13} /> : <BellOff size={13} />}
            {push.subscribed ? 'Alertas ativos' : 'Ativar alertas no celular'}
          </button>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpis.map(({ label, value, color, bg, border }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`rounded-3xl border p-4 ${bg} ${border}`}
          >
            <p className={`text-2xl font-black leading-none ${color}`}>{value}</p>
            <p className="text-xs text-gray-500 mt-1">{label}</p>
          </motion.div>
        ))}
      </div>

      {/* Alerts */}
      <AnimatePresence>
        {alerts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3"
          >
            <p className="text-[10px] font-black uppercase tracking-widest text-red-500 mb-2 flex items-center gap-1">
              <AlertTriangle size={11} /> Alertas ativos
            </p>
            <div className="flex flex-wrap gap-2">
              {alerts.map((a, i) => (
                <span
                  key={i}
                  className={`text-xs font-semibold px-3 py-1 rounded-full ${
                    a.severity === 'danger' ? 'bg-red-200 text-red-900' : 'bg-orange-100 text-orange-800'
                  }`}
                >
                  {a.severity === 'danger' ? '🔴' : '⚠️'} {a.text}
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Active queue — 2 cols */}
        <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-serif italic text-accent-dark text-base">Fila ativa</h2>
            <span className="text-[11px] text-gray-400">
              {activeOrders.length} pedido{activeOrders.length !== 1 ? 's' : ''} · mais antigo primeiro
            </span>
          </div>

          {activeOrders.length === 0 ? (
            <div className="py-14 text-center">
              <ChefHat size={40} className="mx-auto mb-2 text-gray-200" strokeWidth={1.5} />
              <p className="text-sm text-gray-300 italic">Cozinha livre no momento</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 max-h-[420px] overflow-y-auto">
              <AnimatePresence>
                {activeOrders.map((order) => {
                  const min = ageMin(order.created_at)
                  const rowBg =
                    min >= 15 ? 'bg-red-50/60' :
                    min >= 10 ? 'bg-orange-50/60' : ''
                  return (
                    <motion.div
                      key={order.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className={`px-5 py-3 flex items-center gap-3 ${rowBg}`}
                    >
                      <span className="font-black text-lg text-gray-800 w-12 shrink-0 tabular-nums">
                        #{displayTicket(order.ticket_number)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-600 truncate leading-relaxed">
                          {order.items.map((i) => `${i.name}${i.quantity > 1 ? ` ×${i.quantity}` : ''}`).join(' · ')}
                        </p>
                      </div>
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full shrink-0 uppercase tracking-wide ${STATUS_PILL[order.status]}`}>
                        {STATUS_LABEL[order.status]}
                      </span>
                      <AgeBadge createdAt={order.created_at} />
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">

          {/* Reception live preview */}
          <AnimatePresence>
            {liveSession && (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                className="bg-accent rounded-3xl p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-white/60 text-[10px] uppercase tracking-widest">Recepção — digitando</p>
                    <p className="text-white font-black text-2xl leading-none">#{displayTicket(liveSession.ficha)}</p>
                  </div>
                  <motion.div
                    animate={{ opacity: [1, 0.2, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="w-2.5 h-2.5 rounded-full bg-white/70"
                  />
                </div>
                {liveSession.items.length > 0 && (
                  <div className="space-y-1 mt-2">
                    {liveSession.items.slice(0, 4).map((item) => (
                      <div key={item.name} className="flex justify-between text-xs bg-white/10 rounded-xl px-2.5 py-1">
                        <span className="text-white/90">{item.name}</span>
                        <span className="text-white font-bold">×{item.quantity}</span>
                      </div>
                    ))}
                    {liveSession.items.length > 4 && (
                      <p className="text-white/40 text-[10px] text-center">+{liveSession.items.length - 4} mais</p>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Sector workload */}
          <div className="bg-white rounded-3xl shadow-sm p-4">
            <h2 className="font-serif italic text-accent-dark text-base mb-3">Carga por setor</h2>
            {sectorLoad.length === 0 ? (
              <p className="text-xs text-gray-300 text-center py-3 italic">Sem produção ativa</p>
            ) : (
              <div className="space-y-3">
                {sectorLoad.map(([sector, { qty, fichas }]) => (
                  <div key={sector}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-semibold text-gray-700">{sector}</span>
                      <span className="text-gray-400 tabular-nums">
                        {qty} it. · {fichas.size} ficha{fichas.size !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div
                        animate={{ width: `${(qty / maxSectorQty) * 100}%` }}
                        transition={{ duration: 0.4 }}
                        className="h-full rounded-full"
                        style={{ background: SECTOR_COLOR[sector] ?? '#5A5A40' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Activity feed */}
          <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="font-serif italic text-accent-dark text-base">Atividade recente</h2>
            </div>
            {activityLog.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-gray-300 italic">
                Aguardando eventos...
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
                <AnimatePresence initial={false}>
                  {activityLog.map((event) => (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="px-4 py-2 flex items-center gap-2"
                    >
                      <span className="text-[10px] tabular-nums text-gray-300 w-9 shrink-0">
                        {event.time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>

                      {event.type === 'new' ? (
                        <>
                          <span className="text-[9px] bg-green-100 text-green-700 font-black px-1.5 py-0.5 rounded shrink-0 uppercase">
                            Novo
                          </span>
                          <span className="text-xs text-gray-700 flex-1 truncate">
                            <strong>#{displayTicket(event.ticket)}</strong>
                            {event.items && (
                              <span className="text-gray-400 font-normal"> · {event.items}</span>
                            )}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-xs font-bold text-gray-500 shrink-0">#{displayTicket(event.ticket)}</span>
                          <span className="text-[10px] text-gray-400 flex items-center gap-0.5 shrink-0">
                            {event.prevStatus && STATUS_LABEL[event.prevStatus]}
                            <ArrowRight size={9} className="mx-0.5" />
                            <span className={
                              event.status === 'delivered' ? 'text-green-600 font-bold' :
                              event.status === 'ready'     ? 'text-green-500 font-bold' :
                              event.status === 'preparing' ? 'text-blue-500 font-bold'  : ''
                            }>
                              {event.status && STATUS_LABEL[event.status]}
                            </span>
                          </span>
                        </>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Almost out of stock */}
          {lowStock.length > 0 && (
            <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-1.5">
                <PackageX size={15} className="text-red-500" />
                <h2 className="font-serif italic text-accent-dark text-base">Prestes a Acabar</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {[...lowStock]
                  .sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0))
                  .slice(0, 4)
                  .map((item) => (
                    <div key={item.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-gray-700 truncate">{item.name}</span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${
                        item.stock === 0 ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {item.stock === 0 ? 'ZERADO' : `${item.stock} un.`}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
