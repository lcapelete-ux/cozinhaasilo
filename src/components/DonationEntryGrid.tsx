import { useState, useRef, useEffect, useMemo } from 'react'
import { Plus, Trash2, Table2 } from 'lucide-react'
import { formatBRL, parseAmount } from '../utils/donations'

export interface GridItem {
  donor: string
  amount: number
  note: string
}

interface Row {
  donor: string
  amount: string
  note: string
}

const EMPTY: Row = { donor: '', amount: '', note: '' }
const COLS = ['donor', 'amount', 'note'] as const
const LINHAS_INICIAIS = 4

const vazia = (r: Row) => !r.donor.trim() && !r.amount.trim() && !r.note.trim()

// Converte o que veio da área de transferência numa matriz. Planilha copiada
// chega com colunas separadas por tab e linhas por quebra de linha.
function parseClipboard(text: string): string[][] {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\n+$/, '')
    .split('\n')
    .map((linha) => linha.split('\t'))
}

// Grade de digitação no estilo de planilha: Tab anda nos campos, Enter desce
// uma linha, e dá para colar várias linhas direto do Excel. As doações só vão
// para o banco quando se clica em salvar.
export default function DonationEntryGrid({
  onSave,
}: {
  onSave: (items: GridItem[]) => Promise<void>
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    Array.from({ length: LINHAS_INICIAIS }, () => ({ ...EMPTY }))
  )
  const [saving, setSaving] = useState(false)
  const [focusTarget, setFocusTarget] = useState<{ r: number; c: number } | null>(null)
  const inputs = useRef(new Map<string, HTMLInputElement | null>())

  useEffect(() => {
    if (!focusTarget) return
    const el = inputs.current.get(`${focusTarget.r}:${focusTarget.c}`)
    if (el) {
      el.focus()
      el.select()
    }
    setFocusTarget(null)
  }, [focusTarget])

  // Mantém sempre uma linha vazia no fim, para continuar digitando sem parar
  // para adicionar linha.
  const withTrailingRow = (list: Row[]): Row[] =>
    list.length === 0 || !vazia(list[list.length - 1]) ? [...list, { ...EMPTY }] : list

  const setCell = (r: number, campo: keyof Row, valor: string) => {
    setRows((prev) => {
      const next = prev.map((row, i) => (i === r ? { ...row, [campo]: valor } : row))
      return withTrailingRow(next)
    })
  }

  const removeRow = (r: number) => {
    setRows((prev) => withTrailingRow(prev.filter((_, i) => i !== r)))
  }

  const handleKeyDown = (e: React.KeyboardEvent, r: number, c: number) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      setRows((prev) => withTrailingRow(prev))
      setFocusTarget({ r: r + 1, c })
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusTarget({ r: r + 1, c })
    } else if (e.key === 'ArrowUp' && r > 0) {
      e.preventDefault()
      setFocusTarget({ r: r - 1, c })
    }
  }

  const handlePaste = (e: React.ClipboardEvent, r: number, c: number) => {
    const texto = e.clipboardData.getData('text')
    if (!texto.includes('\t') && !texto.includes('\n')) return // célula única: cola normal
    e.preventDefault()
    const matriz = parseClipboard(texto)
    setRows((prev) => {
      const next = prev.map((row) => ({ ...row }))
      matriz.forEach((celulas, dr) => {
        const linha = r + dr
        while (next.length <= linha) next.push({ ...EMPTY })
        celulas.forEach((valor, dc) => {
          const col = c + dc
          if (col > 2) return
          next[linha][COLS[col]] = valor.trim()
        })
      })
      return withTrailingRow(next)
    })
  }

  const preenchidas = useMemo(() => rows.filter((r) => !vazia(r)), [rows])
  const validas = useMemo(
    () =>
      preenchidas
        .map((r) => ({ donor: r.donor.trim(), amount: parseAmount(r.amount), note: r.note.trim() }))
        .filter((r) => r.donor && Number.isFinite(r.amount) && r.amount > 0),
    [preenchidas]
  )
  const invalidas = preenchidas.length - validas.length
  const subtotal = validas.reduce((s, r) => s + r.amount, 0)

  const linhaInvalida = (r: Row) => {
    if (vazia(r)) return false
    const valor = parseAmount(r.amount)
    return !r.donor.trim() || !Number.isFinite(valor) || valor <= 0
  }

  const handleSave = async () => {
    if (validas.length === 0) return
    setSaving(true)
    try {
      await onSave(validas)
      // As linhas com problema continuam na grade para serem corrigidas — se
      // fossem limpas junto, uma colagem grande perderia em silêncio as linhas
      // sem nome ou com valor inválido.
      const pendentes = rows.filter(linhaInvalida)
      setRows(
        pendentes.length > 0
          ? withTrailingRow(pendentes)
          : Array.from({ length: LINHAS_INICIAIS }, () => ({ ...EMPTY }))
      )
      setFocusTarget({ r: 0, c: 0 })
    } finally {
      setSaving(false)
    }
  }

  const cellClass =
    'w-full px-3 py-2 bg-transparent border-0 focus:outline-none focus:ring-2 focus:ring-accent focus:bg-white rounded-lg text-sm'

  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm">
      <h2 className="font-bold text-gray-800 mb-1 flex items-center gap-2">
        <Table2 size={16} className="text-accent" />
        Registrar doações
      </h2>
      <p className="text-xs text-gray-400 mb-4">
        Digite como numa planilha: <strong>Tab</strong> passa de campo, <strong>Enter</strong> desce
        uma linha. Dá para colar várias linhas copiadas do Excel. Doações repetidas do mesmo nome
        somam no ranking.
      </p>

      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full min-w-[520px] border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="text-left text-[11px] font-bold uppercase tracking-widest text-gray-400 px-3 pb-1 w-10">
                #
              </th>
              <th className="text-left text-[11px] font-bold uppercase tracking-widest text-gray-400 px-3 pb-1">
                Doador
              </th>
              <th className="text-left text-[11px] font-bold uppercase tracking-widest text-gray-400 px-3 pb-1 w-36">
                Valor (R$)
              </th>
              <th className="text-left text-[11px] font-bold uppercase tracking-widest text-gray-400 px-3 pb-1">
                Observação
              </th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => {
              const ruim = linhaInvalida(row)
              return (
                <tr key={r} className={ruim ? 'bg-red-50' : r % 2 ? 'bg-gray-50/60' : ''}>
                  <td className="px-3 py-1 text-xs font-bold text-gray-300 tabular-nums">{r + 1}</td>
                  {COLS.map((campo, c) => (
                    <td key={campo} className="p-0.5">
                      <input
                        ref={(el) => { inputs.current.set(`${r}:${c}`, el) }}
                        type="text"
                        inputMode={campo === 'amount' ? 'decimal' : undefined}
                        value={row[campo]}
                        onChange={(e) => setCell(r, campo, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, r, c)}
                        onPaste={(e) => handlePaste(e, r, c)}
                        placeholder={campo === 'donor' ? 'Nome' : campo === 'amount' ? '0,00' : '—'}
                        className={`${cellClass} ${campo === 'amount' ? 'font-bold tabular-nums' : ''}`}
                      />
                    </td>
                  ))}
                  <td className="px-1">
                    {!vazia(row) && (
                      <button
                        onClick={() => removeRow(r)}
                        title="Remover linha"
                        className="w-7 h-7 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-4">
        <button
          onClick={handleSave}
          disabled={saving || validas.length === 0}
          className="flex items-center gap-2 bg-accent hover:bg-accent-dark disabled:opacity-40 text-white px-5 py-2.5 rounded-2xl text-sm font-semibold transition-colors"
        >
          <Plus size={16} />
          {validas.length > 0
            ? `Salvar ${validas.length} doaç${validas.length === 1 ? 'ão' : 'ões'}`
            : 'Salvar'}
        </button>

        {validas.length > 0 && (
          <span className="text-sm text-gray-500">
            Subtotal <strong className="text-accent-dark">{formatBRL(subtotal)}</strong>
          </span>
        )}

        {invalidas > 0 && (
          <span className="text-xs font-semibold text-red-500">
            {invalidas} linha{invalidas !== 1 ? 's' : ''} em vermelho: falta nome ou valor válido
          </span>
        )}
      </div>
    </div>
  )
}
