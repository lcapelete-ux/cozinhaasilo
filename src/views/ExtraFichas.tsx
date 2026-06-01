import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { QrCode, Trash2, Check, X, ScanLine, Hash } from 'lucide-react'
import { subscribeExtraFichas, addExtraFicha, deleteExtraFicha } from '../services/firebaseService'
import { useApp } from '../App'
import type { ExtraFicha } from '../types'

function extractNumber(raw: string): string {
  // Try URL ?ficha= param
  try {
    const url = new URL(raw)
    const p = url.searchParams.get('ficha')
    if (p) return String(parseInt(p, 10))
  } catch { /* not a URL */ }
  // Try plain number
  const m = raw.replace(/^\][A-Za-z]\d/, '').match(/\d+/)
  if (m) return String(parseInt(m[0], 10))
  return ''
}

export default function ExtraFichas() {
  const { addToast } = useApp()
  const [fichas, setFichas] = useState<ExtraFicha[]>([])

  // Scanner capture state
  const [captured, setCaptured] = useState<string | null>(null)
  const [alias, setAlias] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [scanFlash, setScanFlash] = useState(false)

  const bufferRef = useRef('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const aliasRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const unsub = subscribeExtraFichas(setFichas)
    return unsub
  }, [])

  const handleScan = useCallback((raw: string) => {
    const auto = extractNumber(raw)
    setCaptured(raw)
    setAlias(auto)
    setDescription('')
    setScanFlash(true)
    setTimeout(() => setScanFlash(false), 400)
    setTimeout(() => aliasRef.current?.focus(), 50)
  }, [])

  // Keyboard scanner handler — always capture (scanner-only zone)
  useEffect(() => {
    if (captured) return // when form is open, let inputs work normally

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault(); e.stopPropagation()
        if (timerRef.current) clearTimeout(timerRef.current)
        const val = bufferRef.current.trim()
        bufferRef.current = ''
        if (val.length >= 1) handleScan(val)
        return
      }
      if (e.key.length !== 1) return
      e.preventDefault(); e.stopPropagation()
      bufferRef.current += e.key
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        const val = bufferRef.current.trim()
        bufferRef.current = ''
        if (val.length >= 2) handleScan(val)
      }, 150)
    }

    window.addEventListener('keydown', handler, { capture: true })
    return () => {
      window.removeEventListener('keydown', handler, { capture: true })
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [captured, handleScan])

  const handleSave = async () => {
    if (!captured) return
    if (!alias.trim()) {
      addToast('Informe o número da ficha')
      aliasRef.current?.focus()
      return
    }
    setSaving(true)
    try {
      await addExtraFicha({
        qr_code: captured,
        alias: alias.trim(),
        description: description.trim(),
      })
      addToast(`Ficha #${alias.trim()} cadastrada!`, 'success')
      setCaptured(null)
      setAlias('')
      setDescription('')
    } catch {
      addToast('Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setCaptured(null)
    setAlias('')
    setDescription('')
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
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-serif italic text-3xl text-accent-dark flex items-center gap-2">
          <QrCode className="text-accent" size={28} />
          Fichas QR
        </h1>
        <p className="text-gray-400 text-sm mt-0.5">
          Bipe uma ficha para cadastrar o QR Code no sistema
        </p>
      </div>

      {/* Scanner zone / Capture form */}
      <AnimatePresence mode="wait">
        {!captured ? (
          /* Waiting for scan */
          <motion.div
            key="idle"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className={`relative mb-6 rounded-3xl border-2 border-dashed transition-colors duration-200 ${
              scanFlash ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-gray-50'
            } p-10 flex flex-col items-center justify-center gap-4`}
          >
            <motion.div
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <ScanLine
                size={56}
                className={`transition-colors duration-200 ${scanFlash ? 'text-green-500' : 'text-gray-300'}`}
                strokeWidth={1.5}
              />
            </motion.div>
            <div className="text-center">
              <p className="font-semibold text-gray-500 text-sm">Aguardando leitura...</p>
              <p className="text-gray-400 text-xs mt-1">Bipe a ficha física com o leitor de QR Code</p>
            </div>
          </motion.div>
        ) : (
          /* Captured — fill in alias */
          <motion.div
            key="captured"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-6 bg-white rounded-3xl shadow-sm border border-green-200 p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center">
                <Check size={14} className="text-green-600" />
              </div>
              <span className="font-semibold text-gray-800 text-sm">QR Code capturado</span>
            </div>

            {/* Raw QR content */}
            <div className="bg-gray-50 rounded-xl px-3 py-2 mb-4 flex items-start gap-2">
              <QrCode size={14} className="text-gray-400 mt-0.5 shrink-0" />
              <span className="text-xs font-mono text-gray-500 break-all">{captured}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1.5 flex items-center gap-1">
                  <Hash size={11} />
                  Número da ficha <span className="text-red-400">*</span>
                </label>
                <input
                  ref={aliasRef}
                  type="text"
                  inputMode="numeric"
                  placeholder="ex: 42"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
                  className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-accent focus:outline-none text-sm font-bold"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1.5">
                  Descrição <span className="text-gray-300">(opcional)</span>
                </label>
                <input
                  type="text"
                  placeholder="ex: Ficha do fornecedor X"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
                  className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-accent focus:outline-none text-sm"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 bg-accent hover:bg-accent-dark text-white px-5 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
              >
                <Check size={14} />
                {saving ? 'Salvando...' : 'Salvar Ficha'}
              </button>
              <button
                onClick={handleCancel}
                className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-xl text-sm transition-colors"
              >
                <X size={14} />
                Cancelar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Registered fichas list */}
      <div>
        <h2 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">
          Fichas cadastradas ({fichas.length})
        </h2>

        <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
          {fichas.length === 0 ? (
            <div className="p-10 text-center">
              <QrCode size={40} className="mx-auto mb-3 text-gray-200" />
              <p className="text-gray-400 text-sm">Nenhuma ficha cadastrada ainda</p>
              <p className="text-gray-300 text-xs mt-1">Bipe uma ficha para começar</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs">Ficha</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs">QR Code</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs">Descrição</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {fichas.map((f) => (
                  <tr key={f.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-black text-accent-dark text-base">#{f.alias}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-400 max-w-[200px] truncate">
                      {f.qr_code}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{f.description || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(f.id)}
                        className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 flex items-center justify-center ml-auto transition-colors"
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
    </div>
  )
}
