import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Boxes, RotateCcw, AlertTriangle, Minus, Plus, Check, X } from 'lucide-react'
import { subscribeMenuItems, updateMenuItem } from '../services/firebaseService'
import { useApp } from '../App'
import type { MenuItem } from '../types'

const LOW_STOCK_THRESHOLD = 15

const SECTOR_COLOR: Record<string, string> = {
  Fritadeira: 'text-orange-500',
  Lanches:    'text-blue-500',
  Outros:     'text-purple-500',
}

function stockColors(qty: number | undefined, initial: number | undefined) {
  const q = qty ?? 0
  const i = initial ?? 0
  if (q === 0 && i > 0) return { bar: 'bg-red-500',    badge: 'bg-red-100 text-red-600',       border: 'border-red-200',    bg: 'bg-red-50' }
  if (q <= LOW_STOCK_THRESHOLD && i > 0) return { bar: 'bg-orange-400', badge: 'bg-orange-100 text-orange-700', border: 'border-orange-200', bg: 'bg-orange-50' }
  return { bar: 'bg-green-500', badge: 'bg-green-100 text-green-700', border: 'border-gray-200', bg: 'bg-white' }
}

export default function Inventory() {
  const { addToast } = useApp()
  const [items, setItems] = useState<MenuItem[]>([])
  const [adjustId, setAdjustId] = useState<string | null>(null)
  const [adjustVal, setAdjustVal] = useState('')
  const [initialId, setInitialId] = useState<string | null>(null)
  const [initialVal, setInitialVal] = useState('')

  useEffect(() => {
    const unsub = subscribeMenuItems(setItems)
    return unsub
  }, [])

  const handleAdjust = async (item: MenuItem, delta: number) => {
    const current = item.stock ?? 0
    const newQty = Math.max(0, current + delta)
    try {
      await updateMenuItem(item.id, { stock: newQty })
    } catch { addToast('Erro ao ajustar') }
  }

  const handleSetStock = async (item: MenuItem) => {
    const val = parseInt(adjustVal, 10)
    if (isNaN(val) || val < 0) return
    try {
      await updateMenuItem(item.id, { stock: val })
      setAdjustId(null)
      setAdjustVal('')
    } catch { addToast('Erro ao salvar') }
  }

  const handleSetInitial = async (item: MenuItem) => {
    const val = parseInt(initialVal, 10)
    if (isNaN(val) || val <= 0) return
    try {
      await updateMenuItem(item.id, { stock_initial: val, stock: val })
      setInitialId(null)
      setInitialVal('')
      addToast(`Estoque inicial de ${item.name} definido como ${val}`, 'success')
    } catch { addToast('Erro ao salvar') }
  }

  const handleReset = async (item: MenuItem) => {
    if (!item.stock_initial) return
    try {
      await updateMenuItem(item.id, { stock: item.stock_initial })
      addToast(`${item.name} reposto para ${item.stock_initial}`, 'success')
    } catch { addToast('Erro ao repor') }
  }

  // Only show items that have stock configured
  const stockItems = items.filter((i) => i.stock_initial !== undefined && i.stock_initial > 0)
  const noStockItems = items.filter((i) => !i.stock_initial)
  const lowItems = stockItems.filter((i) => (i.stock ?? 0) <= LOW_STOCK_THRESHOLD && (i.stock ?? 0) > 0)
  const emptyItems = stockItems.filter((i) => (i.stock ?? 0) === 0)

  // Group stock items by sector
  const bySector = stockItems.reduce<Record<string, MenuItem[]>>((acc, item) => {
    const s = item.sector ?? 'Outros'
    if (!acc[s]) acc[s] = []
    acc[s].push(item)
    return acc
  }, {})

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-serif italic text-2xl md:text-3xl text-accent-dark flex items-center gap-2">
          <Boxes className="text-accent" size={26} />
          Estoque Diário
        </h1>
        <p className="text-gray-400 text-xs mt-0.5">
          {stockItems.length} produto(s) com estoque configurado · alerta abaixo de {LOW_STOCK_THRESHOLD}
        </p>
      </div>

      {/* Alert summary */}
      <AnimatePresence>
        {(lowItems.length > 0 || emptyItems.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-5 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 flex items-start gap-3"
          >
            <AlertTriangle size={18} className="text-orange-500 mt-0.5 shrink-0" />
            <div className="text-sm text-orange-800">
              {emptyItems.length > 0 && (
                <p className="font-bold mb-0.5">Zerado: {emptyItems.map((i) => i.name).join(', ')}</p>
              )}
              {lowItems.length > 0 && (
                <p>Abaixo de {LOW_STOCK_THRESHOLD}: {lowItems.map((i) => `${i.name} (${i.stock})`).join(', ')}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stock cards by sector */}
      {Object.entries(bySector).map(([sector, sectorItems]) => (
        <div key={sector} className="mb-6">
          <h2 className={`text-xs font-black uppercase tracking-widest mb-3 ${SECTOR_COLOR[sector] ?? 'text-gray-500'}`}>
            {sector}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sectorItems.map((item) => {
              const qty = item.stock ?? 0
              const initial = item.stock_initial ?? 0
              const pct = initial > 0 ? Math.min(100, (qty / initial) * 100) : 0
              const { bar, badge, border, bg } = stockColors(qty, initial)
              const isLow = qty <= LOW_STOCK_THRESHOLD && qty > 0
              const isEmpty = qty === 0

              return (
                <motion.div
                  key={item.id}
                  layout
                  className={`rounded-2xl border p-4 ${bg} ${border}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="font-semibold text-sm text-gray-800 leading-tight">{item.name}</p>
                    {isEmpty ? (
                      <span className={`shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full ${badge}`}>ZERADO</span>
                    ) : isLow ? (
                      <motion.span
                        animate={{ opacity: [1, 0.5, 1] }}
                        transition={{ duration: 1.2, repeat: Infinity }}
                        className={`shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full ${badge}`}
                      >
                        BAIXO
                      </motion.span>
                    ) : null}
                  </div>

                  {/* Current quantity */}
                  {adjustId === item.id ? (
                    <div className="flex items-center gap-2 mb-3">
                      <input
                        type="number" min={0} value={adjustVal} autoFocus
                        onChange={(e) => setAdjustVal(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSetStock(item) }}
                        className="w-24 px-3 py-1.5 rounded-xl border-2 border-accent focus:outline-none text-lg font-black text-center"
                      />
                      <button onClick={() => handleSetStock(item)} className="text-green-600"><Check size={16} /></button>
                      <button onClick={() => { setAdjustId(null); setAdjustVal('') }} className="text-gray-400"><X size={16} /></button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setAdjustId(item.id); setAdjustVal(String(qty)) }}
                      className="flex items-baseline gap-1 mb-3"
                      title="Clique para editar"
                    >
                      <span className={`font-black text-4xl leading-none ${isEmpty ? 'text-red-500' : isLow ? 'text-orange-500' : 'text-gray-800'}`}>
                        {qty}
                      </span>
                      <span className="text-gray-400 text-sm">/ {initial}</span>
                    </button>
                  )}

                  {/* Progress bar */}
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-3">
                    <motion.div
                      className={`h-full rounded-full ${bar}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => handleAdjust(item, -1)} disabled={qty === 0}
                      className="w-8 h-8 rounded-xl bg-white border border-gray-200 hover:bg-red-50 text-gray-500 hover:text-red-500 flex items-center justify-center transition-colors disabled:opacity-30">
                      <Minus size={13} />
                    </button>
                    <button onClick={() => handleAdjust(item, 1)}
                      className="w-8 h-8 rounded-xl bg-white border border-gray-200 hover:bg-green-50 text-gray-500 hover:text-green-600 flex items-center justify-center transition-colors">
                      <Plus size={13} />
                    </button>
                    <button onClick={() => handleReset(item)} title="Repor estoque inicial"
                      className="w-8 h-8 rounded-xl bg-white border border-gray-200 hover:bg-blue-50 text-gray-400 hover:text-blue-500 flex items-center justify-center transition-colors">
                      <RotateCcw size={13} />
                    </button>
                    {/* Set initial quantity inline */}
                    {initialId === item.id ? (
                      <div className="flex items-center gap-1 ml-auto">
                        <input
                          type="number" min={1} value={initialVal} autoFocus
                          onChange={(e) => setInitialVal(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleSetInitial(item) }}
                          placeholder="inicial"
                          className="w-20 px-2 py-1 rounded-lg border-2 border-accent/50 focus:outline-none text-xs font-bold text-center"
                        />
                        <button onClick={() => handleSetInitial(item)} className="text-green-600"><Check size={13} /></button>
                        <button onClick={() => { setInitialId(null); setInitialVal('') }} className="text-gray-400"><X size={13} /></button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setInitialId(item.id); setInitialVal(String(initial)) }}
                        className="ml-auto text-xs text-gray-400 hover:text-accent-dark border border-gray-200 hover:border-accent/40 rounded-xl px-2 py-1 transition-colors"
                        title="Alterar estoque inicial"
                      >
                        definir inicial
                      </button>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Items without stock configured */}
      {noStockItems.length > 0 && (
        <div className="mt-4">
          <h2 className="text-xs font-black uppercase tracking-widest text-gray-300 mb-3">
            Sem estoque configurado ({noStockItems.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {noStockItems.map((item) => (
              <div key={item.id} className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-500">{item.name}</p>
                  <p className="text-xs text-gray-400">{item.sector}</p>
                </div>
                {initialId === item.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number" min={1} value={initialVal} autoFocus
                      onChange={(e) => setInitialVal(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSetInitial(item) }}
                      placeholder="qtd"
                      className="w-16 px-2 py-1 rounded-lg border-2 border-accent/50 focus:outline-none text-xs font-bold text-center"
                    />
                    <button onClick={() => handleSetInitial(item)} className="text-green-600"><Check size={13} /></button>
                    <button onClick={() => { setInitialId(null); setInitialVal('') }} className="text-gray-400"><X size={13} /></button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setInitialId(item.id); setInitialVal('') }}
                    className="text-xs text-accent-dark border border-accent/30 hover:bg-accent/5 rounded-xl px-3 py-1.5 font-medium transition-colors shrink-0"
                  >
                    + Ativar
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {items.length === 0 && (
        <div className="bg-white rounded-3xl p-16 text-center shadow-sm">
          <Boxes size={48} className="mx-auto mb-3 text-gray-200" />
          <p className="text-gray-400 text-sm">Nenhum produto no cardápio</p>
          <p className="text-gray-300 text-xs mt-1">Cadastre produtos em Config → Cardápio</p>
        </div>
      )}
    </div>
  )
}
