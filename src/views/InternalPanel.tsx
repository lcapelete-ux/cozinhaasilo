import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShoppingBag, Beef, Package, Scan, AlertCircle } from 'lucide-react'
import { subscribeOrders } from '../services/firebaseService'
import { displayTicket, isTakeoutTicket } from '../utils/ticket'
import { useReceptionFlow } from '../hooks/useReceptionFlow'
import type { Order, OrderStatus } from '../types'

// Compatibilidade com itens gravados antes da renomeação dos setores
const SECTOR_ALIASES: Record<string, string> = {
  Lanches: 'Chapa',
  Outros: 'Assados',
}

interface SectorItem {
  name: string
  totalQty: number
  fichas: { ticket: string; status: OrderStatus; qty: number }[]
}

function getChapaItems(orders: Order[]): SectorItem[] {
  const itemMap = new Map<string, SectorItem>()
  for (const order of orders) {
    for (const item of order.items) {
      const sector = SECTOR_ALIASES[item.sector] ?? item.sector
      if (sector !== 'Chapa') continue
      const pendingQty = order.status !== 'ready' ? item.quantity : 0
      const existing = itemMap.get(item.name)
      if (existing) {
        existing.totalQty += pendingQty
        const fichaEntry = existing.fichas.find((f) => f.ticket === order.ticket_number)
        if (fichaEntry) fichaEntry.qty += item.quantity
        else existing.fichas.push({ ticket: order.ticket_number, status: order.status, qty: item.quantity })
      } else {
        itemMap.set(item.name, {
          name: item.name,
          totalQty: pendingQty,
          fichas: [{ ticket: order.ticket_number, status: order.status, qty: item.quantity }],
        })
      }
    }
  }
  return Array.from(itemMap.values()).sort((a, b) => b.totalQty - a.totalQty)
}

// Painel interno para um segundo monitor: tela dividida — Recepção (esquerda,
// com bipador próprio desse computador, processando fichas e cupons como a
// tela de Recepção) e pedidos da Chapa (direita, somente leitura).
export default function InternalPanel() {
  const { session, lastScan } = useReceptionFlow()
  const [orders, setOrders] = useState<Order[]>([])

  useEffect(() => subscribeOrders(['pending', 'preparing', 'ready'], setOrders), [])

  const chapaItems = getChapaItems(orders)
  const chapaCount = chapaItems.reduce((s, i) => s + i.totalQty, 0)

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-gray-800">
      {/* LEFT — Recepção (bipador deste computador) */}
      <div className="flex-1 flex flex-col">
        <div className="px-6 py-5 flex items-center justify-between border-b border-gray-800">
          <div className="flex items-center gap-3">
            <ShoppingBag size={32} className="text-accent" />
            <h1 className="font-serif italic text-3xl md:text-4xl text-white">Recepção</h1>
          </div>
          {session && (
            <motion.div
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="w-3 h-3 rounded-full bg-green-400"
            />
          )}
        </div>

        {lastScan && (
          <div className={`px-6 py-3 flex items-center gap-2 text-base font-medium ${
            lastScan.type === 'error' ? 'bg-red-950/50 text-red-300' : 'bg-gray-900 text-gray-300'
          }`}>
            {lastScan.type === 'error' ? <AlertCircle size={16} /> : <Scan size={16} />}
            {lastScan.label}
          </div>
        )}

        <div className="flex-1 p-6 overflow-y-auto">
          {!session ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-600">
              <ShoppingBag size={64} strokeWidth={1} />
              <p className="text-xl italic">Aguardando bipagem de ficha...</p>
            </div>
          ) : (
            <div>
              <div className="mb-5">
                <p className="text-gray-500 text-sm uppercase tracking-widest font-bold">Ficha</p>
                <p className="font-black text-white text-7xl leading-none">#{displayTicket(session.ficha)}</p>
              </div>

              {session.items.length === 0 ? (
                <p className="text-gray-500 italic text-xl py-6 text-center">Aguardando cupons...</p>
              ) : (
                <div className="space-y-2">
                  <AnimatePresence>
                    {session.items.map((item) => (
                      <motion.div
                        key={item.name}
                        initial={{ opacity: 0, x: 16 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3"
                      >
                        <div>
                          <p className="text-white font-semibold text-xl leading-tight">{item.name}</p>
                          <p className="text-gray-500 text-base">{SECTOR_ALIASES[item.sector] ?? item.sector}</p>
                        </div>
                        <span className="font-black text-3xl text-yellow-400 bg-yellow-950/40 rounded-xl px-3 py-1">
                          ×{item.quantity}
                        </span>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT — Pedidos da Chapa */}
      <div className="flex-1 flex flex-col">
        <div className="px-6 py-5 flex items-center justify-between border-b border-gray-800">
          <div className="flex items-center gap-3">
            <Beef size={32} className="text-blue-400" />
            <h1 className="font-serif italic text-3xl md:text-4xl text-white">Chapa</h1>
          </div>
          <span className="font-black text-3xl text-yellow-400 bg-yellow-950/40 rounded-xl px-3 py-1">{chapaCount}</span>
        </div>

        <div className="flex-1 p-6 overflow-y-auto">
          {chapaItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-600">
              <Package size={64} strokeWidth={1} />
              <p className="text-xl uppercase tracking-widest font-semibold">Limpo</p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {chapaItems.map((item) => (
                  <motion.div
                    key={item.name}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="rounded-2xl border border-gray-800 bg-gray-900 p-4"
                  >
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-white font-semibold text-2xl">{item.name}</span>
                      <span className="font-black text-3xl bg-yellow-950/40 text-yellow-400 rounded-xl px-3 py-1">×{item.totalQty}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {item.fichas.map(({ ticket, status, qty }) => (
                        <FichaTag key={ticket} ticket={ticket} status={status} qty={qty} />
                      ))}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function FichaTag({ ticket, status, qty }: { ticket: string; status: OrderStatus; qty: number }) {
  const isReady = status === 'ready'
  const isTakeout = isTakeoutTicket(ticket)
  const colors: Record<OrderStatus, string> = {
    pending:   'bg-yellow-900/60 text-yellow-300 border-yellow-700',
    preparing: 'bg-blue-900/60 text-blue-300 border-blue-700',
    ready:     'bg-gray-800 text-gray-400 border-gray-700',
    delivered: 'bg-gray-800 text-gray-500 border-gray-700',
  }
  const takeoutColors = 'bg-purple-900/60 text-purple-300 border-purple-600'
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold border text-base ${isTakeout ? takeoutColors : colors[status]}`}>
      <span className={isReady ? 'line-through decoration-2 decoration-gray-500/60' : ''}>#{displayTicket(ticket)}</span>
      <span className="text-yellow-400 opacity-90">×{qty}</span>
    </span>
  )
}
