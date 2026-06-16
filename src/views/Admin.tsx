import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Settings, Users, UtensilsCrossed, Ticket, Printer, Plus, Trash2, Edit2, Check, X, Eye, EyeOff, DatabaseZap, AlertTriangle, ZoomIn, ZoomOut, Monitor, Tv2, CloudUpload, ExternalLink, ArrowUp, ArrowDown, Smartphone, ShoppingBag, ChefHat, Scan, LayoutGrid, Package, Clock, Boxes, QrCode, BarChart3, Film, Image, Upload, type LucideIcon } from 'lucide-react'
import { DISPLAY_ZOOM_KEY, DISPLAY_SCANNER_HIDDEN_KEY, DISPLAY_CARD_SIZE_KEY, DISPLAY_ORIENTATION_KEY } from './Display'
import { QRCodeSVG } from 'qrcode.react'
import {
  subscribeUsers, addUser, updateUser, deleteUser,
  subscribeMenuItems, addMenuItem, updateMenuItem, deleteMenuItem,
  clearAllOrders, subscribeAllOrders,
  clearAllStockEntries, subscribeStockEntries,
  subscribeStorageConfig, setStorageConfig, type SupabaseStorageConfig,
  subscribeBrandingConfig, setBrandingConfig, uploadMediaFile,
} from '../services/firebaseService'
import { useApp } from '../App'
import type { User, MenuItem } from '../types'

type Tab = 'users' | 'menu' | 'fichas' | 'dados'

const ALL_VIEWS = 'reception,kitchen,kitchen-scanner,kitchen-sectors,display,dispatch,history,inventory,extra-fichas,admin-dashboard,media-slides,admin'

const VIEW_META: { view: string; label: string; icon: LucideIcon }[] = [
  { view: 'reception',       label: 'Recepção',  icon: ShoppingBag },
  { view: 'kitchen',         label: 'Cozinha',   icon: ChefHat },
  { view: 'kitchen-scanner', label: 'Bip',       icon: Scan },
  { view: 'kitchen-sectors', label: 'Setores',   icon: LayoutGrid },
  { view: 'display',         label: 'Painel',    icon: Tv2 },
  { view: 'dispatch',        label: 'Entrega',   icon: Package },
  { view: 'history',         label: 'Histórico', icon: Clock },
  { view: 'inventory',       label: 'Estoque',   icon: Boxes },
  { view: 'extra-fichas',    label: 'QR Extra',  icon: QrCode },
  { view: 'admin-dashboard', label: 'Dashboard', icon: BarChart3 },
  { view: 'media-slides',    label: 'Mídia',     icon: Film },
  { view: 'admin',           label: 'Config',    icon: Settings },
]

