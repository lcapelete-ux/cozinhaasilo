import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Clock, Calendar, Trash2, Check, X } from 'lucide-react'
import { subscribeAllOrders, deleteOrder } from '../services/firebaseService'
import { displayTicket } from '../utils/ticket'
import { useApp } from '../App'
import type { Order } from '../types'

export default function History() {
  const { addToast } = useApp()
  const [orders, setOrders] = useState<Order[]>([])
  const [dateFilter, setDateFilter] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)

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

  useEffect(() => {
    const unsub = subscribeAllOrders((all) => {
      setOrders(all.filter((o) => o.status === 'delivered'))
    })
    return unsub
  }, [])

  const filteredOrders = dateFilter
    ? orders.filter((o) => {
        const d = o.updated_at.toISOString().slice(0, 10)
        return d === dateFilter
      })
    : orders

  const totalRevenue = filteredOrders.reduce(
    (sum, o) => sum + o.items.reduce((s, i) => s + i.price * i.quantity, 0),
    0
  )

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div>
          <h1 className="font-serif italic text-3xl text-accent-dark flex items-center gap-2">
            <Clock className="text-accent" size={28} />
            Histórico
          </h1>
          <p className="text-gray-500 text-sm">{filteredOrders.length} pedido(s) entregue(s)</p>
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
            <button
              onClick={() => setDateFilter('')}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-3xl p-4 shadow-sm text-center">
          <p className="text-3xl font-black text-accent-dark">{filteredOrders.length}</p>
          <p className="text-sm text-gray-500">Pedidos entregues</p>
        </div>
        <div className="bg-white rounded-3xl p-4 shadow-sm text-center">
          <p className="text-3xl font-black text-accent-dark">R$ {totalRevenue.toFixed(2)}</p>
          <p className="text-sm text-gray-500">Faturamento</p>
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center shadow-sm">
          <Clock size={48} className="mx-auto mb-3 text-gray-300" />
          <p className="text-gray-400">Nenhum pedido encontrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order, i) => (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="bg-white rounded-2xl p-4 shadow-sm flex items-start gap-4"
            >
              <div className="shrink-0 text-center">
                <p className="text-xs text-gray-400">Ficha</p>
                <p className="text-xl font-black text-accent-dark">#{displayTicket(order.ticket_number)}</p>
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap gap-1 mb-2">
                  {order.items.map((item, j) => (
                    <span key={j} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-lg">
                      {item.name} ×{item.quantity}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-gray-400">
                  Entregue às {order.updated_at.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  {' · '}
                  {order.updated_at.toLocaleDateString('pt-BR')}
                </p>
              </div>
              <div className="shrink-0 text-right flex flex-col items-end gap-2">
                <p className="font-medium text-accent-dark text-sm">
                  R$ {order.items.reduce((s, i) => s + i.price * i.quantity, 0).toFixed(2)}
                </p>
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-lg">
                  Entregue
                </span>
                {confirmId === order.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(order.id)}
                      title="Confirmar exclusão (pedido de teste)"
                      className="w-7 h-7 rounded-lg bg-red-500 hover:bg-red-600 text-white flex items-center justify-center"
                    >
                      <Check size={13} />
                    </button>
                    <button
                      onClick={() => setConfirmId(null)}
                      title="Cancelar"
                      className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center"
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
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
