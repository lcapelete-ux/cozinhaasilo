import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart, Trash2, Check, X, Edit2, Trophy, Target } from 'lucide-react'
import {
  subscribeDonations, addDonationsBatch, updateDonation, deleteDonation,
  subscribeDonationGoal, setDonationGoal, META_PADRAO,
} from '../services/firebaseService'
import { formatBRL, parseAmount, rankDonors, totalDonated } from '../utils/donations'
import DonationEntryGrid, { type GridItem } from '../components/DonationEntryGrid'
import { useApp } from '../App'
import type { Donation } from '../types'

const MEDALS = ['🥇', '🥈', '🥉']

export default function Donations() {
  const { addToast } = useApp()
  const [donations, setDonations] = useState<Donation[]>([])
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ donor: '', amount: '', note: '' })
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [meta, setMeta] = useState(META_PADRAO)
  const [metaInput, setMetaInput] = useState('')
  const [savingMeta, setSavingMeta] = useState(false)

  useEffect(() => subscribeDonations(setDonations), [])
  useEffect(
    () =>
      subscribeDonationGoal((g) => {
        setMeta(g)
        // Só preenche o campo enquanto ele estiver intocado, para não
        // sobrescrever o que a pessoa está digitando.
        setMetaInput((atual) => (atual === '' ? g.toLocaleString('pt-BR') : atual))
      }),
    []
  )

  const ranking = useMemo(() => rankDonors(donations), [donations])
  const total = useMemo(() => totalDonated(donations), [donations])
  const pctMeta = meta > 0 ? (total / meta) * 100 : 0

  const handleSaveMeta = async () => {
    const valor = parseAmount(metaInput)
    if (!Number.isFinite(valor) || valor <= 0) {
      addToast('Informe uma meta válida, como 50.000')
      return
    }
    setSavingMeta(true)
    try {
      await setDonationGoal(valor)
      addToast(`Meta alterada para ${formatBRL(valor)}`, 'success')
    } catch {
      addToast('Erro ao salvar a meta')
    } finally {
      setSavingMeta(false)
    }
  }

  const handleSaveGrid = async (items: GridItem[]) => {
    try {
      await addDonationsBatch(items)
      const soma = items.reduce((s, i) => s + i.amount, 0)
      addToast(
        `${items.length} doaç${items.length === 1 ? 'ão' : 'ões'} · ${formatBRL(soma)} registrad${items.length === 1 ? 'a' : 'as'}!`,
        'success'
      )
    } catch {
      addToast('Erro ao registrar as doações')
      throw new Error('falha ao salvar')
    }
  }

  const handleSaveEdit = async () => {
    if (!editId) return
    const nome = editForm.donor.trim()
    const valor = parseAmount(editForm.amount)
    if (!nome || !Number.isFinite(valor) || valor <= 0) {
      addToast('Preencha nome e valor corretamente')
      return
    }
    try {
      await updateDonation(editId, { donor: nome, amount: valor, note: editForm.note.trim() })
      setEditId(null)
      addToast('Doação atualizada!', 'success')
    } catch {
      addToast('Erro ao atualizar a doação')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteDonation(id)
      addToast('Doação removida', 'success')
    } catch {
      addToast('Erro ao remover a doação')
    } finally {
      setConfirmId(null)
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="font-serif italic text-2xl md:text-3xl text-accent-dark flex items-center gap-2">
          <Heart className="text-accent" size={26} />
          Doações
        </h1>
        <p className="text-gray-400 text-xs mt-0.5">
          O total e o ranking aparecem na página inicial do Oktoberfest, antes do login.
        </p>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-3xl p-4 shadow-sm text-center">
          <p className="text-xl md:text-2xl font-black text-accent-dark leading-tight">{formatBRL(total)}</p>
          <p className="text-xs text-gray-500">Arrecadado</p>
        </div>
        <div className="bg-white rounded-3xl p-4 shadow-sm text-center">
          <p className="text-xl md:text-2xl font-black text-accent-dark leading-tight">{ranking.length}</p>
          <p className="text-xs text-gray-500">Doadores</p>
        </div>
        <div className="bg-white rounded-3xl p-4 shadow-sm text-center">
          <p className="text-xl md:text-2xl font-black text-accent-dark leading-tight">{donations.length}</p>
          <p className="text-xs text-gray-500">Doações</p>
        </div>
      </div>

      {/* Meta do Doadômetro */}
      <div className="bg-white rounded-3xl p-5 shadow-sm mb-6">
        <h2 className="font-bold text-gray-800 mb-1 flex items-center gap-2">
          <Target size={16} className="text-accent" />
          Meta do Doadômetro
        </h2>
        <p className="text-xs text-gray-400 mb-4">
          É a barra que enche no telão. Vale para todos os aparelhos.
        </p>

        <div className="w-full h-3 rounded-full bg-gray-100 overflow-hidden mb-3">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${Math.min(100, pctMeta)}%` }}
          />
        </div>
        <p className="text-sm text-gray-500 mb-4">
          {formatBRL(total)} de <strong className="text-accent-dark">{formatBRL(meta)}</strong> ·{' '}
          {pctMeta >= 100
            ? '🎉 meta atingida!'
            : `faltam ${formatBRL(meta - total)} (${pctMeta.toFixed(1).replace('.', ',')}%)`}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            inputMode="decimal"
            value={metaInput}
            onChange={(e) => setMetaInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveMeta() }}
            placeholder="50.000"
            className="w-40 px-4 py-2.5 rounded-2xl border border-gray-200 focus:outline-none focus:border-accent text-sm font-bold"
          />
          <button
            onClick={handleSaveMeta}
            disabled={savingMeta}
            className="flex items-center gap-2 bg-accent hover:bg-accent-dark disabled:opacity-50 text-white px-5 py-2.5 rounded-2xl text-sm font-semibold transition-colors"
          >
            <Check size={16} />
            Salvar meta
          </button>
        </div>
      </div>

      {/* Nova doação */}
      <div className="mb-6">
        <DonationEntryGrid onSave={handleSaveGrid} />
      </div>

      {/* Ranking atual */}
      {ranking.length > 0 && (
        <div className="bg-white rounded-3xl p-5 shadow-sm mb-6">
          <h2 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
            <Trophy size={16} className="text-accent" />
            Ranking que está no ar
          </h2>
          <div className="space-y-1.5">
            {ranking.map((r, i) => (
              <div key={r.donor} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-gray-50">
                <span className="w-7 text-center font-black text-gray-400 text-sm">
                  {MEDALS[i] ?? `${i + 1}º`}
                </span>
                <span className="flex-1 text-sm font-semibold text-gray-700 truncate">{r.donor}</span>
                {r.count > 1 && (
                  <span className="text-[11px] text-gray-400 shrink-0">{r.count} doações</span>
                )}
                <span className="text-sm font-black text-accent-dark shrink-0">{formatBRL(r.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lançamentos */}
      <h2 className="font-bold text-gray-800 mb-3">Lançamentos</h2>
      {donations.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center shadow-sm">
          <Heart size={44} className="mx-auto mb-3 text-gray-200" />
          <p className="text-gray-400 text-sm">Nenhuma doação registrada ainda</p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {donations.map((d) => (
              <motion.div
                key={d.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                className="bg-white rounded-2xl p-4 shadow-sm"
              >
                {editId === d.id ? (
                  <div className="space-y-2">
                    <div className="grid md:grid-cols-[1fr_140px] gap-2">
                      <input
                        type="text"
                        value={editForm.donor}
                        onChange={(e) => setEditForm((p) => ({ ...p, donor: e.target.value }))}
                        className="px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-accent text-sm"
                      />
                      <input
                        type="text"
                        inputMode="decimal"
                        value={editForm.amount}
                        onChange={(e) => setEditForm((p) => ({ ...p, amount: e.target.value }))}
                        className="px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-accent text-sm font-bold"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Observação"
                      value={editForm.note}
                      onChange={(e) => setEditForm((p) => ({ ...p, note: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-accent text-sm"
                    />
                    <div className="flex gap-2">
                      <button onClick={handleSaveEdit} className="flex items-center gap-1.5 bg-accent text-white px-4 py-2 rounded-xl text-sm">
                        <Check size={14} /> Salvar
                      </button>
                      <button onClick={() => setEditId(null)} className="flex items-center gap-1.5 bg-gray-100 text-gray-600 px-4 py-2 rounded-xl text-sm">
                        <X size={14} /> Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm truncate">{d.donor}</p>
                      <p className="text-xs text-gray-400">
                        {d.created_at.toLocaleDateString('pt-BR')} às{' '}
                        {d.created_at.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        {d.note && <span className="ml-1.5 text-gray-500">· {d.note}</span>}
                      </p>
                    </div>
                    <span className="font-black text-accent-dark shrink-0">{formatBRL(d.amount)}</span>
                    {confirmId === d.id ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleDelete(d.id)}
                          title="Confirmar exclusão"
                          className="w-8 h-8 rounded-lg bg-red-500 hover:bg-red-600 text-white flex items-center justify-center"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => setConfirmId(null)}
                          title="Cancelar"
                          className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => {
                            setConfirmId(null)
                            setEditId(d.id)
                            setEditForm({ donor: d.donor, amount: String(d.amount).replace('.', ','), note: d.note })
                          }}
                          title="Editar"
                          className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => { setEditId(null); setConfirmId(d.id) }}
                          title="Excluir"
                          className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 flex items-center justify-center"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
