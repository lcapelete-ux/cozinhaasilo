import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Boxes, Plus, Trash2, RotateCcw, Check, X, AlertTriangle, Minus } from 'lucide-react'
import {
  subscribeInventory,
  addInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
} from '../services/firebaseService'
import { useApp } from '../App'
import type { InventoryItem } from '../types'

const LOW_STOCK_THRESHOLD = 15

function stockColor(qty: number, initial: number): { bar: string; text: string; bg: string } {
  const pct = initial > 0 ? qty / initial : 1
  if (qty <= 0)        return { bar: 'bg-red-500',    text: 'text-red-600',    bg: 'bg-red-50 border-red-200' }
  if (qty <= LOW_STOCK_THRESHOLD) return { bar: 'bg-orange-400', text: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' }
  if (pct <= 0.4)      return { bar: 'bg-yellow-400', text: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200' }
  return               { bar: 'bg-green-500',   text: 'text-green-700',  bg: 'bg-gray-50 border-gray-200' }
}

export default function Inventory() {
  const { addToast } = useApp()
  const [items, setItems] = useState<InventoryItem[]>([])
  const [adding, setAdding] = useState(false)
  const [newItem, setNewItem] = useState({ name: '', initial_quantity: 0, unit: 'un' })
  const [adjustId, setAdjustId] = useState<string | null>(null)
  const [adjustVal, setAdjustVal] = useState('')

  useEffect(() => {
    const unsub = subscribeInventory(setItems)
    return unsub
  }, [])

  const handleAdd = async () => {
    if (!newItem.name.trim()) { addToast('Preencha o nome'); return }
    if (newItem.initial_quantity <= 0) { addToast('Informe a quantidade inicial'); return }
    try {
      await addInventoryItem({
        name: newItem.name.trim(),
        initial_quantity: newItem.initial_quantity,
        quantity: newItem.initial_quantity,
        unit: newItem.unit.trim() || 'un',
      })
      setNewItem({ name: '', initial_quantity: 0, unit: 'un' })
      setAdding(false)
      addToast('Item adicionado!', 'success')
    } catch {
      addToast('Erro ao adicionar item')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteInventoryItem(id)
      addToast('Item removido', 'success')
    } catch { addToast('Erro ao remover') }
  }

  const handleReset = async (item: InventoryItem) => {
    try {
      await updateInventoryItem(item.id, { quantity: item.initial_quantity })
      addToast(`${item.name} reposto para ${item.initial_quantity} ${item.unit}`, 'success')
    } catch { addToast('Erro ao repor') }
  }

  const handleAdjust = async (item: InventoryItem, delta: number) => {
    const newQty = Math.max(0, item.quantity + delta)
    try {
      await updateInventoryItem(item.id, { quantity: newQty })
    } catch { addToast('Erro ao ajustar') }
  }

  const handleSetQty = async (item: InventoryItem) => {
    const val = parseInt(adjustVal, 10)
    if (isNaN(val) || val < 0) return
    try {
      await updateInventoryItem(item.id, { quantity: val })
      setAdjustId(null)
      setAdjustVal('')
    } catch { addToast('Erro ao ajustar') }
  }

  const lowItems = items.filter((i) => i.quantity <= LOW_STOCK_THRESHOLD && i.quantity > 0)
  const emptyItems = items.filter((i) => i.quantity === 0)

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif italic text-2xl md:text-3xl text-accent-dark flex items-center gap-2">
            <Boxes className="text-accent" size={26} />
            Estoque Diário
          </h1>
          <p className="text-gray-400 text-xs mt-0.5">
            {items.length} item(ns) · limite de alerta: {LOW_STOCK_THRESHOLD} unidades
          </p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 bg-accent hover:bg-accent-dark text-white px-4 py-2.5 rounded-2xl text-sm font-medium transition-colors shrink-0"
        >
          <Plus size={15} /> Adicionar produto
        </button>
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
                <p className="font-bold mb-0.5">
                  Zerado: {emptyItems.map((i) => i.name).join(', ')}
                </p>
              )}
              {lowItems.length > 0 && (
                <p>
                  Abaixo de {LOW_STOCK_THRESHOLD}: {lowItems.map((i) => `${i.name} (${i.quantity} ${i.unit})`).join(', ')}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add form */}
      <AnimatePresence>
        {adding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white rounded-3xl p-5 shadow-sm mb-5 overflow-hidden border border-gray-100"
          >
            <h3 className="font-semibold text-gray-800 mb-4 text-sm">Novo produto</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <input
                type="text"
                placeholder="Nome do produto"
                value={newItem.name}
                onChange={(e) => setNewItem((p) => ({ ...p, name: e.target.value }))}
                className="px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-accent text-sm"
              />
              <input
                type="number"
                placeholder="Quantidade inicial"
                min={1}
                value={newItem.initial_quantity || ''}
                onChange={(e) => setNewItem((p) => ({ ...p, initial_quantity: Number(e.target.value) }))}
                className="px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-accent text-sm"
              />
              <input
                type="text"
                placeholder="Unidade (un, kg, L...)"
                value={newItem.unit}
                onChange={(e) => setNewItem((p) => ({ ...p, unit: e.target.value }))}
                className="px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-accent text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={handleAdd} className="flex items-center gap-1.5 bg-accent text-white px-4 py-2 rounded-xl text-sm font-medium">
                <Check size={14} /> Salvar
              </button>
              <button onClick={() => setAdding(false)} className="flex items-center gap-1.5 bg-gray-100 text-gray-600 px-4 py-2 rounded-xl text-sm">
                <X size={14} /> Cancelar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cards grid */}
      {items.length === 0 ? (
        <div className="bg-white rounded-3xl p-16 text-center shadow-sm">
          <Boxes size={48} className="mx-auto mb-3 text-gray-200" />
          <p className="text-gray-400 text-sm">Nenhum produto no estoque</p>
          <p className="text-gray-300 text-xs mt-1">Clique em "Adicionar produto" para começar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <AnimatePresence>
            {items.map((item) => {
              const { bar, text, bg } = stockColor(item.quantity, item.initial_quantity)
              const pct = item.initial_quantity > 0
                ? Math.min(100, (item.quantity / item.initial_quantity) * 100)
                : 0
              const isLow = item.quantity <= LOW_STOCK_THRESHOLD
              const isEmpty = item.quantity === 0

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={`rounded-2xl border p-4 ${bg}`}
                >
                  {/* Name + alert badge */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <p className="font-semibold text-gray-800 text-sm leading-tight">{item.name}</p>
                    {isEmpty ? (
                      <span className="shrink-0 text-[10px] font-bold bg-red-500 text-white px-2 py-0.5 rounded-full uppercase">Zerado</span>
                    ) : isLow ? (
                      <motion.span
                        animate={{ opacity: [1, 0.5, 1] }}
                        transition={{ duration: 1.2, repeat: Infinity }}
                        className="shrink-0 text-[10px] font-bold bg-orange-400 text-white px-2 py-0.5 rounded-full uppercase"
                      >
                        Baixo
                      </motion.span>
                    ) : null}
                  </div>

                  {/* Big quantity */}
                  {adjustId === item.id ? (
                    <div className="flex items-center gap-2 mb-3">
                      <input
                        type="number"
                        min={0}
                        value={adjustVal}
                        onChange={(e) => setAdjustVal(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSetQty(item) }}
                        autoFocus
                        className="w-24 px-3 py-1.5 rounded-xl border-2 border-accent focus:outline-none text-lg font-black text-center"
                      />
                      <button onClick={() => handleSetQty(item)} className="text-green-600"><Check size={16} /></button>
                      <button onClick={() => { setAdjustId(null); setAdjustVal('') }} className="text-gray-400"><X size={16} /></button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setAdjustId(item.id); setAdjustVal(String(item.quantity)) }}
                      className="mb-3"
                      title="Clique para editar"
                    >
                      <span className={`font-black text-4xl leading-none ${text}`}>{item.quantity}</span>
                      <span className="text-gray-400 text-sm ml-1">{item.unit}</span>
                      {item.initial_quantity > 0 && (
                        <span className="text-gray-300 text-xs ml-1">/ {item.initial_quantity}</span>
                      )}
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
                    <button
                      onClick={() => handleAdjust(item, -1)}
                      disabled={item.quantity === 0}
                      className="w-8 h-8 rounded-xl bg-white border border-gray-200 hover:bg-red-50 text-gray-500 hover:text-red-500 flex items-center justify-center transition-colors disabled:opacity-30"
                    >
                      <Minus size={13} />
                    </button>
                    <button
                      onClick={() => handleAdjust(item, 1)}
                      className="w-8 h-8 rounded-xl bg-white border border-gray-200 hover:bg-green-50 text-gray-500 hover:text-green-600 flex items-center justify-center transition-colors"
                    >
                      <Plus size={13} />
                    </button>
                    <button
                      onClick={() => handleReset(item)}
                      title="Repor estoque inicial"
                      className="w-8 h-8 rounded-xl bg-white border border-gray-200 hover:bg-blue-50 text-gray-400 hover:text-blue-500 flex items-center justify-center transition-colors"
                    >
                      <RotateCcw size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="w-8 h-8 rounded-xl bg-white border border-gray-200 hover:bg-red-50 text-gray-400 hover:text-red-500 flex items-center justify-center transition-colors ml-auto"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
