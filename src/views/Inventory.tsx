import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Boxes, Plus, Trash2, ArrowUp, ArrowDown, Edit2, Check, X } from 'lucide-react'
import {
  subscribeInventory,
  addInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
} from '../services/firebaseService'
import { useApp } from '../App'
import type { InventoryItem } from '../types'

export default function Inventory() {
  const { addToast } = useApp()
  const [items, setItems] = useState<InventoryItem[]>([])
  const [adding, setAdding] = useState(false)
  const [newItem, setNewItem] = useState({ name: '', quantity: 0, unit: '' })
  const [editId, setEditId] = useState<string | null>(null)
  const [editQty, setEditQty] = useState(0)
  const [adjustId, setAdjustId] = useState<string | null>(null)
  const [adjustDelta, setAdjustDelta] = useState(0)

  useEffect(() => {
    const unsub = subscribeInventory(setItems)
    return unsub
  }, [])

  const handleAdd = async () => {
    if (!newItem.name.trim() || !newItem.unit.trim()) {
      addToast('Preencha nome e unidade')
      return
    }
    try {
      await addInventoryItem(newItem)
      setNewItem({ name: '', quantity: 0, unit: '' })
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
    } catch {
      addToast('Erro ao remover item')
    }
  }

  const handleSaveEdit = async (id: string) => {
    try {
      await updateInventoryItem(id, { quantity: editQty })
      setEditId(null)
      addToast('Quantidade atualizada!', 'success')
    } catch {
      addToast('Erro ao atualizar')
    }
  }

  const handleAdjust = async (item: InventoryItem, delta: number) => {
    const newQty = Math.max(0, item.quantity + delta)
    try {
      await updateInventoryItem(item.id, { quantity: newQty })
    } catch {
      addToast('Erro ao ajustar estoque')
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <div className="mb-6 flex items-center gap-4">
        <div>
          <h1 className="font-serif italic text-3xl text-accent-dark flex items-center gap-2">
            <Boxes className="text-accent" size={28} />
            Estoque
          </h1>
          <p className="text-gray-500 text-sm">{items.length} item(ns) cadastrado(s)</p>
        </div>
        <div className="flex-1" />
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 bg-accent hover:bg-accent-dark text-white px-4 py-2 rounded-2xl text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Adicionar
        </button>
      </div>

      {/* Add form */}
      <AnimatePresence>
        {adding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white rounded-3xl p-4 shadow-sm mb-4 overflow-hidden"
          >
            <h3 className="font-medium text-gray-800 mb-3">Novo item</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <input
                type="text"
                placeholder="Nome do insumo"
                value={newItem.name}
                onChange={(e) => setNewItem((p) => ({ ...p, name: e.target.value }))}
                className="px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-accent text-sm"
              />
              <input
                type="number"
                placeholder="Quantidade"
                value={newItem.quantity}
                onChange={(e) => setNewItem((p) => ({ ...p, quantity: Number(e.target.value) }))}
                className="px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-accent text-sm"
              />
              <input
                type="text"
                placeholder="Unidade (kg, L, un...)"
                value={newItem.unit}
                onChange={(e) => setNewItem((p) => ({ ...p, unit: e.target.value }))}
                className="px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-accent text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                className="flex items-center gap-1.5 bg-accent text-white px-4 py-2 rounded-xl text-sm"
              >
                <Check size={14} /> Salvar
              </button>
              <button
                onClick={() => setAdding(false)}
                className="flex items-center gap-1.5 bg-gray-100 text-gray-600 px-4 py-2 rounded-xl text-sm"
              >
                <X size={14} /> Cancelar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
        {items.length === 0 ? (
          <div className="p-12 text-center">
            <Boxes size={48} className="mx-auto mb-3 text-gray-300" />
            <p className="text-gray-400">Nenhum item no estoque</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Item</th>
                <th className="text-center px-4 py-3 text-gray-500 font-medium">Quantidade</th>
                <th className="text-center px-4 py-3 text-gray-500 font-medium">Unidade</th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-800">{item.name}</td>
                  <td className="px-4 py-3 text-center">
                    {editId === item.id ? (
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number"
                          value={editQty}
                          onChange={(e) => setEditQty(Number(e.target.value))}
                          className="w-20 px-2 py-1 rounded-lg border border-gray-200 text-center text-sm focus:outline-none focus:border-accent"
                        />
                        <button onClick={() => handleSaveEdit(item.id)} className="text-green-600 hover:text-green-700">
                          <Check size={14} />
                        </button>
                        <button onClick={() => setEditId(null)} className="text-gray-400 hover:text-gray-600">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <span className={`font-medium ${item.quantity <= 5 ? 'text-orange-500' : 'text-gray-700'}`}>
                        {item.quantity}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-500">{item.unit}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleAdjust(item, -1)}
                        className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center"
                      >
                        <ArrowDown size={12} />
                      </button>
                      <button
                        onClick={() => handleAdjust(item, 1)}
                        className="w-7 h-7 rounded-lg bg-green-50 hover:bg-green-100 text-green-500 flex items-center justify-center"
                      >
                        <ArrowUp size={12} />
                      </button>
                      <button
                        onClick={() => { setEditId(item.id); setEditQty(item.quantity) }}
                        className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
