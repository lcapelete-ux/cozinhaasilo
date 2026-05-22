import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { QrCode, Plus, Trash2, Check, X } from 'lucide-react'
import { subscribeExtraFichas, addExtraFicha, deleteExtraFicha } from '../services/firebaseService'
import { useApp } from '../App'
import type { ExtraFicha } from '../types'

export default function ExtraFichas() {
  const { addToast } = useApp()
  const [fichas, setFichas] = useState<ExtraFicha[]>([])
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ qr_code: '', alias: '', description: '' })

  useEffect(() => {
    const unsub = subscribeExtraFichas(setFichas)
    return unsub
  }, [])

  const handleAdd = async () => {
    if (!form.qr_code.trim() || !form.alias.trim()) {
      addToast('Preencha QR Code e Alias')
      return
    }
    try {
      await addExtraFicha(form)
      setForm({ qr_code: '', alias: '', description: '' })
      setAdding(false)
      addToast('QR Extra adicionado!', 'success')
    } catch {
      addToast('Erro ao adicionar')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteExtraFicha(id)
      addToast('Removido!', 'success')
    } catch {
      addToast('Erro ao remover')
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <div className="mb-6 flex items-center gap-4">
        <div>
          <h1 className="font-serif italic text-3xl text-accent-dark flex items-center gap-2">
            <QrCode className="text-accent" size={28} />
            QR Codes Extra
          </h1>
          <p className="text-gray-500 text-sm">Aliases para QR Codes especiais</p>
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

      <AnimatePresence>
        {adding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white rounded-3xl p-4 shadow-sm mb-4 overflow-hidden"
          >
            <h3 className="font-medium text-gray-800 mb-3">Novo QR Extra</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">QR Code (conteúdo do QR)</label>
                <input
                  type="text"
                  placeholder="https://... ou FICHA-123"
                  value={form.qr_code}
                  onChange={(e) => setForm((p) => ({ ...p, qr_code: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-accent text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Alias (ficha mapeada)</label>
                <input
                  type="text"
                  placeholder="42"
                  value={form.alias}
                  onChange={(e) => setForm((p) => ({ ...p, alias: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-accent text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Descrição (opcional)</label>
                <input
                  type="text"
                  placeholder="Descrição do QR"
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-accent text-sm"
                />
              </div>
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
        {fichas.length === 0 ? (
          <div className="p-12 text-center">
            <QrCode size={48} className="mx-auto mb-3 text-gray-300" />
            <p className="text-gray-400">Nenhum QR extra cadastrado</p>
            <p className="text-gray-400 text-xs mt-1">
              Use esta seção para mapear QR Codes especiais para números de ficha
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">QR Code</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Alias</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Descrição</th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {fichas.map((f) => (
                <tr key={f.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs max-w-[200px] truncate">
                    {f.qr_code}
                  </td>
                  <td className="px-4 py-3 font-bold text-accent-dark">#{f.alias}</td>
                  <td className="px-4 py-3 text-gray-500">{f.description || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(f.id)}
                      className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center ml-auto"
                    >
                      <Trash2 size={12} />
                    </button>
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