function ViewsToggle({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const active = new Set(value.split(',').map((v) => v.trim()).filter(Boolean))
  const toggle = (view: string) => {
    const next = new Set(active)
    if (next.has(view)) next.delete(view)
    else next.add(view)
    onChange(VIEW_META.filter((m) => next.has(m.view)).map((m) => m.view).join(','))
  }
  return (
    <div className="flex flex-wrap gap-2">
      {VIEW_META.map(({ view, label, icon: Icon }) => {
        const on = active.has(view)
        return (
          <button
            key={view}
            type="button"
            title={label}
            onClick={() => toggle(view)}
            className={`flex flex-col items-center justify-center gap-1 w-14 h-14 rounded-xl border-2 transition-colors ${
              on ? 'bg-accent border-accent text-white' : 'bg-gray-50 border-gray-200 text-gray-400 hover:border-accent/50 hover:text-accent/70'
            }`}
          >
            <Icon size={18} />
            <span className="text-[9px] leading-none font-semibold">{label}</span>
          </button>
        )
      })}
    </div>
  )
}

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
          <title>Fichas</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; background: white; }
            .grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; padding: 12px; }
            .ficha {
              border: 1px solid #ddd;
              border-radius: 8px;
              padding: 10px 6px;
              text-align: center;
              page-break-inside: avoid;
              background: white;
            }
            .ficha-number { font-size: 26px; font-weight: 900; color: #111; line-height: 1; margin-bottom: 8px; }
            .ficha-qr { display: flex; justify-content: center; }
            .ficha-qr svg { width: 80px !important; height: 80px !important; }
            @media print {
              body { margin: 0; }
              .grid { padding: 8px; gap: 4px; }
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
                  <div class="ficha-number">#${n}</div>
                  <div class="ficha-qr">${svgHtml}</div>
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
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-3">
            {numbers.slice(0, 12).map((n) => (
              <div
                key={n}
                className="border border-gray-200 rounded-xl p-3 text-center bg-white"
              >
                <p className="font-black text-xl text-gray-900 mb-2">#{n}</p>
                <div className="flex justify-center">
                  <QRCodeSVG value={String(n)} size={64} />
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

function OrientationToggle() {
  const [portrait, setPortrait] = useState(() => localStorage.getItem(DISPLAY_ORIENTATION_KEY) === 'portrait')

  const toggle = () => {
    const next = !portrait
    setPortrait(next)
    localStorage.setItem(DISPLAY_ORIENTATION_KEY, next ? 'portrait' : 'landscape')
    window.dispatchEvent(new Event('display-orientation-change'))
  }

  return (
    <div className="flex items-center gap-4 py-3 border-t border-gray-100">
      <div className="flex items-center gap-2 flex-1">
        <Smartphone size={16} className="text-gray-400" />
        <div>
          <p className="text-sm font-medium text-gray-700">Orientação vertical (portrait)</p>
          <p className="text-xs text-gray-400">Para TV na vertical. Empilha os painéis em vez de colocá-los lado a lado.</p>
        </div>
      </div>
      <button
        onClick={toggle}
        className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${portrait ? 'bg-accent' : 'bg-gray-200'}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${portrait ? 'translate-x-6' : 'translate-x-0.5'}`} />
      </button>
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
        <p>4. Copie a <strong>Project URL</strong> e a <strong>Publishable key</strong> (ou anon key) em <strong>Settings → API</strong></p>
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
          <label className="text-xs text-gray-500 block mb-1">Publishable Key (ou anon key)</label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              placeholder="sb_publishable_… ou eyJhbGci…"
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

function VilhinhoToggle({ addToast }: { addToast: (msg: string, type?: 'error' | 'success' | 'info') => void }) {
  const [enabled, setEnabled] = useState(false)
  const [vilhinhoUrl, setVilhinhoUrl] = useState('')
  const [storageCfg, setStorageCfg] = useState<SupabaseStorageConfig | null>(null)
  const [uploadPct, setUploadPct] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => subscribeBrandingConfig((cfg) => {
    setEnabled(cfg?.vilhinho_enabled ?? false)
    setVilhinhoUrl(cfg?.vilhinho_url ?? '')
  }), [])
  useEffect(() => subscribeStorageConfig((cfg) => setStorageCfg(cfg)), [])

  const toggle = async () => {
    setSaving(true)
    try {
      const next = !enabled
      await setBrandingConfig({ vilhinho_enabled: next })
      setEnabled(next)
      addToast(next ? 'Vilhinho ativado! 🎉' : 'Vilhinho desativado', 'success')
    } catch {
      addToast('Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) { addToast('Selecione uma imagem (de preferência PNG com fundo transparente)'); return }
    if (!storageCfg?.url || !storageCfg?.anon_key) {
      addToast('Configure o Supabase Storage abaixo antes de subir a imagem')
      return
    }
    setUploadPct(0)
    try {
      const url = await uploadMediaFile(file, storageCfg, setUploadPct)
      await setBrandingConfig({ vilhinho_url: url })
      addToast('Imagem do vilhinho atualizada!', 'success')
      setUploadPct(null)
    } catch (err) {
      console.error(err)
      const detail = err instanceof Error ? err.message : ''
      addToast(`Erro no upload${detail ? ` — ${detail}` : ''}`)
      setUploadPct(null)
    }
  }

  const handleRemoveImage = async () => {
    try {
      await setBrandingConfig({ vilhinho_url: '' })
      addToast('Imagem removida — voltou para o 👴 padrão', 'success')
    } catch { addToast('Erro ao remover imagem') }
  }

  const uploading = uploadPct !== null

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 overflow-hidden flex items-center justify-center text-3xl shrink-0 select-none">
          {vilhinhoUrl ? <img src={vilhinhoUrl} alt="Vilhinho" className="w-full h-full object-contain" /> : '👴'}
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-gray-800">Vilhinho dançando no painel</h3>
          <p className="text-sm text-gray-400 mt-0.5">Animação do vilhinho caminhando e dançando na parte de baixo do painel externo.</p>
        </div>
        <button
          onClick={toggle}
          disabled={saving}
          title={enabled ? 'Desativar vilhinho' : 'Ativar vilhinho'}
          className={`relative w-12 h-6 rounded-full transition-colors shrink-0 disabled:opacity-50 ${enabled ? 'bg-accent' : 'bg-gray-200'}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />
      <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 bg-accent hover:bg-accent-dark text-white px-4 py-2 rounded-xl text-sm disabled:opacity-50"
        >
          <Upload size={14} />
          {uploading ? `Enviando… ${Math.round(uploadPct ?? 0)}%` : vilhinhoUrl ? 'Trocar imagem' : 'Subir imagem do vilhinho'}
        </button>
        {vilhinhoUrl && !uploading && (
          <button
            onClick={handleRemoveImage}
            className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-xl text-sm"
          >
            <X size={14} /> Usar 👴 padrão
          </button>
        )}
        <p className="text-xs text-gray-400 w-full sm:w-auto sm:ml-2">PNG com fundo transparente fica melhor na animação.</p>
      </div>
    </div>
  )
}

function LogoSection({ addToast }: { addToast: (msg: string, type?: 'error' | 'success' | 'info') => void }) {
  const [logoUrl, setLogoUrl] = useState('')
  const [storageCfg, setStorageCfg] = useState<SupabaseStorageConfig | null>(null)
  const [uploadPct, setUploadPct] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => subscribeBrandingConfig((cfg) => setLogoUrl(cfg?.logo_url ?? '')), [])
  useEffect(() => subscribeStorageConfig((cfg) => setStorageCfg(cfg)), [])

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) { addToast('Selecione uma imagem'); return }
    if (!storageCfg?.url || !storageCfg?.anon_key) {
      addToast('Configure o Supabase Storage abaixo antes de subir o logo')
      return
    }
    setUploadPct(0)
    try {
      const url = await uploadMediaFile(file, storageCfg, setUploadPct)
      await setBrandingConfig({ logo_url: url })
      addToast('Logo atualizado!', 'success')
      setUploadPct(null)
    } catch (err) {
      console.error(err)
      const detail = err instanceof Error ? err.message : ''
      addToast(`Erro no upload${detail ? ` — ${detail}` : ''}`)
      setUploadPct(null)
    }
  }

  const handleRemove = async () => {
    setSaving(true)
    try {
      await setBrandingConfig({ logo_url: '' })
      addToast('Logo removido — voltou para o 🔥 padrão', 'success')
    } catch { addToast('Erro ao remover logo') }
    finally { setSaving(false) }
  }

  const uploading = uploadPct !== null

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-1">
        <Image size={18} className="text-accent" />
        <h3 className="font-bold text-gray-800">Logo do Painel Externo</h3>
      </div>
      <p className="text-sm text-gray-400 mb-4">
        Substitui o 🔥 no canto do painel externo. Se nenhum logo for enviado, o 🔥 continua sendo usado.
      </p>

      <div className="flex items-center gap-5">
        {/* Preview */}
        <div className="w-20 h-20 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center"
          style={{ background: logoUrl ? '#1a1a1a' : 'linear-gradient(135deg, #FF6B00, #FF2200)' }}>
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
          ) : (
            <span className="text-4xl">🔥</span>
          )}
        </div>

        <div className="flex-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 bg-accent hover:bg-accent-dark text-white px-4 py-2 rounded-xl text-sm disabled:opacity-50"
            >
              <Upload size={14} />
              {uploading ? `Enviando… ${Math.round(uploadPct ?? 0)}%` : logoUrl ? 'Trocar logo' : 'Subir logo'}
            </button>
            {logoUrl && !uploading && (
              <button
                onClick={handleRemove}
                disabled={saving}
                className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-xl text-sm disabled:opacity-50"
              >
                <X size={14} /> Usar 🔥 padrão
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-2">PNG, JPG, SVG, WEBP — de preferência fundo transparente</p>
        </div>
      </div>
    </div>
  )
}

function DadosTab({ addToast }: { addToast: (msg: string, type?: 'error' | 'success' | 'info') => void }) {
  const [orderCount, setOrderCount] = useState<number | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)

  const [stockEntryCount, setStockEntryCount] = useState<number | null>(null)
  const [confirmingStock, setConfirmingStock] = useState(false)
  const [loadingStock, setLoadingStock] = useState(false)

  useEffect(() => {
    const unsub = subscribeAllOrders((orders) => setOrderCount(orders.length))
    return unsub
  }, [])

  useEffect(() => {
    const unsub = subscribeStockEntries((entries) => setStockEntryCount(entries.length))
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

  const handleClearStock = async () => {
    setLoadingStock(true)
    try {
      const deleted = await clearAllStockEntries()
      addToast(`${deleted} registro${deleted !== 1 ? 's' : ''} de estoque removido${deleted !== 1 ? 's' : ''}.`, 'success')
      setConfirmingStock(false)
    } catch {
      addToast('Erro ao zerar histórico de estoque.', 'error')
    } finally {
      setLoadingStock(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Logo do painel externo */}
      <LogoSection addToast={addToast} />

      {/* Vilhinho */}
      <VilhinhoToggle addToast={addToast} />

      {/* Supabase Storage */}
      <SupabaseStorageSection addToast={addToast} />

      {/* Zoom dos monitores */}
      <div className="bg-white rounded-3xl p-6 shadow-sm">
        <h3 className="font-bold text-gray-800 mb-1">Zoom dos monitores</h3>
        <p className="text-sm text-gray-400 mb-4">Ajuste o tamanho da interface em cada TV. As alterações têm efeito imediato.</p>
        <ZoomRow label="Monitor de Produção (Setores)" icon={Monitor} storageKey={SECTORS_ZOOM_KEY} eventName="sectors-zoom-change" />
        <ZoomRow label="Painel Externo (Display)" icon={Tv2} storageKey={DISPLAY_ZOOM_KEY} eventName="display-zoom-change" />
        <ZoomRow label="Tamanho das fichas (Painel Externo)" icon={Ticket} storageKey={DISPLAY_CARD_SIZE_KEY} eventName="display-card-size-change" />
        <OrientationToggle />
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

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-red-100">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-2xl bg-red-50 flex items-center justify-center shrink-0 mt-0.5">
            <Trash2 size={18} className="text-red-500" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-gray-800 mb-1">Zerar histórico de estoque</h3>
            <p className="text-sm text-gray-500 mb-4">
              Remove permanentemente todos os lançamentos do relatório de estoque.
              Use ao final de cada evento para começar do zero na próxima edição.
              {stockEntryCount !== null && (
                <span className="ml-1 font-semibold text-gray-700">
                  Atualmente há <span className="text-red-600">{stockEntryCount}</span> registro{stockEntryCount !== 1 ? 's' : ''}.
                </span>
              )}
            </p>

            <AnimatePresence mode="wait">
              {!confirmingStock ? (
                <motion.button
                  key="btn-stock"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setConfirmingStock(true)}
                  className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-5 py-2.5 rounded-2xl text-sm font-bold transition-colors"
                >
                  <Trash2 size={15} />
                  Zerar histórico de estoque
                </motion.button>
              ) : (
                <motion.div
                  key="confirm-stock"
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
                      onClick={handleClearStock}
                      disabled={loadingStock}
                      className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
                    >
                      {loadingStock ? 'Zerando…' : 'Sim, zerar tudo'}
                    </button>
                    <button
                      onClick={() => setConfirmingStock(false)}
                      disabled={loadingStock}
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
  const [form, setForm] = useState({ name: '', password: '', role: 'staff', allowed_views: ALL_VIEWS })
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
      setForm({ name: '', password: '', role: 'staff', allowed_views: ALL_VIEWS })
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
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={() => { setAdding(true); setEditId(null) }}
          className="flex items-center gap-2 bg-accent hover:bg-accent-dark text-white px-4 py-2 rounded-2xl text-sm font-medium transition-colors"
        >
          <Plus size={14} /> Novo usuário
        </button>
      </div>

      {/* Add form */}
      <AnimatePresence>
        {adding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white rounded-3xl p-5 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-4">Novo usuário</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <input type="text" placeholder="Nome" value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className="px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-accent text-sm" />
                <input type="text" placeholder="Senha" value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  className="px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-accent text-sm" />
                <input type="text" placeholder="Função (admin, kitchen, staff…)" value={form.role}
                  onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
                  className="px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-accent text-sm" />
              </div>
              <p className="text-xs text-gray-500 font-medium mb-2">Telas com acesso</p>
              <ViewsToggle value={form.allowed_views} onChange={(v) => setForm((p) => ({ ...p, allowed_views: v }))} />
              <div className="flex gap-2 mt-4">
                <button onClick={handleAdd} className="flex items-center gap-1.5 bg-accent text-white px-4 py-2 rounded-xl text-sm">
                  <Check size={14} /> Salvar
                </button>
                <button onClick={() => setAdding(false)} className="flex items-center gap-1.5 bg-gray-100 text-gray-600 px-4 py-2 rounded-xl text-sm">
                  <X size={14} /> Cancelar
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* User cards */}
      {users.map((user) => {
        const activeViews = new Set(user.allowed_views.split(',').map((v) => v.trim()).filter(Boolean))
        return (
          <div key={user.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {/* Card header */}
            <div className="flex items-center gap-3 p-4">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                <Users size={18} className="text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800">{user.name}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="bg-accent/10 text-accent-dark text-xs px-2 py-0.5 rounded-lg">{user.role}</span>
                  <span className="text-gray-400 font-mono text-xs flex items-center gap-1">
                    {showPwd[user.id] ? user.password : '••••••'}
                    <button onClick={() => setShowPwd((p) => ({ ...p, [user.id]: !p[user.id] }))} className="text-gray-300 hover:text-gray-500">
                      {showPwd[user.id] ? <EyeOff size={11} /> : <Eye size={11} />}
                    </button>
                  </span>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => {
                    if (editId === user.id) { setEditId(null); return }
                    setAdding(false)
                    setEditId(user.id)
                    setEditForm({ name: user.name, password: user.password, role: user.role, allowed_views: user.allowed_views })
                  }}
                  className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${editId === user.id ? 'bg-accent/10 text-accent' : 'bg-gray-100 hover:bg-gray-200 text-gray-500'}`}
                >
                  <Edit2 size={13} />
                </button>
                <button onClick={() => handleDelete(user.id)}
                  className="w-8 h-8 rounded-xl bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {/* Views icons (read-only display) */}
            {editId !== user.id && (
              <div className="px-4 pb-4 flex flex-wrap gap-2">
                {VIEW_META.map(({ view, label, icon: Icon }) => (
                  <div
                    key={view}
                    className={`flex flex-col items-center justify-center gap-1 w-14 h-14 rounded-xl border-2 transition-colors ${
                      activeViews.has(view)
                        ? 'bg-accent border-accent text-white'
                        : 'bg-gray-50 border-gray-100 text-gray-200'
                    }`}
                  >
                    <Icon size={18} />
                    <span className="text-[9px] leading-none font-semibold">{label}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Edit panel */}
            <AnimatePresence>
              {editId === user.id && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 pt-1 border-t border-gray-100 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <input value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                        placeholder="Nome"
                        className="px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-accent text-sm" />
                      <input value={editForm.password} onChange={(e) => setEditForm((p) => ({ ...p, password: e.target.value }))}
                        placeholder="Senha"
                        className="px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-accent text-sm" />
                      <input value={editForm.role} onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value }))}
                        placeholder="Função"
                        className="px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-accent text-sm" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-medium mb-2">Telas com acesso</p>
                      <ViewsToggle value={editForm.allowed_views} onChange={(v) => setEditForm((p) => ({ ...p, allowed_views: v }))} />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleSaveEdit} className="flex items-center gap-1.5 bg-accent text-white px-4 py-2 rounded-xl text-sm">
                        <Check size={14} /> Salvar
                      </button>
                      <button onClick={() => setEditId(null)} className="flex items-center gap-1.5 bg-gray-100 text-gray-600 px-4 py-2 rounded-xl text-sm">
                        <X size={14} /> Cancelar
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}

// ── Menu Tab ─────────────────────────────────────────────────────────────────

const SECTORS_LIST = ['Fritadeira', 'Chapa', 'Assados']
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

  const handleMove = async (item: MenuItem, direction: 'up' | 'down') => {
    const idx = items.findIndex((i) => i.id === item.id)
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= items.length) return
    try {
      await Promise.all([
        updateMenuItem(item.id, { sort_order: targetIdx * 10 }),
        updateMenuItem(items[targetIdx].id, { sort_order: idx * 10 }),
      ])
    } catch { addToast('Erro ao reordenar') }
  }

  const handlePrintReport = () => {
    const sectors = [...new Set(items.map((i) => i.sector))]
    const date = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) return
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Cardápio por Setor</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; color: #111; background: #fff; padding: 28px; }
            h1 { font-size: 22px; font-weight: 900; margin-bottom: 4px; }
            .subtitle { font-size: 12px; color: #666; margin-bottom: 28px; }
            .sector { margin-bottom: 28px; page-break-inside: avoid; }
            .sector-title {
              font-size: 15px; font-weight: 700; text-transform: uppercase;
              letter-spacing: .05em; color: #fff; background: #d97706;
              padding: 6px 14px; border-radius: 8px; margin-bottom: 10px;
              display: inline-block;
            }
            table { width: 100%; border-collapse: collapse; font-size: 13px; }
            thead tr { background: #f5f5f5; }
            th { text-align: left; padding: 7px 10px; font-weight: 600; color: #555; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
            td { padding: 7px 10px; border-bottom: 1px solid #eee; }
            tr:last-child td { border-bottom: none; }
            .price { font-weight: 700; color: #16a34a; }
            .code { font-family: monospace; font-size: 12px; color: #888; }
            .category { background: #fef3c7; color: #92400e; font-size: 11px; padding: 2px 7px; border-radius: 20px; font-weight: 600; }
            @media print {
              body { padding: 16px; }
              .sector { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <h1>🌽 Cardápio por Setor</h1>
          <div class="subtitle">Gerado em ${date} · ${items.length} item${items.length !== 1 ? 's' : ''} · ${sectors.length} setor${sectors.length !== 1 ? 'es' : ''}</div>
          ${sectors.map((sector) => {
            const sectorItems = items.filter((i) => i.sector === sector)
            return `
              <div class="sector">
                <div class="sector-title">${sector}</div>
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Item</th>
                      <th>Categoria</th>
                      <th>Preço</th>
                      <th>Cód. QR</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${sectorItems.map((item, i) => `
                      <tr>
                        <td style="color:#aaa;font-size:11px">${i + 1}</td>
                        <td><strong>${item.name}</strong></td>
                        <td><span class="category">${item.category}</span></td>
                        <td class="price">R$ ${item.price.toFixed(2)}</td>
                        <td class="code">${item.code ? item.code : '—'}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            `
          }).join('')}
          <script>window.onload = () => { window.print(); }<\/script>
        </body>
      </html>
    `)
    win.document.close()
  }

  return (
    <div>
      <div className="flex justify-end gap-2 mb-3">
        <button
          onClick={handlePrintReport}
          disabled={items.length === 0}
          className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-2xl text-sm font-medium transition-colors disabled:opacity-40"
        >
          <Printer size={14} /> Relatório PDF
        </button>
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
              <th className="text-center px-2 py-3 text-gray-400 font-medium text-xs w-16">Ordem</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Nome</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Preço</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Setor</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Categoria</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Cupom</th>
              <th className="text-right px-4 py-3 text-gray-500 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={item.id} className="border-t border-gray-100">
                {editId === item.id ? (
                  <>
                    <td className="px-2 py-2 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <button onClick={() => handleMove(item, 'up')} disabled={idx === 0}
                          className="w-6 h-6 rounded-md bg-gray-50 hover:bg-gray-200 text-gray-400 hover:text-gray-700 disabled:opacity-20 flex items-center justify-center transition-colors">
                          <ArrowUp size={11} />
                        </button>
                        <button onClick={() => handleMove(item, 'down')} disabled={idx === items.length - 1}
                          className="w-6 h-6 rounded-md bg-gray-50 hover:bg-gray-200 text-gray-400 hover:text-gray-700 disabled:opacity-20 flex items-center justify-center transition-colors">
                          <ArrowDown size={11} />
                        </button>
                      </div>
                    </td>
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
                    <td className="px-2 py-3 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <button onClick={() => handleMove(item, 'up')} disabled={idx === 0}
                          className="w-6 h-6 rounded-md bg-gray-50 hover:bg-gray-200 text-gray-400 hover:text-gray-700 disabled:opacity-20 flex items-center justify-center transition-colors">
                          <ArrowUp size={11} />
                        </button>
                        <button onClick={() => handleMove(item, 'down')} disabled={idx === items.length - 1}
                          className="w-6 h-6 rounded-md bg-gray-50 hover:bg-gray-200 text-gray-400 hover:text-gray-700 disabled:opacity-20 flex items-center justify-center transition-colors">
                          <ArrowDown size={11} />
                        </button>
                      </div>
                    </td>
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
