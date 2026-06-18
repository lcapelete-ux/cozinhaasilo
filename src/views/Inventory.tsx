import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Boxes, RotateCcw, AlertTriangle, Minus, Plus, Check, X, History, ChevronDown, ChevronUp, PackagePlus, RefreshCw, DoorOpen, Trash2 } from 'lucide-react'
import { subscribeMenuItems, updateMenuItem, addStockEntry, subscribeStockEntries, deleteMenuItem } from '../services/firebaseService'
import { useApp } from '../App'
import type { MenuItem, StockEntry } from '../types'

const LOW_STOCK_THRESHOLD = 15

const SECTOR_COLOR: Record<string, string> = {
  Fritadeira: 'text-orange-500',
  Chapa:      'text-blue-500',
  Assados:    'text-purple-500',
}

function stockColors(qty: number | undefined, initial: number | undefined) {
  const q = qty ?? 0
  const i = initial ?? 0
  if (q < 0)  return { bar: 'bg-red-600',    badge: 'bg-red-200 text-red-700',       border: 'border-red-300',    bg: 'bg-red-50' }
  if (q === 0 && i > 0) return { bar: 'bg-red-500', badge: 'bg-red-100 text-red-600', border: 'border-red-200', bg: 'bg-red-50' }
  if (q <= LOW_STOCK_THRESHOLD && i > 0) return { bar: 'bg-orange-400', badge: 'bg-orange-100 text-orange-700', border: 'border-orange-200', bg: 'bg-orange-50' }
  return { bar: 'bg-green-500', badge: 'bg-green-100 text-green-700', border: 'border-gray-200', bg: 'bg-white' }
}

function getCurrentUser(): string {
  try {
    const stored = localStorage.getItem('arraia_user')
    if (stored) return (JSON.parse(stored) as { name?: string }).name ?? 'desconhecido'
  } catch { /* */ }
  return 'desconhecido'
}

