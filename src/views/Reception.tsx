import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Minus, ShoppingBag, QrCode, Keyboard, Send } from 'lucide-react'
import { createOrder, subscribeMenuItems, resolveFicha } from '../services/firebaseService'
import { useApp } from '../App'
import type { MenuItem } from '../types'

interface CartItem {
  menuItem: MenuItem
  quantity: number
}

export default function Reception() {
  const { addToast } = useApp()
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [ticketInput, setTicketInput] = useState('')
  const [resolvedTicket, setResolvedTicket] = useState('')
  const [inputMode, setInputMode] = useState<'qr' | 'keyboard' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [lastOrderTicket, setLastOrderTicket] = useState('')

  const bufferRef = useRef('')
  const lastKeyTimeRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const unsub = subscribeMenuItems(setMenuItems)
    return unsub
  }, [])

  const flashMode = useCallback((mode: 'qr' | 'keyboard') => {
    setInputMode(mode)
    setTimeout(() => setInputMode(null), 1500)
  }, [])

  const handleQrScan = useCallback(async (raw: string) => {
    flashMode('qr')
    try {
      const ticket = await resolveFicha(raw)
      setTicketInput(ticket)
      setResolvedTicket(ticket)
    } catch {
      addToast('Erro ao resolver ficha QR')
    }
  }, [flashMode, addToast])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (bufferRef.current.length > 0) {
          e.preventDefault()
          e.stopPropagation()
          if (timerRef.current) clearTimeout(timerRef.current)
          const val = bufferRef.current.trim()
          bufferRef.current = ''
          lastKeyTimeRef.current = 0
          if (val) handleQrScan(val)
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
          if (val) handleQrScan(val)
        }, 150)
      } else {
        flashMode('keyboard')
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
  }, [handleQrScan, flashMode])

  const sectors = Array.from(new Set(menuItems.map((m) => m.sector)))

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItem.id === item.id)
      if (existing) return prev.map((c) => c.menuItem.id === item.id ? { ...c, quantity: c.quantity + 1 } : c)
      return [...prev, { menuItem: item, quantity: 1 }]
    })
  }

  const removeFromCart = (itemId: string) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItem.id === itemId)
      if (!existing) return prev
      if (existing.quantity === 1) return prev.filter((c) => c.menuItem.id !== itemId)
      return prev.map((c) => c.menuItem.id === itemId ? { ...c, quantity: c.quantity - 1 } : c)
    })
  }

  const total = cart.reduce((sum, c) => sum + c.menuItem.price * c.quantity, 0)

  const handleSubmit = async () => {
    const ticket = resolvedTicket || ticketInput.trim()
    if (!ticket) { addToast('Informe o número da ficha'); return }
    if (cart.length === 0) { addToast('Adicione pelo menos um item'); return }

    setSubmitting(true)
    try {
      const orderItems = cart.map((c) => ({
        name: c.menuItem.name,
        quantity: c.quantity,
        sector: c.menuItem.sector,
        price: c.menuItem.price,
        completed: false,
      }))
      await createOrder(ticket, orderItems)
      setLastOrderTicket(ticket)
      setCart([])
      setTicketInput('')
      setResolvedTicket('')
      addToast(`Pedido #${ticket} criado com sucesso!`, 'success')
    } catch (err) {
      addToast('Erro ao criar pedido')
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="font-serif italic text-3xl text-accent-dark">Recepção</h1>
        <p className="text-gray-500 text-sm">Criar novo pedido</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — Menu */}
        <div className="lg:col-span-2 space-y-6">
          {/* Ticket input */}
          <div className="bg-white rounded-3xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Número da ficha (ou bipe QR Code)"
                  value={ticketInput}
                  onChange={(e) => {
                    setTicketInput(e.target.value)
                    setResolvedTicket(e.target.value)
                  }}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:border-accent text-sm"
                />
              </div>
              <AnimatePresence>
                {inputMode && (
                  <motion.div
                    key={inputMode}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium ${
                      inputMode === 'qr'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {inputMode === 'qr' ? <QrCode size={14} /> : <Keyboard size={14} />}
                    {inputMode === 'qr' ? 'QR Code' : 'Teclado'}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Menu by sector */}
          {sectors.map((sector) => (
            <div key={sector} className="bg-white rounded-3xl p-4 shadow-sm">
              <h3 className="font-serif italic text-lg text-accent-dark mb-3">{sector}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {menuItems
                  .filter((m) => m.sector === sector)
                  .map((item) => {
                    const cartItem = cart.find((c) => c.menuItem.id === item.id)
                    return (
                      <motion.button
                        key={item.id}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => addToCart(item)}
                        className={`relative p-3 rounded-2xl text-left transition-colors border-2 ${
                          cartItem
                            ? 'border-accent bg-accent/5'
                            : 'border-gray-100 hover:border-accent/40 hover:bg-gray-50'
                        }`}
                      >
                        <p className="font-medium text-sm text-gray-800">{item.name}</p>
                        <p className="text-xs text-gray-500">R$ {item.price.toFixed(2)}</p>
                        {cartItem && (
                          <span className="absolute top-2 right-2 bg-accent text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                            {cartItem.quantity}
                          </span>
                        )}
                      </motion.button>
                    )
                  })}
              </div>
            </div>
          ))}
        </div>

        {/* Right — Cart */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-3xl p-4 shadow-sm sticky top-6">
            <h3 className="font-serif italic text-lg text-accent-dark mb-3 flex items-center gap-2">
              <ShoppingBag size={18} />
              Pedido
            </h3>

            {cart.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">Nenhum item adicionado</p>
            ) : (
              <div className="space-y-2 mb-4">
                {cart.map(({ menuItem, quantity }) => (
                  <div key={menuItem.id} className="flex items-center gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">{menuItem.name}</p>
                      <p className="text-xs text-gray-500">
                        R$ {(menuItem.price * quantity).toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => removeFromCart(menuItem.id)}
                        className="w-6 h-6 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="w-6 text-center text-sm font-medium">{quantity}</span>
                      <button
                        onClick={() => addToCart(menuItem)}
                        className="w-6 h-6 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-gray-100 pt-3 mb-4">
              <div className="flex justify-between text-sm font-medium">
                <span>Total</span>
                <span className="text-accent-dark">R$ {total.toFixed(2)}</span>
              </div>
            </div>

            {lastOrderTicket && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-2 text-xs text-green-700 mb-3 text-center">
                Último pedido: Ficha #{lastOrderTicket}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting || cart.length === 0 || !ticketInput.trim()}
              className="w-full bg-accent hover:bg-accent-dark text-white py-3 rounded-2xl font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-40"
            >
              {submitting ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                  className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                />
              ) : (
                <>
                  <Send size={16} />
                  Enviar Pedido
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
