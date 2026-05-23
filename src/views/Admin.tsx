import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Settings, Users, UtensilsCrossed, Ticket, Printer, Plus, Trash2, Edit2, Check, X, Eye, EyeOff } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import {
  subscribeUsers, addUser, updateUser, deleteUser,
  subscribeMenuItems, addMenuItem, updateMenuItem, deleteMenuItem,
} from '../services/firebaseService'
import { useApp } from '../App'
import type { User, MenuItem } from '../types'

type Tab = 'users' | 'menu' | 'fichas'

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
      <div className="flex gap-2 mb-6">
        {(['users', 'menu', 'fichas'] as Tab[]).map((t) => (
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
              {t === 'users' ? <Users size={15} /> : t === 'menu' ? <UtensilsCrossed size={15} /> : <Ticket size={15} />}
              {t === 'users' ? 'Usuários' : t === 'menu' ? 'Cardápio' : 'Fichas'}
            </span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === 'users' ? (
          <motion.div key="users" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <UsersTab addToast={addToast} />
          </motion.div>
        ) : (
          <motion.div key="menu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <MenuTab addToast={addToast} />
          </motion.div>
        )}
        {tab === 'fichas' && (
          <motion.div key="fichas" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <FichasTab />
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
  const [form, setForm] = useState({ name: '', price: 0, sector: 'Fritadeira', category: 'Salgados' })
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', price: 0, sector: '', category: '' })

  useEffect(() => {
    const unsub = subscribeMenuItems(setItems)
    return unsub
  }, [])

  const handleAdd = async () => {
    if (!form.name.trim()) { addToast('Preencha o nome'); return }
    try {
      await addMenuItem(form)
      setForm({ name: '', price: 0, sector: 'Fritadeira', category: 'Salgados' })
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
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
            </div>
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
                    <td className="px-4 py-2" colSpan={2}>
                      <div className="flex gap-2">
                        <select value={editForm.category} onChange={(e) => setEditForm((p) => ({ ...p, category: e.target.value }))}
                          className="px-2 py-1 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:border-accent">
                          {CATEGORIES_LIST.map((c) => <option key={c}>{c}</option>)}
                        </select>
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
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setEditId(item.id); setEditForm({ name: item.name, price: item.price, sector: item.sector, category: item.category }) }}
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
