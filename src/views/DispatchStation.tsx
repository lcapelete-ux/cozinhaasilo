import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Package, Check, QrCode, Keyboard } from 'lucide-react'
import { subscribeOrders, setOrderStatus, getOrderByTicket, resolveFicha } from '../services/firebaseService'
import { useApp } from '../App'
import type { Order } from '../types'

export default function DispatchStation() {
  const { addToast } = useApp()
  const [readyOrders, setReadyOrders] = useState<Order[]>([])
  const [inputMode, setInputMode] = useState<'qr' | 'keyboard' | null>(null)
  const [manualInput, setManualInput] = useState('')

  const bufferRef = useRef('')
  const lastKeyTimeRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const manualRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const unsub = subscribeOrders(['ready'], setReadyOrders)
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
      const order = await getOrderByTicket(ticket)
      if (!order) {
        addToast(`Ficha #${ticket} não encontrada`)
        return
      }
      if (order.status !== 'ready') {
        addToast(`Ficha #${ticket} não está pronta (status: ${order.status})`)
        return
      }
      await setOrderStatus(order.id, 'delivered')
      addToast(`Ficha #${ticket} entregue!`, 'success')
    } catch {
      addToast('Erro ao processar ficha')
    }
  }, [flashMode, addToast])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
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

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div>
          <h1 className="font-serif italic text-3xl text-accent-dark flex items-center gap-2">
            <Package className="text-accent" size={28} />
            Estação de Entrega
          </h1>
          <p className="text-gray-500 text-sm">{readyOrders.length} ficha(s) aguardando entrega</p>
        </div>
        <div className="flex-1" />

        <AnimatePresence>
          {inputMode && (
            <motion.div
              key={inputMode}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium ${
                inputMode === 'qr' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
              }`}
            >
              {inputMode === 'qr' ? <QrCode size={14} /> : <Keyboard size={14} />}
              {inputMode === 'qr' ? 'QR Code' : 'Teclado'}
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <input
            ref={manualRef}
            type="text"
            placeholder="Ficha manual"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-accent text-sm w-32"
          />
          <button
            type="submit"
            className="bg-accent hover:bg-accent-dark text-white px-3 py-2 rounded-xl text-sm transition-colors"
          >
            OK
          </button>
        </form>
      </div>

      {readyOrders.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center shadow-sm">
          <Package size={48} className="mx-auto mb-3 text-gray-300" />
          <p className="text-gray-400">Nenhuma ficha aguardando entrega</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <AnimatePresence>
            {readyOrders.map((order) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, x: 40, scale: 0.95 }}
                className="bg-white rounded-3xl p-4 shadow-sm border-2 border-green-200"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Ficha</p>
                    <p className="text-3xl font-black text-green-600">#{order.ticket_number}</p>
                  </div>
                  <span className="bg-green-100 text-green-700 text-xs font-medium px-2 py-1 rounded-xl border border-green-200">
                    Pronto!
                  </span>
                </div>

                <ul className="space-y-1 mb-4">
                  {order.items.map((item, i) => (
                    <li key={i} className="flex justify-between text-sm">
                      <span className="text-gray-700">{item.name}</span>
                      <span className="text-gray-400">×{item.quantity}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => processTicket(order.ticket_number, false)}
                  className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white py-2.5 rounded-2xl font-medium transition-colors"
                >
                  <Check size={16} />
                  Entregar
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
