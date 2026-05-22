import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { QrCode, Keyboard, Hash } from 'lucide-react'
import { subscribeOrders, getOrderByTicket, setOrderStatus, resolveFicha } from '../services/firebaseService'
import { useApp } from '../App'
import type { Order, OrderStatus } from '../types'

const SECTORS = ['Fritadeira', 'Lanches', 'Outros']

interface SectorGroup {
  sector: string
  items: {
    name: string
    totalQty: number
    fichas: { ticket: string; orderId: string; status: OrderStatus }[]
  }[]
}

export default function KitchenSectors() {
  const { addToast } = useApp()
  const [orders, setOrders] = useState<Order[]>([])
  const [manualInput, setManualInput] = useState('')
  const [inputMode, setInputMode] = useState<'qr' | 'keyboard' | null>(null)
  const [lastScanned, setLastScanned] = useState('')

  const bufferRef = useRef('')
  const lastKeyTimeRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const manualRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const unsub = subscribeOrders(['pending', 'preparing', 'ready'], setOrders)
    return unsub
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
      if (!order) {
        addToast(`Ficha #${ticket} não encontrada`)
        return
      }

      let nextStatus: OrderStatus | null = null
      if (order.status === 'pending' || order.status === 'preparing') nextStatus = 'ready'
      else if (order.status === 'ready') nextStatus = 'delivered'

      if (!nextStatus) {
        addToast(`Ficha #${ticket} já foi entregue`)
        return
      }

      await setOrderStatus(order.id, nextStatus)
      const label = nextStatus === 'ready' ? 'pronta' : 'entregue'
      addToast(`Ficha #${ticket} marcada como ${label}!`, 'success')
    } catch {
      addToast('Erro ao processar ficha')
    }
  }, [flashMode, addToast])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't intercept if manual input is focused
      if (document.activeElement === manualRef.current) return

      if (e.key === 'Enter') {
        if (bufferRef.current.length > 0) {
          e.preventDefault()
          e.stopPropagation()
          if (timerRef.current) clearTimeout(timerRef.current)
          const val = bufferRef.current.trim()
          bufferRef.current = ''
          lastKeyTimeRef.current = 0
          if (val) processTicket(val, true)
        }
        return
      }
      if (e.key.length !== 1) return

      const now = Date.now()
      const delta = now - lastKeyTimeRef.current

      if (lastKeyTimeRef.current !== 0 && delta < 80) {
        e.preventDefault()
        e.stopPropagation()
        bufferRef.current += e.key
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
          const val = bufferRef.current.trim()
          bufferRef.current = ''
          lastKeyTimeRef.current = 0
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
    if (manualInput.trim()) {
      processTicket(manualInput.trim(), false)
      setManualInput('')
    }
  }

  // Build sector groups
  const sectorGroups: SectorGroup[] = SECTORS.map((sector) => {
    const itemMap = new Map<string, SectorGroup['items'][number]>()

    for (const order of orders) {
      for (const item of order.items) {
        if (item.sector !== sector) continue
        const existing = itemMap.get(item.name)
        if (existing) {
          existing.totalQty += item.quantity
          if (!existing.fichas.find((f) => f.ticket === order.ticket_number)) {
            existing.fichas.push({ ticket: order.ticket_number, orderId: order.id, status: order.status })
          }
        } else {
          itemMap.set(item.name, {
            name: item.name,
            totalQty: item.quantity,
            fichas: [{ ticket: order.ticket_number, orderId: order.id, status: order.status }],
          })
        }
      }
    }

    return { sector, items: Array.from(itemMap.values()) }
  })

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div>
          <h1 className="font-serif italic text-3xl text-accent-dark">Setores</h1>
          <p className="text-gray-500 text-sm">Bipe a ficha para avançar status</p>
        </div>
        <div className="flex-1" />
        {/* Input mode indicator */}
        <AnimatePresence>
          {inputMode && (
            <motion.div
              key={inputMode}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-medium ${
                inputMode === 'qr'
                  ? 'bg-green-100 text-green-700 border border-green-200'
                  : 'bg-blue-100 text-blue-700 border border-blue-200'
              }`}
            >
              {inputMode === 'qr' ? <QrCode size={16} /> : <Keyboard size={16} />}
              {inputMode === 'qr' ? 'QR Code' : 'Teclado'}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Manual input */}
        <form onSubmit={handleManualSubmit} className="flex items-center gap-2">
          <div className="relative">
            <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={manualRef}
              type="text"
              placeholder="Ficha manual"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              className="pl-8 pr-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-accent text-sm w-32"
            />
          </div>
          <button
            type="submit"
            className="bg-accent hover:bg-accent-dark text-white px-3 py-2 rounded-xl text-sm transition-colors"
          >
            OK
          </button>
        </form>
      </div>

      {lastScanned && (
        <div className="mb-4 bg-accent/10 border border-accent/20 rounded-2xl px-4 py-2 text-sm text-accent-dark">
          Última ficha: <strong>#{lastScanned}</strong>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {sectorGroups.map(({ sector, items }) => (
          <div key={sector} className="bg-white rounded-3xl p-4 shadow-sm">
            <h2 className="font-serif italic text-xl text-accent-dark mb-4">{sector}</h2>

            {items.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">Nenhum pedido neste setor</p>
            ) : (
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.name} className="border border-gray-100 rounded-2xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-800">{item.name}</span>
                      <span className="bg-accent/10 text-accent-dark text-sm font-bold px-2 py-0.5 rounded-lg">
                        ×{item.totalQty}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {item.fichas.map(({ ticket, status }) => (
                        <FichaTag key={ticket} ticket={ticket} status={status} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
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