function fmtDateTime(d: Date): string {
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const TYPE_LABEL: Record<StockEntry['type'], string> = {
  adjust: 'Ajuste',
  set:    'Definido',
  reset:  'Reposto',
  entry:  'Entrada',
  open:   'Abertura',
  sale:   'Venda',
}

// Itens antigos da carga inicial de exemplo (seedMenuItems), substituídos pelo
// cardápio real cadastrado em Config → Cardápio. Não devem aparecer como sugestão.
const LEGACY_SEED_NAMES = new Set([
  'coxinha', 'pastel de carne', 'pastel de queijo', 'rissole',
  'hambúrguer', 'x-salada', 'hot dog', 'milho verde', 'pamonha',
  'canjica', 'quentão', 'refrigerante',
])

function isLegacyItem(item: MenuItem): boolean {
  return LEGACY_SEED_NAMES.has(item.name.toLowerCase()) && item.name !== item.name.toUpperCase()
}

export default function Inventory() {
  const { addToast } = useApp()
  const [items, setItems] = useState<MenuItem[]>([])
  const [entries, setEntries] = useState<StockEntry[]>([])
  const [adjustId, setAdjustId] = useState<string | null>(null)
  const [adjustVal, setAdjustVal] = useState('')
  const [initialId, setInitialId] = useState<string | null>(null)
  const [initialVal, setInitialVal] = useState('')
  const [showHistory, setShowHistory] = useState(false)

  // Lançar estoque — tela única para definir a contagem do dia OU adicionar entrada
  const [stockMode, setStockMode] = useState(false)
  const [stockKind, setStockKind] = useState<'set' | 'add'>('set')
  const [stockValues, setStockValues] = useState<Record<string, string>>({})
  const [stockWorking, setStockWorking] = useState(false)

  // Repor tudo
  const [resetAllPending, setResetAllPending] = useState(false)
  const [resetAllWorking, setResetAllWorking] = useState(false)

  // Limpar itens antigos (seed de exemplo)
  const [cleanupPending, setCleanupPending] = useState(false)
  const [cleanupWorking, setCleanupWorking] = useState(false)

  useEffect(() => {
    const unsub = subscribeMenuItems(setItems)
    return unsub
  }, [])

  useEffect(() => {
    if (!showHistory) return
    const unsub = subscribeStockEntries(setEntries)
    return unsub
  }, [showHistory])

  const handleAdjust = async (item: MenuItem, delta: number) => {
    const before = item.stock ?? 0
    const after = before + delta
    try {
      await updateMenuItem(item.id, { stock: after })
      await addStockEntry({
        menu_item_id: item.id,
        menu_item_name: item.name,
        type: 'adjust',
        qty_before: before,
        qty_after: after,
        inserted_by: getCurrentUser(),
      })
    } catch { addToast('Erro ao ajustar') }
  }

  const handleSetStock = async (item: MenuItem) => {
    const val = parseInt(adjustVal, 10)
    if (isNaN(val)) return
    const before = item.stock ?? 0
    try {
      await updateMenuItem(item.id, { stock: val })
      await addStockEntry({
        menu_item_id: item.id,
        menu_item_name: item.name,
        type: 'set',
        qty_before: before,
        qty_after: val,
        inserted_by: getCurrentUser(),
      })
      setAdjustId(null)
      setAdjustVal('')
    } catch { addToast('Erro ao salvar') }
  }

  const handleSetInitial = async (item: MenuItem) => {
    const val = parseInt(initialVal, 10)
    if (isNaN(val) || val <= 0) return
    const before = item.stock ?? 0
    try {
      await updateMenuItem(item.id, { stock_initial: val, stock: val })
      await addStockEntry({
        menu_item_id: item.id,
        menu_item_name: item.name,
        type: 'reset',
        qty_before: before,
        qty_after: val,
        inserted_by: getCurrentUser(),
      })
      setInitialId(null)
      setInitialVal('')
      addToast(`Estoque inicial de ${item.name} definido como ${val}`, 'success')
    } catch { addToast('Erro ao salvar') }
  }

  const handleReset = async (item: MenuItem) => {
    if (!item.stock_initial) return
    const before = item.stock ?? 0
    try {
      await updateMenuItem(item.id, { stock: item.stock_initial })
      await addStockEntry({
        menu_item_id: item.id,
        menu_item_name: item.name,
        type: 'reset',
        qty_before: before,
        qty_after: item.stock_initial,
        inserted_by: getCurrentUser(),
      })
      addToast(`${item.name} reposto para ${item.stock_initial}`, 'success')
    } catch { addToast('Erro ao repor') }
  }

  // Lançar estoque: aplica os valores digitados na tela única.
  // 'set' = define a contagem (substitui stock e o estoque inicial de referência)
  // 'add' = soma a quantidade que chegou ao estoque atual
  const handleSaveStock = async () => {
    const user = getCurrentUser()
    const tasks: Array<() => Promise<void>> = []

    for (const item of items.filter((i) => !isLegacyItem(i))) {
      const raw = stockValues[item.id]
      if (raw === undefined || raw === '') continue
      const val = parseInt(raw, 10)
      if (isNaN(val) || val < 0) continue
      const before = item.stock ?? 0

      if (stockKind === 'set') {
        tasks.push(async () => {
          await updateMenuItem(item.id, { stock_initial: val, stock: val })
          await addStockEntry({
            menu_item_id: item.id,
            menu_item_name: item.name,
            type: 'open',
            qty_before: before,
            qty_after: val,
            inserted_by: user,
          })
        })
      } else {
        if (val <= 0) continue
        const after = before + val
        const configured = (item.stock_initial ?? 0) > 0
        tasks.push(async () => {
          await updateMenuItem(item.id, configured ? { stock: after } : { stock_initial: after, stock: after })
          await addStockEntry({
            menu_item_id: item.id,
            menu_item_name: item.name,
            type: 'entry',
            qty_before: before,
            qty_after: after,
            inserted_by: user,
          })
        })
      }
    }

    if (tasks.length === 0) {
      addToast('Nenhuma quantidade informada')
      return
    }

    setStockWorking(true)
    try {
      await Promise.all(tasks.map((t) => t()))
      addToast(
        stockKind === 'set'
          ? `Estoque definido para ${tasks.length} produto(s)`
          : `Entrada registrada em ${tasks.length} produto(s)`,
        'success',
      )
      setStockValues({})
      setStockMode(false)
    } catch { addToast('Erro ao salvar estoque') }
    finally { setStockWorking(false) }
  }

  // Reset all configured items to their initial stock
  const handleResetAll = async () => {
    const configured = items.filter((i) => (i.stock_initial ?? 0) > 0)
    if (configured.length === 0) return
    setResetAllWorking(true)
    const user = getCurrentUser()
    try {
      await Promise.all(
        configured.map(async (item) => {
          await updateMenuItem(item.id, { stock: item.stock_initial! })
          await addStockEntry({
            menu_item_id: item.id,
            menu_item_name: item.name,
            type: 'reset',
            qty_before: item.stock ?? 0,
            qty_after: item.stock_initial!,
            inserted_by: user,
          })
        })
      )
      addToast(`${configured.length} produto(s) repostos ao estoque inicial`, 'success')
      setResetAllPending(false)
    } catch { addToast('Erro ao repor estoques') }
    finally { setResetAllWorking(false) }
  }

  // Remove itens antigos da carga de exemplo que não fazem parte do cardápio atual
  const handleCleanupLegacy = async () => {
    if (legacyItems.length === 0) return
    setCleanupWorking(true)
    try {
      await Promise.all(legacyItems.map((item) => deleteMenuItem(item.id)))
      addToast(`${legacyItems.length} item(ns) antigo(s) removido(s)`, 'success')
      setCleanupPending(false)
    } catch { addToast('Erro ao remover itens antigos') }
    finally { setCleanupWorking(false) }
  }

  const stockItems = items.filter((i) => i.stock_initial !== undefined && i.stock_initial > 0)
  const legacyItems = items.filter(isLegacyItem)
  const noStockItems = items.filter((i) => !i.stock_initial && !isLegacyItem(i))
  const lowItems = stockItems.filter((i) => (i.stock ?? 0) > 0 && (i.stock ?? 0) <= LOW_STOCK_THRESHOLD)
  const emptyItems = stockItems.filter((i) => (i.stock ?? 0) <= 0)

  const bySector = stockItems.reduce<Record<string, MenuItem[]>>((acc, item) => {
    const s = item.sector ?? 'Assados'
    if (!acc[s]) acc[s] = []
    acc[s].push(item)
    return acc
  }, {})

  const allBySector = items.filter((i) => !isLegacyItem(i)).reduce<Record<string, MenuItem[]>>((acc, item) => {
    const s = item.sector ?? 'Assados'
    if (!acc[s]) acc[s] = []
    acc[s].push(item)
    return acc
  }, {})

  // ── Lançar estoque (tela única: Definir contagem OU Adicionar entrada) ──────

  if (stockMode) {
    const isSet = stockKind === 'set'
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <div className="mb-5 flex items-center gap-3">
          <div>
            <h1 className="font-serif italic text-2xl md:text-3xl text-accent-dark flex items-center gap-2">
              <Boxes className="text-accent" size={26} />
              Lançar Estoque
            </h1>
            <p className="text-gray-400 text-xs mt-0.5">
              Preencha só os itens que quer alterar · deixe em branco os demais
            </p>
          </div>
          <div className="flex-1" />
          <button
            onClick={() => { setStockMode(false); setStockValues({}) }}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-2xl px-3 py-2 transition-colors"
          >
            <X size={14} />
            Cancelar
          </button>
        </div>

        {/* Seletor: o que o número digitado significa */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
          <button
            onClick={() => setStockKind('set')}
            className={`text-left rounded-2xl border-2 px-4 py-3 transition-colors ${
              isSet ? 'border-accent bg-accent/5' : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-0.5">
              <DoorOpen size={16} className={isSet ? 'text-accent' : 'text-gray-400'} />
              <span className={`font-bold text-sm ${isSet ? 'text-accent-dark' : 'text-gray-600'}`}>Definir quantidade</span>
              {isSet && <Check size={14} className="text-accent ml-auto" />}
            </div>
            <p className="text-xs text-gray-400">Quantos você tem agora. O número digitado vira o total (use ao abrir a cozinha).</p>
          </button>
          <button
            onClick={() => setStockKind('add')}
            className={`text-left rounded-2xl border-2 px-4 py-3 transition-colors ${
              !isSet ? 'border-accent bg-accent/5' : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-0.5">
              <PackagePlus size={16} className={!isSet ? 'text-accent' : 'text-gray-400'} />
              <span className={`font-bold text-sm ${!isSet ? 'text-accent-dark' : 'text-gray-600'}`}>Adicionar entrada</span>
              {!isSet && <Check size={14} className="text-accent ml-auto" />}
            </div>
            <p className="text-xs text-gray-400">Quanto chegou a mais. O número é somado ao que já existe (reposição).</p>
          </button>
        </div>

        {Object.entries(allBySector).map(([sector, sectorItems]) => (
          <div key={sector} className="mb-6">
            <h2 className={`text-xs font-black uppercase tracking-widest mb-3 ${SECTOR_COLOR[sector] ?? 'text-gray-500'}`}>
              {sector}
            </h2>
            <div className="space-y-2">
              {sectorItems.map((item) => {
                const raw = stockValues[item.id] ?? ''
                const val = parseInt(raw, 10)
                const current = item.stock ?? 0
                const initial = item.stock_initial ?? 0
                const configured = initial > 0
                const hasVal = raw !== '' && !isNaN(val) && val >= 0 && (isSet || val > 0)
                const preview = isSet ? val : current + val
                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl border px-4 py-3 flex items-center gap-4 transition-colors ${
                      hasVal ? 'border-accent/40 bg-accent/5' : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-800">{item.name}</p>
                      <p className="text-xs text-gray-400">
                        {configured ? (
                          <>
                            Atual:{' '}
                            <span className={`font-bold ${current <= 0 ? 'text-red-500' : current <= LOW_STOCK_THRESHOLD ? 'text-orange-500' : 'text-gray-700'}`}>
                              {current}
                            </span>
                            {' '}/ {initial}
                          </>
                        ) : (
                          <span className="italic">Sem estoque ainda</span>
                        )}
                        {hasVal && (
                          <span className="ml-2 text-accent font-semibold">→ {preview}</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!isSet && <span className="text-gray-400 text-sm font-medium">+</span>}
                      <input
                        type="number"
                        min={0}
                        value={raw}
                        onChange={(e) => setStockValues((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        placeholder={isSet ? 'qtd' : '0'}
                        className="w-24 px-3 py-1.5 rounded-xl border-2 border-gray-200 focus:border-accent/60 focus:outline-none text-lg font-black text-center"
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {items.length === 0 && (
          <div className="bg-white rounded-3xl p-16 text-center shadow-sm">
            <Boxes size={48} className="mx-auto mb-3 text-gray-200" />
            <p className="text-gray-400 text-sm">Nenhum produto no cardápio</p>
            <p className="text-gray-300 text-xs mt-1">Cadastre produtos em Config → Cardápio</p>
          </div>
        )}

        <div className="sticky bottom-0 -mx-4 md:-mx-6 mt-8 px-4 md:px-6 py-4 bg-background/90 backdrop-blur border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={() => { setStockMode(false); setStockValues({}) }}
            className="px-4 py-2.5 rounded-2xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSaveStock}
            disabled={stockWorking}
            className="px-6 py-2.5 rounded-2xl bg-accent hover:bg-accent-dark text-white text-sm font-semibold transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {stockWorking ? <RefreshCw size={15} className="animate-spin" /> : isSet ? <DoorOpen size={15} /> : <Check size={15} />}
            {isSet ? 'Definir Estoque' : 'Confirmar Entradas'}
          </button>
        </div>
      </div>
    )
  }

  // ── Normal view ────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <h1 className="font-serif italic text-2xl md:text-3xl text-accent-dark flex items-center gap-2">
            <Boxes className="text-accent" size={26} />
            Estoque Diário
          </h1>
          <p className="text-gray-400 text-xs mt-0.5">
            {stockItems.length} produto(s) com estoque configurado · alerta abaixo de {LOW_STOCK_THRESHOLD} · negativo permitido
          </p>
        </div>

        {/* Repor Tudo */}
        {stockItems.length > 0 && (
          <AnimatePresence mode="wait">
            {resetAllPending ? (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-2xl px-3 py-2"
              >
                <span className="text-xs text-orange-700 font-medium">Repor todos?</span>
                <button
                  onClick={handleResetAll}
                  disabled={resetAllWorking}
                  className="flex items-center gap-1 text-xs text-white bg-orange-500 hover:bg-orange-600 px-3 py-1 rounded-xl font-semibold transition-colors disabled:opacity-50"
                >
                  {resetAllWorking ? <RefreshCw size={11} className="animate-spin" /> : <Check size={11} />}
                  Confirmar
                </button>
                <button
                  onClick={() => setResetAllPending(false)}
                  className="text-orange-400 hover:text-orange-600"
                >
                  <X size={14} />
                </button>
              </motion.div>
            ) : (
              <motion.button
                key="btn"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setResetAllPending(true)}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-accent-dark border border-gray-200 hover:border-accent/40 rounded-2xl px-3 py-2 transition-colors"
                title="Repor todos os produtos ao estoque inicial"
              >
                <RotateCcw size={14} />
                Repor Tudo
              </motion.button>
            )}
          </AnimatePresence>
        )}

        {/* Lançar Estoque (definir contagem ou adicionar entrada) */}
        <button
          onClick={() => { setStockMode(true); setStockKind('set'); setStockValues({}) }}
          className="flex items-center gap-1.5 text-sm text-white bg-accent hover:bg-accent-dark rounded-2xl px-3 py-2 transition-colors font-medium"
        >
          <PackagePlus size={15} />
          Lançar Estoque
        </button>

        <button
          onClick={() => setShowHistory((p) => !p)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-accent-dark border border-gray-200 hover:border-accent/40 rounded-2xl px-3 py-2 transition-colors"
        >
          <History size={15} />
          Histórico
          {showHistory ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
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
                  Zerado/Negativo: {emptyItems.map((i) => `${i.name} (${i.stock ?? 0})`).join(', ')}
                </p>
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
              const pct = initial > 0 ? Math.max(0, Math.min(100, (qty / initial) * 100)) : 0
              const { bar, badge, border, bg } = stockColors(qty, initial)
              const isNeg = qty < 0
              const isEmpty = qty === 0
              const isLow = qty > 0 && qty <= LOW_STOCK_THRESHOLD

              return (
                <motion.div
                  key={item.id}
                  layout
                  className={`rounded-2xl border p-4 ${bg} ${border}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="font-semibold text-sm text-gray-800 leading-tight">{item.name}</p>
                    {isNeg ? (
                      <motion.span
                        animate={{ opacity: [1, 0.5, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                        className={`shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full ${badge}`}
                      >
                        NEGATIVO
                      </motion.span>
                    ) : isEmpty ? (
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
                        type="number" value={adjustVal} autoFocus
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
                      <span className={`font-black text-4xl leading-none ${isNeg ? 'text-red-600' : isEmpty ? 'text-red-500' : isLow ? 'text-orange-500' : 'text-gray-800'}`}>
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
                    <button onClick={() => handleAdjust(item, -1)}
                      className="w-8 h-8 rounded-xl bg-white border border-gray-200 hover:bg-red-50 text-gray-500 hover:text-red-500 flex items-center justify-center transition-colors">
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

      {/* Legacy seed items not present in the current cardápio */}
      {legacyItems.length > 0 && (
        <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-500">
              {legacyItems.length} item(ns) antigo(s) de exemplo, fora do cardápio atual
            </p>
            <p className="text-xs text-gray-400 truncate">
              {legacyItems.map((i) => i.name).join(', ')}
            </p>
          </div>
          <AnimatePresence mode="wait">
            {cleanupPending ? (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-3 py-2"
              >
                <span className="text-xs text-red-700 font-medium">Excluir definitivamente?</span>
                <button
                  onClick={handleCleanupLegacy}
                  disabled={cleanupWorking}
                  className="flex items-center gap-1 text-xs text-white bg-red-500 hover:bg-red-600 px-3 py-1 rounded-xl font-semibold transition-colors disabled:opacity-50"
                >
                  {cleanupWorking ? <RefreshCw size={11} className="animate-spin" /> : <Check size={11} />}
                  Confirmar
                </button>
                <button
                  onClick={() => setCleanupPending(false)}
                  className="text-red-400 hover:text-red-600"
                >
                  <X size={14} />
                </button>
              </motion.div>
            ) : (
              <motion.button
                key="btn"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setCleanupPending(true)}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-600 border border-gray-200 hover:border-red-300 rounded-2xl px-3 py-2 transition-colors shrink-0"
                title="Remover itens antigos que não fazem parte do cardápio atual"
              >
                <Trash2 size={14} />
                Limpar antigos
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      )}

      {items.length === 0 && (
        <div className="bg-white rounded-3xl p-16 text-center shadow-sm">
          <Boxes size={48} className="mx-auto mb-3 text-gray-200" />
          <p className="text-gray-400 text-sm">Nenhum produto no cardápio</p>
          <p className="text-gray-300 text-xs mt-1">Cadastre produtos em Config → Cardápio</p>
        </div>
      )}

      {/* Relatório diário de estoque */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-8 overflow-hidden"
          >
            <h2 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3 flex items-center gap-2">
              <History size={13} />
              Relatório de Estoque por Dia
            </h2>

            {entries.length === 0 ? (
              <div className="bg-white rounded-3xl p-10 text-center text-gray-300 text-sm shadow-sm">
                Nenhuma movimentação registrada ainda
              </div>
            ) : (() => {
              // Agrupar por dia (dd/mm/aaaa)
              const dayLabel = (d: Date) =>
                d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
              const dayKey = (d: Date) => d.toLocaleDateString('pt-BR')

              const groups: { key: string; label: string; entries: StockEntry[] }[] = []
              for (const e of entries) {
                const k = dayKey(e.inserted_at)
                const existing = groups.find((g) => g.key === k)
                if (existing) existing.entries.push(e)
                else groups.push({ key: k, label: dayLabel(e.inserted_at), entries: [e] })
              }

              return (
                <div className="space-y-4">
                  {groups.map(({ key, label, entries: dayEntries }) => {
                    const users = [...new Set(dayEntries.map((e) => e.inserted_by))].join(', ')
                    return (
                      <div key={key} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                        {/* Day header */}
                        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                          <div>
                            <p className="font-bold text-sm text-gray-800 capitalize">{label}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {dayEntries.length} movimento(s) · por{' '}
                              <span className="font-semibold text-gray-600">{users}</span>
                            </p>
                          </div>
                          <span className="text-xs text-gray-300 font-mono">{key}</span>
                        </div>

                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-50">
                              <th className="text-left px-4 py-2 text-gray-400 font-medium text-xs">Hora</th>
                              <th className="text-left px-4 py-2 text-gray-400 font-medium text-xs">Produto</th>
                              <th className="text-center px-4 py-2 text-gray-400 font-medium text-xs">Antes</th>
                              <th className="text-center px-4 py-2 text-gray-400 font-medium text-xs">Depois</th>
                              <th className="text-center px-4 py-2 text-gray-400 font-medium text-xs">Tipo</th>
                              <th className="text-left px-4 py-2 text-gray-400 font-medium text-xs">Quem</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dayEntries.map((e) => {
                              const diff = e.qty_after - e.qty_before
                              const hour = e.inserted_at.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                              return (
                                <tr key={e.id} className="border-t border-gray-50 hover:bg-gray-50">
                                  <td className="px-4 py-2.5 text-gray-400 text-xs font-mono">{hour}</td>
                                  <td className="px-4 py-2.5 font-medium text-gray-700">{e.menu_item_name}</td>
                                  <td className="px-4 py-2.5 text-center text-gray-400">{e.qty_before}</td>
                                  <td className="px-4 py-2.5 text-center">
                                    <span className={`font-bold ${e.qty_after < 0 ? 'text-red-600' : diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                                      {e.qty_after}
                                      {diff !== 0 && (
                                        <span className="ml-1 text-xs font-normal opacity-60">
                                          ({diff > 0 ? '+' : ''}{diff})
                                        </span>
                                      )}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2.5 text-center">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                      e.type === 'entry' ? 'bg-green-100 text-green-700' :
                                      e.type === 'open'  ? 'bg-accent/10 text-accent-dark' :
                                      e.type === 'reset' ? 'bg-blue-100 text-blue-600' :
                                      e.type === 'set'   ? 'bg-purple-100 text-purple-600' :
                                      e.type === 'sale'  ? 'bg-red-100 text-red-600' :
                                                           'bg-gray-100 text-gray-500'
                                    }`}>
                                      {TYPE_LABEL[e.type]}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2.5 text-xs text-gray-500 font-medium">{e.inserted_by}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
