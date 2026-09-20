import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, Calendar, Trash2, Check, X, ChevronDown, AlertCircle } from 'lucide-react'
import { subscribeAllOrders, deleteOrder } from '../services/firebaseService'
import { displayTicket } from '../utils/ticket'
import { useApp } from '../App'
import type { Order, OrderStatus } from '../types'

type StatusFilter = 'all' | 'active' | 'delivered'

const STATUS_META: Record<OrderStatus, { label: string; chip: string; dot: string }> = {
  pending: { label: 'Aguardando', chip: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  preparing: { label: 'Preparando', chip: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  ready: { label: 'Pronto', chip: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  delivered: { label: 'Entregue', chip: 'bg-gray-100 text-gray-500', dot: 'bg-gray-400' },
}

const hhmm = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const orderValue = (o: Order) => o.items.reduce((s, i) => s + i.price * i.quantity, 0)
const isActive = (o: Order) => o.status !== 'delivered'
const localDay = (d: Date) => d.toLocaleDateString('sv') // YYYY-MM-DD no fuso local

interface FichaGroup {
  ticket: string
  orders: Order[]
  active: Order[]
  lastUse: number
  totalValue: number
  itemTotals: { name: string; quantity: number }[]
  // Usos da ficha no evento inteiro. Fica acima de orders.length quando um
  // filtro está ativo, para o contador nunca sugerir que a ficha foi usada
  // menos vezes do que realmente foi.
  totalUses: number
}

function groupByFicha(orders: Order[], usesByTicket: Map<string, number>): FichaGroup[] {
  const map = new Map<string, Order[]>()
  orders.forEach((o) => {
    const list = map.get(o.ticket_number)
    if (list) list.push(o)
    else map.set(o.ticket_number, [o])
  })

  return Array.from(map.entries())
    .map(([ticket, list]) => {
      const chronological = [...list].sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
      const qty = new Map<string, number>()
      chronological.forEach((o) =>
        o.items.forEach((i) => qty.set(i.name, (qty.get(i.name) ?? 0) + i.quantity))
      )
      return {
        ticket,
        orders: chronological,
        active: chronological.filter(isActive),
        lastUse: chronological[chronological.length - 1].created_at.getTime(),
        totalValue: chronological.reduce((s, o) => s + orderValue(o), 0),
        itemTotals: Array.from(qty.entries())
          .map(([name, quantity]) => ({ name, quantity }))
          .sort((a, b) => b.quantity - a.quantity),
        totalUses: usesByTicket.get(ticket) ?? chronological.length,
      }
    })
    .sort((a, b) => b.lastUse - a.lastUse)
}

// Linha do tempo real do pedido: um marco por mudança de status, com o horário
// em que ela aconteceu. É o registro que permite conferir o que de fato
// ocorreu quando a tela de entrega falha.
function StatusTimeline({ order }: { order: Order }) {
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 mt-2">
      {order.status_history.map((step, i) => {
        const meta = STATUS_META[step.status]
        return (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-gray-300 text-xs">→</span>}
            <span className="flex items-center gap-1 text-xs text-gray-600">
              <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
              {meta.label}
              <span className="tabular-nums text-gray-400">{hhmm(step.at)}</span>
            </span>
          </span>
        )
      })}
    </div>
  )
}

function OrderRow({
  order,
  index,
  confirmId,
  setConfirmId,
  onDelete,
}: {
  order: Order
  index: number
  confirmId: string | null
  setConfirmId: (id: string | null) => void
  onDelete: (id: string) => void
}) {
  const meta = STATUS_META[order.status]
  const active = isActive(order)

  return (
    <div className={`rounded-2xl p-3 ${active ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'}`}>
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-12 text-center">
          <p className="text-[10px] uppercase tracking-wide text-gray-400">Uso</p>
          <p className="text-lg font-black text-accent-dark leading-none">{index + 1}</p>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold ${meta.chip}`}>
              {meta.label}
            </span>
            <span className="text-xs text-gray-400 tabular-nums">
              {order.created_at.toLocaleDateString('pt-BR')} às {hhmm(order.created_at)}
            </span>
          </div>

          <div className="flex flex-wrap gap-1">
            {order.items.map((item, j) => (
              <span key={j} className="text-xs bg-white border border-gray-200 text-gray-700 px-2 py-0.5 rounded-lg">
                {item.name} <strong className="text-accent-dark">×{item.quantity}</strong>
              </span>
            ))}
          </div>

          <StatusTimeline order={order} />
        </div>

        <div className="shrink-0 text-right flex flex-col items-end gap-2">
          <p className="font-medium text-accent-dark text-sm whitespace-nowrap">
            R$ {orderValue(order).toFixed(2)}
          </p>
          {confirmId === order.id ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onDelete(order.id)}
                title="Confirmar exclusão (pedido de teste)"
                className="w-7 h-7 rounded-lg bg-red-500 hover:bg-red-600 text-white flex items-center justify-center"
              >
                <Check size={13} />
              </button>
              <button
                onClick={() => setConfirmId(null)}
                title="Cancelar"
                className="w-7 h-7 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-500 flex items-center justify-center"
              >
                <X size={13} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmId(order.id)}
              title="Excluir pedido de teste (some das estatísticas)"
              className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 flex items-center justify-center"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function History() {
  const { addToast } = useApp()
  const [orders, setOrders] = useState<Order[]>([])
  const [dateFilter, setDateFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [openFichas, setOpenFichas] = useState<Set<string>>(new Set())

  useEffect(() => {
    const unsub = subscribeAllOrders(setOrders)
    return unsub
  }, [])

  const handleDelete = async (id: string) => {
    try {
      await deleteOrder(id)
      addToast('Pedido excluído! Estatísticas e faturamento já foram atualizados.', 'success')
    } catch {
      addToast('Erro ao excluir pedido')
    } finally {
      setConfirmId(null)
    }
  }

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (dateFilter && localDay(o.created_at) !== dateFilter) return false
      if (statusFilter === 'active') return isActive(o)
      if (statusFilter === 'delivered') return o.status === 'delivered'
      return true
    })
  }, [orders, dateFilter, statusFilter])

  const usesByTicket = useMemo(() => {
    const map = new Map<string, number>()
    orders.forEach((o) => map.set(o.ticket_number, (map.get(o.ticket_number) ?? 0) + 1))
    return map
  }, [orders])

  const groups = useMemo(() => groupByFicha(filtered, usesByTicket), [filtered, usesByTicket])

  const stats = useMemo(() => {
    const activeOrders = filtered.filter(isActive)
    const deliveredOrders = filtered.filter((o) => o.status === 'delivered')
    return {
      fichas: groups.length,
      active: activeOrders.length,
      delivered: deliveredOrders.length,
      revenue: deliveredOrders.reduce((s, o) => s + orderValue(o), 0),
    }
  }, [filtered, groups])

  // Pedidos em aberto no evento inteiro — independem dos filtros, pois são o
  // alerta de que algo pode não ter sido baixado na entrega.
  const openAcrossEvent = useMemo(() => orders.filter(isActive).length, [orders])

  const toggleFicha = (ticket: string) =>
    setOpenFichas((prev) => {
      const next = new Set(prev)
      if (next.has(ticket)) next.delete(ticket)
      else next.add(ticket)
      return next
    })

  const allOpen = groups.length > 0 && groups.every((g) => openFichas.has(g.ticket))
  const toggleAll = () =>
    setOpenFichas(allOpen ? new Set() : new Set(groups.map((g) => g.ticket)))

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <div className="mb-5 flex flex-wrap items-center gap-4">
        <div>
          <h1 className="font-serif italic text-3xl text-accent-dark flex items-center gap-2">
            <Clock className="text-accent" size={28} />
            Histórico
          </h1>
          <p className="text-gray-500 text-sm">
            {stats.fichas} ficha(s) · {filtered.length} pedido(s)
          </p>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-gray-400" />
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-accent text-sm"
          />
          {dateFilter && (
            <button onClick={() => setDateFilter('')} className="text-xs text-gray-400 hover:text-gray-600">
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Alerta de pedidos em aberto */}
      {openAcrossEvent > 0 && (
        <div className="mb-5 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
          <AlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-semibold">
              {openAcrossEvent} pedido(s) ainda em andamento
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Não foram marcados como entregues. Confira aqui o que cada ficha pediu e em que
              horário antes de corrigir na tela de entrega.
            </p>
          </div>
        </div>
      )}

      {/* Filtro de status */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <div className="flex rounded-2xl bg-gray-100 p-1">
          {([
            { id: 'all', label: 'Todos' },
            { id: 'active', label: 'Em andamento' },
            { id: 'delivered', label: 'Entregues' },
          ] as { id: StatusFilter; label: string }[]).map((f) => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={`px-4 py-1.5 rounded-xl text-sm font-semibold transition-colors ${
                statusFilter === f.id
                  ? 'bg-white shadow-sm text-accent-dark'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        {groups.length > 0 && (
          <button
            onClick={toggleAll}
            className="text-xs font-semibold text-accent hover:text-accent-dark px-3 py-1.5 rounded-xl hover:bg-gray-100 transition-colors"
          >
            {allOpen ? 'Recolher tudo' : 'Expandir tudo'}
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-3xl p-4 shadow-sm text-center">
          <p className="text-2xl font-black text-accent-dark">{stats.fichas}</p>
          <p className="text-xs text-gray-500">Fichas usadas</p>
        </div>
        <div className="bg-white rounded-3xl p-4 shadow-sm text-center">
          <p className={`text-2xl font-black ${stats.active > 0 ? 'text-amber-500' : 'text-accent-dark'}`}>
            {stats.active}
          </p>
          <p className="text-xs text-gray-500">Em andamento</p>
        </div>
        <div className="bg-white rounded-3xl p-4 shadow-sm text-center">
          <p className="text-2xl font-black text-accent-dark">{stats.delivered}</p>
          <p className="text-xs text-gray-500">Entregues</p>
        </div>
        <div className="bg-white rounded-3xl p-4 shadow-sm text-center">
          <p className="text-2xl font-black text-accent-dark">R$ {stats.revenue.toFixed(2)}</p>
          <p className="text-xs text-gray-500">Faturamento entregue</p>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center shadow-sm">
          <Clock size={48} className="mx-auto mb-3 text-gray-300" />
          <p className="text-gray-400">Nenhum pedido encontrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group, i) => {
            const open = openFichas.has(group.ticket)
            const reused = group.totalUses > 1
            const partial = group.orders.length < group.totalUses
            return (
              <motion.div
                key={group.ticket}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.3) }}
                className={`bg-white rounded-2xl shadow-sm overflow-hidden ${
                  group.active.length > 0 ? 'ring-1 ring-amber-300' : ''
                }`}
              >
                {/* Cabeçalho da ficha */}
                <button
                  onClick={() => toggleFicha(group.ticket)}
                  className="w-full text-left p-4 flex items-start gap-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="shrink-0 text-center">
                    <p className="text-xs text-gray-400">Ficha</p>
                    <p className="text-xl font-black text-accent-dark">
                      #{displayTicket(group.ticket)}
                    </p>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-lg ${
                          reused ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {partial
                          ? `${group.orders.length} de ${group.totalUses} usos`
                          : `${group.totalUses}× usada`}
                      </span>
                      {group.active.length > 0 && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-amber-100 text-amber-700">
                          {group.active.length} em andamento
                        </span>
                      )}
                    </div>

                    {/* Quantidades somadas de todos os usos da ficha */}
                    <div className="flex flex-wrap gap-1">
                      {group.itemTotals.map((item) => (
                        <span
                          key={item.name}
                          className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-lg"
                        >
                          {item.name} <strong className="text-accent-dark">×{item.quantity}</strong>
                        </span>
                      ))}
                    </div>

                    {/* Resumo do que está aberto, visível sem expandir */}
                    {group.active.map((o) => (
                      <p key={o.id} className="text-xs text-amber-700 mt-1.5">
                        <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${STATUS_META[o.status].dot}`} />
                        {STATUS_META[o.status].label} desde {hhmm(o.created_at)} ·{' '}
                        {o.items.map((it) => `${it.name} ×${it.quantity}`).join(', ')}
                      </p>
                    ))}
                  </div>

                  <div className="shrink-0 text-right flex flex-col items-end gap-1">
                    <p className="font-medium text-accent-dark text-sm whitespace-nowrap">
                      R$ {group.totalValue.toFixed(2)}
                    </p>
                    <motion.span animate={{ rotate: open ? 180 : 0 }} className="text-gray-400">
                      <ChevronDown size={16} />
                    </motion.span>
                  </div>
                </button>

                {/* Detalhe: cada uso com horário e linha do tempo */}
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-1 space-y-2 border-t border-gray-100">
                        {group.orders.map((order, idx) => (
                          <OrderRow
                            key={order.id}
                            order={order}
                            index={idx}
                            confirmId={confirmId}
                            setConfirmId={setConfirmId}
                            onDelete={handleDelete}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
