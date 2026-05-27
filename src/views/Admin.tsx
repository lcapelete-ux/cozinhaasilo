import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Settings, Users, UtensilsCrossed, Ticket, Printer, Plus, Trash2, Edit2, Check, X, Eye, EyeOff, DatabaseZap, AlertTriangle, ZoomIn, ZoomOut, Monitor, Tv2, CloudUpload, ExternalLink, type LucideIcon } from 'lucide-react'
import { DISPLAY_ZOOM_KEY, DISPLAY_SCANNER_HIDDEN_KEY } from './Display'
import { QRCodeSVG } from 'qrcode.react'
import {
  subscribeUsers, addUser, updateUser, deleteUser,
  subscribeMenuItems, addMenuItem, updateMenuItem, deleteMenuItem,
  clearAllOrders, subscribeAllOrders,
  subscribeStorageConfig, setStorageConfig, type SupabaseStorageConfig,
} from '../services/firebaseService'
import { useApp } from '../App'
import type { User, MenuItem } from '../types'

type Tab = 'users' | 'menu' | 'fichas' | 'dados'

const ALL_VIEWS = 'reception,kitchen,kitchen-scanner,kitchen-sectors,display,dispatch,history,inventory,extra-fichas,admin-dashboard,admin'

export default function Admin() {
  const { addToast } = useApp()
  const [tab, setTab] = useState<Tab>('users')

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="font-serif italic text-3xl text-accent-dark flex items-center gap-2">
          <Settings className="text-accent" size={28} />
          Configurações
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {(['users', 'menu', 'fichas', 'dados'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`relative px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              tab === t ? 'text-accent-dark' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {tab === t && (
              <motion.div
                layoutId="admin-tab"
                className="absolute inset-0 bg-white rounded-xl shadow-sm"
              />
            )}
            <span className="relative flex items-center gap-1.5">
              {t === 'users' ? <Users size={15} /> : t === 'menu' ? <UtensilsCrossed size={15} /> : t === 'fichas' ? <Ticket size={15} /> : <DatabaseZap size={15} />}
              {t === 'users' ? 'Usuários' : t === 'menu' ? 'Cardápio' : t === 'fichas' ? 'Fichas' : 'Dados'}
            </span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === 'users' && (
          <motion.div key="users" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <UsersTab addToast={addToast} />
          </motion.div>
        )}
        {tab === 'menu' && (
          <motion.div key="menu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <MenuTab addToast={addToast} />
          </motion.div>
        )}
        {tab === 'fichas' && (
          <motion.div key="fichas" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <FichasTab />
          </motion.div>
        )}
        {tab === 'dados' && (
          <motion.div key="dados" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <DadosTab addToast={addToast} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Fichas Tab ───────────────────────────────────────────────────────────────

function FichasTab() {
  const [start, setStart] = useState(1)
  const [end, setEnd] = useState(50)
  const printRef = useRef<HTMLDivElement>(null)

  const count = Math.max(0, end - start + 1)
  const numbers = count > 0 ? Array.from({ length: Math.min(count, 500) }, (_, i) => start + i) : []

  const handlePrint = () => {
    const printContent = printRef.current
    if (!printContent) return
    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) return
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Fichas — Arraiá do Lar São Cristóvão</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Georgia, serif; background: white; }
            .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; padding: 16px; }
            .ficha {
              border: 2px dashed #5A5A40;
              border-radius: 12px;
              padding: 12px 8px;
              text-align: center;
              page-break-inside: avoid;
              background: #FFFDF5;
            }
            .ficha-title { font-size: 7px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
            .ficha-event { font-size: 8px; font-style: italic; color: #5A5A40; margin-bottom: 6px; font-weight: bold; }
            .ficha-number { font-size: 28px; font-weight: 900; color: #3A3A28; line-height: 1; margin-bottom: 6px; }
            .ficha-qr { display: flex; justify-content: center; margin-bottom: 4px; }
            .ficha-qr svg { width: 72px !important; height: 72px !important; }
            .ficha-code { font-size: 8px; color: #aaa; font-family: monospace; }
            @media print {
              body { margin: 0; }
              .grid { padding: 8px; gap: 6px; }
            }
          </style>
        </head>
        <body>
          <div class="grid">
            ${numbers.map((n) => {
              const svgEl = printContent.querySelector(`[data-ficha="${n}"] svg`)
              const svgHtml = svgEl ? svgEl.outerHTML : ''
              return `
                <div class="ficha">
                  <div class="ficha-title">Ficha</div>
                  <div class="ficha-event">Arraiá do Lar São Cristóvão</div>
                  <div class="ficha-number">#${n}</div>
                  <div class="ficha-qr">${svgHtml}</div>
                  <div class="ficha-code">${n}</div>
                </div>
              `
            }).join('')}
          </div>
          <script>window.onload = () => { window.print(); }<\/script>
        </body>
      </html>
    `)
    win.document.close()
  }

  return (
    <div>
      {/* Controls */}
      <div className="bg-white rounded-3xl p-5 shadow-sm mb-5">
        <h3 className="font-serif italic text-lg text-accent-dark mb-4">Gerar Fichas para Impressão</h3>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Número inicial</label>
            <input
              type="number"
              min={1}
              value={start}
              onChange={(e) => setStart(Math.max(1, Number(e.target.value)))}
              className="w-28 px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-accent text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Número final</label>
            <input
              type="number"
              min={start}
              max={start + 499}
              value={end}
              onChange={(e) => setEnd(Math.min(start + 499, Math.max(start, Number(e.target.value))))}
              className="w-28 px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-accent text-sm"
            />
          </div>
          <div className="bg-accent/10 rounded-2xl px-4 py-2 text-sm text-accent-dark font-medium">
            {count} ficha{count !== 1 ? 's' : ''}
          </div>
          <button
            onClick={handlePrint}
            disabled={count === 0}
            className="flex items-center gap-2 bg-accent hover:bg-accent-dark text-white px-5 py-2 rounded-2xl text-sm font-medium transition-colors disabled:opacity-40 ml-auto"
          >
            <Printer size={16} />
            Gerar PDF / Imprimir
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Máximo de 500 fichas por vez. Cada ficha contém um QR Code com o número da ficha.
        </p>
      </div>

      {/* Hidden QR source for print extraction */}
      <div ref={printRef} className="hidden">
        {numbers.map((n) => (
          <div key={n} data-ficha={n}>
            <QRCodeSVG value={String(n)} size={72} />
          </div>
        ))}
      </div>

      {/* Preview */}
      {numbers.length > 0 && (
        <div className="bg-white rounded-3xl p-5 shadow-sm">
          <h3 className="font-medium text-gray-700 mb-4 text-sm">
            Pré-visualização (primeiras {Math.min(numbers.length, 12)} fichas)
          </h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {numbers.slice(0, 12).map((n) => (
              <div
                key={n}
                className="border-2 border-dashed border-accent/40 rounded-2xl p-3 text-center bg-amber-50/50"
              >
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Ficha</p>
                <p className="text-xs text-accent italic mb-2 font-semibold leading-tight">Arraiá do Lar</p>
                <p className="font-black text-xl text-accent-dark mb-2">#{n}</p>
                <div className="flex justify-center">
                  <QRCodeSVG value={String(n)} size={60} />
                </div>
              </div>
            ))}
            {numbers.length > 12 && (
              <div className="border-2 border-dashed border-gray-200 rounded-2xl p-3 text-center flex items-center justify-center">
                <p className="text-sm text-gray-400 font-medium">+{numbers.length - 12} mais</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Dados Tab ────────────────────────────────────────────────────────────────

const ZOOM_STEPS = [0.75, 0.85, 1, 1.15, 1.3, 1.5, 1.75, 2, 2.3, 2.6, 3]
const SECTORS_ZOOM_KEY = 'sectors-zoom'

function readZoom(key: string) {
  const v = parseFloat(localStorage.getItem(key) ?? '1')
  return isNaN(v) ? 1 : v
}

function applyZoom(key: string, value: number, eventName: string) {
  localStorage.setItem(key, String(value))
  window.dispatchEvent(new Event(eventName))
}

function ZoomRow({ label, icon: Icon, storageKey, eventName }: { label: string; icon: LucideIcon; storageKey: string; eventName: string }) {
  const [zoom, setZoom] = useState(() => readZoom(storageKey))
  const idx = ZOOM_STEPS.findIndex((s) => Math.abs(s - zoom) < 0.01)
  const safeIdx = idx === -1 ? ZOOM_STEPS.indexOf(1) : idx

  const change = (delta: number) => {
    const next = ZOOM_STEPS[Math.max(0, Math.min(ZOOM_STEPS.length - 1, safeIdx + delta))]
    setZoom(next)
    applyZoom(storageKey, next, eventName)
  }
  const reset = () => {
    setZoom(1)
    applyZoom(storageKey, 1, eventName)
  }

  return (
    <div className="flex items-center gap-4 py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-2 flex-1">
        <Icon size={16} className="text-gray-400" />
        <span className="text-sm font-medium text-gray-700">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => change(-1)} disabled={safeIdx === 0}
          className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 disabled:opacity-30 transition-colors">
          <ZoomOut size={14} />
        </button>
        <span className="text-sm font-black tabular-nums w-14 text-center text-gray-700">
          {Math.round(zoom * 100)}%
        </span>
        <button onClick={() => change(1)} disabled={safeIdx === ZOOM_STEPS.length - 1}
          className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 disabled:opacity-30 transition-colors">
          <ZoomIn size={14} />
        </button>
        <button onClick={reset} disabled={zoom === 1}
          className="text-xs text-gray-400 hover:text-accent-dark disabled:opacity-30 ml-1 transition-colors">
          reset
        </button>
      </div>
    </div>
  )
}

function ScannerHiddenToggle() {
  const [enabled, setEnabled] = useState(() => localStorage.getItem(DISPLAY_SCANNER_HIDDEN_KEY) === 'true')

  const toggle = () => {
    const next = !enabled
    setEnabled(next)
    localStorage.setItem(DISPLAY_SCANNER_HIDDEN_KEY, String(next))
    window.dispatchEvent(new Event('display-scanner-hidden-change'))
  }

  return (
    <div className="flex items-center gap-4 py-3 border-t border-gray-100 mt-1">
      <div className="flex items-center gap-2 flex-1">
        <Tv2 size={16} className="text-gray-400" />
        <div>
          <p className="text-sm font-medium text-gray-700">Leitor de código de barras oculto</p>
          <p className="text-xs text-gray-400">Esconde o campo manual do Painel Externo; o scanner continua funcionando normalmente.</p>
        </div>
      </div>
      <button
        onClick={toggle}
        className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${enabled ? 'bg-accent' : 'bg-gray-200'}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
      </button>
    </div>
  )
}

function SupabaseStorageSection({ addToast }: { addToast: (msg: string, type?: 'error' | 'success' | 'info') => void }) {
  const [cfg, setCfg] = useState<SupabaseStorageConfig | null>(null)
  const [form, setForm] = useState({ url: '', anon_key: '', bucket: 'media' })
  const [saving, setSaving] = useState(false)
  const [showKey, setShowKey] = useState(false)

  useEffect(() => {
    return subscribeStorageConfig((c) => {
      setCfg(c)
      if (c) setForm({ url: c.url, anon_key: c.anon_key, bucket: c.bucket })
    })
  }, [])

  const handleSave = async () => {
    if (!form.url.trim() || !form.anon_key.trim() || !form.bucket.trim()) {
      addToast('Preencha todos os campos')
      return
    }
    setSaving(true)
    try {
      await setStorageConfig({ url: form.url.trim().replace(/\/$/, ''), anon_key: form.anon_key.trim(), bucket: form.bucket.trim() })
      addToast('Configuração salva!', 'success')
    } catch { addToast('Erro ao salvar') }
    finally { setSaving(false) }
  }

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-1">
        <CloudUpload size={18} className="text-accent" />
        <h3 className="font-bold text-gray-800">Supabase Storage — Upload de Mídia</h3>
        {cfg?.url && (
          <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
            <Check size={10} /> Configurado
          </span>
        )}
      </div>
      <p className="text-sm text-gray-400 mb-4">
        Usa o Supabase Storage do seu projeto para hospedar fotos e vídeos do painel externo.
      </p>

      {/* Steps */}
      <div className="bg-gray-50 rounded-2xl px-4 py-3 mb-4 text-xs text-gray-600 space-y-1.5">
        <p className="font-semibold text-gray-700 mb-2">Como configurar no seu Supabase:</p>
        <p>1. Abra o projeto em <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline inline-flex items-center gap-0.5">supabase.com/dashboard <ExternalLink size={10} /></a></p>
        <p>2. Vá em <strong>Storage → New bucket</strong> → nomeie <code className="bg-gray-200 px-1 rounded">media</code> → marque <strong>Public bucket</strong></p>
        <p>3. Em <strong>Storage → Policies</strong>, adicione política INSERT para o role <code className="bg-gray-200 px-1 rounded">anon</code></p>
        <p>4. Copie a <strong>Project URL</strong> e a <strong>anon key</strong> em <strong>Settings → API</strong></p>
      </div>

      <div className="space-y-3 mb-4">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Project URL</label>
          <input
            type="text"
            placeholder="https://xxxx.supabase.co"
            value={form.url}
            onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-accent text-sm font-mono"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Anon Key</label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              placeholder="eyJhbGci…"
              value={form.anon_key}
              onChange={(e) => setForm((p) => ({ ...p, anon_key: e.target.value }))}
              className="w-full px-3 py-2 pr-9 rounded-xl border border-gray-200 focus:outline-none focus:border-accent text-sm font-mono"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Nome do bucket</label>
          <input
            type="text"
            placeholder="media"
            value={form.bucket}
            onChange={(e) => setForm((p) => ({ ...p, bucket: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-accent text-sm font-mono"
          />
        </div>
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-1.5 bg-accent text-white px-4 py-2 rounded-xl text-sm disabled:opacity-50"
      >
        <Check size={14} /> {saving ? 'Salvando…' : 'Salvar configuração'}
      </button>
    </div>
  )
}

function DadosTab({ addToast }: { addToast: (msg: string, type?: 'error' | 'success' | 'info') => void }) {
  const [orderCount, setOrderCount] = useState<number | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const unsub = subscribeAllOrders((orders) => setOrderCount(orders.length))
    return unsub
  }, [])

  const handleClear = async () => {
    setLoading(true)
    try {
      const deleted = await clearAllOrders()
      addToast(`${deleted} pedido${deleted !== 1 ? 's' : ''} removido${deleted !== 1 ? 's' : ''} com sucesso.`, 'success')
      setConfirming(false)
    } catch {
      addToast('Erro ao zerar histórico.', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Supabase Storage */}
      <SupabaseStorageSection addToast={addToast} />

      {/* Zoom dos monitores */}
      <div className="bg-white rounded-3xl p-6 shadow-sm">
        <h3 className="font-bold text-gray-800 mb-1">Zoom dos monitores</h3>
        <p className="text-sm text-gray-400 mb-4">Ajuste o tamanho da interface em cada TV. As alterações têm efeito imediato.</p>
        <ZoomRow label="Monitor de Produção (Setores)" icon={Monitor} storageKey={SECTORS_ZOOM_KEY} eventName="sectors-zoom-change" />
        <ZoomRow label="Painel Externo (Display)" icon={Tv2} storageKey={DISPLAY_ZOOM_KEY} eventName="display-zoom-change" />
        <ScannerHiddenToggle />
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-red-100">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-2xl bg-red-50 flex items-center justify-center shrink-0 mt-0.5">
            <Trash2 size={18} className="text-red-500" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-gray-800 mb-1">Zerar histórico de pedidos</h3>
            <p className="text-sm text-gray-500 mb-4">
              Remove permanentemente todos os pedidos do banco de dados.
              Use ao final de cada evento para preparar o sistema para a próxima edição.
              {orderCount !== null && (
                <span className="ml-1 font-semibold text-gray-700">
                  Atualmente há <span className="text-red-600">{orderCount}</span> pedido{orderCount !== 1 ? 's' : ''} registrado{orderCount !== 1 ? 's' : ''}.
                </span>
              )}
            </p>

            <AnimatePresence mode="wait">
              {!confirming ? (
                <motion.button
                  key="btn-initial"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setConfirming(true)}
                  className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-5 py-2.5 rounded-2xl text-sm font-bold transition-colors"
                >
                  <Trash2 size={15} />
                  Zerar histórico
                </motion.button>
              ) : (
                <motion.div
                  key="confirm"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="bg-red-50 border border-red-200 rounded-2xl p-4"
                >
                  <div className="flex items-center gap-2 text-red-700 font-bold text-sm mb-3">
                    <AlertTriangle size={16} />
                    Esta ação não pode ser desfeita. Confirma?
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleClear}
                      disabled={loading}
                      className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
                    >
                      {loading ? 'Zerando…' : 'Sim, zerar tudo'}
                    </button>
                    <button
                      onClick={() => setConfirming(false)}
                      disabled={loading}
                      className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-600 px-5 py-2 rounded-xl text-sm font-medium transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Users Tab ────────────────────────────────────────────────────────────────

function UsersTab({ addToast }: { addToast: (msg: string, type?: 'error' | 'success' | 'info') => void }) {
  const [users, setUsers] = useState<User[]>([])
  const [adding, setAdding] = useState(false)
  const [showPwd, setShowPwd] = useState<Record<string, boolean>>({})
  const [form, setForm] = useState({ name: '', password: '', role: 'staff', allowed_views: '' })
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', password: '', role: '', allowed_views: '' })

  useEffect(() => {
    const unsub = subscribeUsers(setUsers)
    return unsub
  }, [])

  const handleAdd = async () => {
    if (!form.name.trim() || !form.password.trim()) {
      addToast('Preencha nome e senha')
      return
    }
    try {
      await addUser({ ...form, allowed_views: form.allowed_views || ALL_VIEWS })
      setForm({ name: '', password: '', role: 'staff', allowed_views: '' })
      setAdding(false)
      addToast('Usuário criado!', 'success')
    } catch {
      addToast('Erro ao criar usuário')
    }
  }

  const handleSaveEdit = async () => {
    if (!editId) return
    try {
      await updateUser(editId, editForm)
      setEditId(null)
      addToast('Usuário atualizado!', 'success')
    } catch {
      addToast('Erro ao atualizar')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteUser(id)
      addToast('Usuário removido', 'success')
    } catch {
      addToast('Erro ao remover')
    }
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 bg-accent hover:bg-accent-dark text-white px-4 py-2 rounded-2xl text-sm font-medium transition-colors"
        >
          <Plus size={14} /> Novo usuário
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <input type="text" placeholder="Nome" value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-accent text-sm" />
              <input type="text" placeholder="Senha" value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                className="px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-accent text-sm" />
              <input type="text" placeholder="Função (admin, kitchen, staff...)" value={form.role}
                onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
                className="px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-accent text-sm" />
              <input type="text" placeholder="Views permitidas (sep. vírgula)" value={form.allowed_views}
                onChange={(e) => setForm((p) => ({ ...p, allowed_views: e.target.value }))}
                className="px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-accent text-sm" />
            </div>
            <p className="text-xs text-gray-400 mb-3">
              Views disponíveis: reception, kitchen, kitchen-scanner, kitchen-sectors, display, dispatch, history, inventory, extra-fichas, admin-dashboard, admin
            </p>
            <div className="flex gap-2">
              <button onClick={handleAdd} className="flex items-center gap-1.5 bg-accent text-white px-4 py-2 rounded-xl text-sm">
                <Check size={14} /> Salvar
              </button>
              <button onClick={() => setAdding(false)} className="flex items-center gap-1.5 bg-gray-100 text-gray-600 px-4 py-2 rounded-xl text-sm">
                <X size={14} /> Cancelar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Nome</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Senha</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Função</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Views</th>
              <th className="text-right px-4 py-3 text-gray-500 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-gray-100">
                {editId === user.id ? (
                  <>
                    <td className="px-4 py-2">
                      <input value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                        className="w-full px-2 py-1 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-accent" />
                    </td>
                    <td className="px-4 py-2">
                      <input value={editForm.password} onChange={(e) => setEditForm((p) => ({ ...p, password: e.target.value }))}
                        className="w-full px-2 py-1 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-accent" />
                    </td>
                    <td className="px-4 py-2">
                      <input value={editForm.role} onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value }))}
                        className="w-full px-2 py-1 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-accent" />
                    </td>
                    <td className="px-4 py-2" colSpan={2}>
                      <div className="flex gap-2">
                        <input value={editForm.allowed_views} onChange={(e) => setEditForm((p) => ({ ...p, allowed_views: e.target.value }))}
                          className="flex-1 px-2 py-1 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-accent" />
                        <button onClick={handleSaveEdit} className="text-green-600 hover:text-green-700"><Check size={14} /></button>
                        <button onClick={() => setEditId(null)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 font-medium text-gray-800">{user.name}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                      <div className="flex items-center gap-1">
                        {showPwd[user.id] ? user.password : '••••••'}
                        <button onClick={() => setShowPwd((p) => ({ ...p, [user.id]: !p[user.id] }))} className="text-gray-300 hover:text-gray-500">
                          {showPwd[user.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="bg-accent/10 text-accent-dark text-xs px-2 py-0.5 rounded-lg">{user.role}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 max-w-[180px] truncate">{user.allowed_views}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setEditId(user.id); setEditForm({ name: user.name, password: user.password, role: user.role, allowed_views: user.allowed_views }) }}
                          className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center">
                          <Edit2 size={12} />
                        </button>
                        <button onClick={() => handleDelete(user.id)}
                          className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Menu Tab ─────────────────────────────────────────────────────────────────

const SECTORS_LIST = ['Fritadeira', 'Lanches', 'Outros']
const CATEGORIES_LIST = ['Salgados', 'Lanches', 'Outros', 'Bebidas']

function MenuTab({ addToast }: { addToast: (msg: string, type?: 'error' | 'success' | 'info') => void }) {
  const [items, setItems] = useState<MenuItem[]>([])
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', price: 0, sector: 'Fritadeira', category: 'Salgados', code: '' })
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', price: 0, sector: '', category: '', code: '' })
  const [codeInputs, setCodeInputs] = useState<Record<string, string>>({})

  useEffect(() => {
    const unsub = subscribeMenuItems((fetched) => {
      setItems(fetched)
      setCodeInputs((prev) => {
        const next: Record<string, string> = {}
        for (const item of fetched) {
          next[item.id] = item.id in prev ? prev[item.id] : (item.code ?? '')
        }
        return next
      })
    })
    return unsub
  }, [])

  const saveCode = async (id: string) => {
    const code = (codeInputs[id] ?? '').trim()
    try {
      await updateMenuItem(id, { code })
      addToast('Código salvo!', 'success')
    } catch { addToast('Erro ao salvar código') }
  }

  const handleAdd = async () => {
    if (!form.name.trim()) { addToast('Preencha o nome'); return }
    try {
      await addMenuItem(form)
      setForm({ name: '', price: 0, sector: 'Fritadeira', category: 'Salgados', code: '' })
      setAdding(false)
      addToast('Item adicionado!', 'success')
    } catch { addToast('Erro ao adicionar') }
  }

  const handleSaveEdit = async () => {
    if (!editId) return
    try {
      await updateMenuItem(editId, editForm)
      setEditId(null)
      addToast('Item atualizado!', 'success')
    } catch { addToast('Erro ao atualizar') }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteMenuItem(id)
      addToast('Item removido', 'success')
    } catch { addToast('Erro ao remover') }
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 bg-accent hover:bg-accent-dark text-white px-4 py-2 rounded-2xl text-sm font-medium transition-colors"
        >
          <Plus size={14} /> Novo item
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
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-3">
              <input type="text" placeholder="Nome do item" value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-accent text-sm col-span-2 sm:col-span-1" />
              <input type="number" step="0.01" placeholder="Preço R$" value={form.price}
                onChange={(e) => setForm((p) => ({ ...p, price: Number(e.target.value) }))}
                className="px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-accent text-sm" />
              <select value={form.sector} onChange={(e) => setForm((p) => ({ ...p, sector: e.target.value }))}
                className="px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-accent text-sm bg-white">
                {SECTORS_LIST.map((s) => <option key={s}>{s}</option>)}
              </select>
              <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                className="px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-accent text-sm bg-white">
                {CATEGORIES_LIST.map((c) => <option key={c}>{c}</option>)}
              </select>
              <input type="text" placeholder="ex: 0844" value={form.code} maxLength={4}
                onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                className="px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-accent text-sm font-mono" />
            </div>
            <p className="text-xs text-gray-400 mb-3">O código de 4 dígitos identifica o produto pelo QR Code do cupom físico.</p>
            <div className="flex gap-2">
              <button onClick={handleAdd} className="flex items-center gap-1.5 bg-accent text-white px-4 py-2 rounded-xl text-sm">
                <Check size={14} /> Salvar
              </button>
              <button onClick={() => setAdding(false)} className="flex items-center gap-1.5 bg-gray-100 text-gray-600 px-4 py-2 rounded-xl text-sm">
                <X size={14} /> Cancelar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Nome</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Preço</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Setor</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Categoria</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Cupom</th>
              <th className="text-right px-4 py-3 text-gray-500 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-gray-100">
                {editId === item.id ? (
                  <>
                    <td className="px-4 py-2">
                      <input value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                        className="w-full px-2 py-1 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-accent" />
                    </td>
                    <td className="px-4 py-2">
                      <input type="number" step="0.01" value={editForm.price} onChange={(e) => setEditForm((p) => ({ ...p, price: Number(e.target.value) }))}
                        className="w-20 px-2 py-1 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-accent" />
                    </td>
                    <td className="px-4 py-2">
                      <select value={editForm.sector} onChange={(e) => setEditForm((p) => ({ ...p, sector: e.target.value }))}
                        className="px-2 py-1 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:border-accent">
                        {SECTORS_LIST.map((s) => <option key={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <select value={editForm.category} onChange={(e) => setEditForm((p) => ({ ...p, category: e.target.value }))}
                        className="px-2 py-1 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:border-accent">
                        {CATEGORIES_LIST.map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={4}
                        value={codeInputs[item.id] ?? ''}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 4)
                          setCodeInputs((p) => ({ ...p, [item.id]: val }))
                        }}
                        onBlur={() => saveCode(item.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur() } }}
                        placeholder="0844"
                        className="w-20 px-2 py-1.5 rounded-lg border-2 border-accent/40 focus:border-accent focus:outline-none text-sm font-mono text-center font-bold tracking-widest"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        <button onClick={handleSaveEdit} className="text-green-600 hover:text-green-700"><Check size={14} /></button>
                        <button onClick={() => setEditId(null)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 font-medium text-gray-800">{item.name}</td>
                    <td className="px-4 py-3 text-gray-600">R$ {item.price.toFixed(2)}</td>
                    <td className="px-4 py-3"><span className="bg-accent/10 text-accent-dark text-xs px-2 py-0.5 rounded-lg">{item.sector}</span></td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{item.category}</td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={4}
                        value={codeInputs[item.id] ?? ''}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 4)
                          setCodeInputs((p) => ({ ...p, [item.id]: val }))
                        }}
                        onBlur={() => saveCode(item.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur() } }}
                        placeholder="0844"
                        className="w-20 px-2 py-1.5 rounded-lg border-2 border-gray-200 focus:border-accent focus:outline-none text-sm font-mono text-center font-bold tracking-widest"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setEditId(item.id); setEditForm({ name: item.name, price: item.price, sector: item.sector, category: item.category, code: item.code ?? '' }) }}
                          className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center">
                          <Edit2 size={12} />
                        </button>
                        <button onClick={() => handleDelete(item.id)}
                          className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
