import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Film, Plus, Trash2, Check, X, ToggleLeft, ToggleRight,
  ChevronUp, ChevronDown, Image, Video, Link, Upload, AlertCircle,
} from 'lucide-react'
import {
  subscribeMediaSlides, addMediaSlide, updateMediaSlide,
  deleteMediaSlide, uploadMediaFile, subscribeStorageConfig,
  type SupabaseStorageConfig,
} from '../services/firebaseService'
import { useApp } from '../App'
import type { MediaSlide } from '../types'

// ── helpers ──────────────────────────────────────────────────────────────────

function detectTypeFromUrl(url: string): MediaSlide['type'] {
  if (/\.(mp4|webm|ogg|mov|avi)(\?|$)/i.test(url)) return 'video'
  return 'image'
}

function detectTypeFromFile(file: File): MediaSlide['type'] {
  if (file.type.startsWith('video/')) return 'video'
  return 'image'
}

function fmtBytes(b: number): string {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

const ACCEPT_IMAGE = 'image/jpeg,image/png,image/gif,image/webp,image/avif'
const ACCEPT_VIDEO = 'video/mp4,video/webm,video/quicktime,video/x-msvideo'
const ACCEPT_ALL   = `${ACCEPT_IMAGE},${ACCEPT_VIDEO}`

// ── thumb ─────────────────────────────────────────────────────────────────────

function SlideThumb({ slide }: { slide: MediaSlide }) {
  if (slide.type === 'video') {
    return (
      <div className="w-full h-full flex items-center justify-center bg-blue-900/30">
        <Video size={22} className="text-blue-400" />
      </div>
    )
  }
  return (
    <img
      src={slide.url}
      alt=""
      className="w-full h-full object-cover"
      onError={(e) => {
        ;(e.target as HTMLImageElement).replaceWith(
          Object.assign(document.createElement('div'), {
            className: 'w-full h-full flex items-center justify-center bg-gray-100',
            innerHTML: '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>',
          })
        )
      }}
    />
  )
}

const TYPE_BADGE: Record<MediaSlide['type'], { icon: React.ReactNode; label: string; cls: string }> = {
  image: { icon: <Image size={10} />, label: 'Imagem',  cls: 'bg-green-100 text-green-700' },
  video: { icon: <Video size={10} />, label: 'Vídeo',   cls: 'bg-blue-100 text-blue-700' },
  youtube: { icon: <Film size={10} />, label: 'YouTube', cls: 'bg-red-100 text-red-700' },
}

// ── main component ────────────────────────────────────────────────────────────

type Mode = 'file' | 'link'

export default function MediaSlides() {
  const { addToast } = useApp()
  const [slides, setSlides] = useState<MediaSlide[]>([])
  const [storageCfg, setStorageCfg] = useState<SupabaseStorageConfig | null | undefined>(undefined)
  const [adding, setAdding] = useState(false)
  const [mode, setMode] = useState<Mode>('file')

  // file-upload state
  const [pickedFile, setPickedFile] = useState<File | null>(null)
  const [uploadPct, setUploadPct] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // link state
  const [linkUrl, setLinkUrl] = useState('')

  // shared
  const [title, setTitle] = useState('')
  const [duration, setDuration] = useState('10')

  useEffect(() => {
    const unsub = subscribeMediaSlides(setSlides)
    return unsub
  }, [])

  useEffect(() => {
    const unsub = subscribeStorageConfig((cfg) => setStorageCfg(cfg))
    return unsub
  }, [])

  const resetForm = () => {
    setPickedFile(null)
    setUploadPct(null)
    setLinkUrl('')
    setTitle('')
    setDuration('10')
    setAdding(false)
    setDragging(false)
  }

  // ── drag & drop ──

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) setPickedFile(file)
  }

  // ── save ──

  const handleSave = async () => {
    const dur = Math.max(2, parseInt(duration, 10) || 10)

    if (mode === 'file') {
      if (!pickedFile) { addToast('Selecione um arquivo'); return }
      if (!storageCfg?.url || !storageCfg?.anon_key) {
        addToast('Configure o Supabase em Config → Dados antes de subir arquivos')
        return
      }
      setUploadPct(0)
      try {
        const url = await uploadMediaFile(pickedFile, storageCfg, setUploadPct)
        const type = detectTypeFromFile(pickedFile)
        await addMediaSlide({ url, type, title: title.trim(), duration: dur, order: slides.length, enabled: true })
        addToast('Mídia enviada!', 'success')
        resetForm()
      } catch (err) {
        console.error(err)
        const detail = err instanceof Error ? err.message : ''
        addToast(`Erro no upload${detail ? ` — ${detail}` : ''} — verifique o bucket e as políticas do Supabase Storage em Config → Dados`)
        setUploadPct(null)
      }
      return
    }

    // link mode
    const url = linkUrl.trim()
    if (!url) { addToast('Informe a URL'); return }
    const type = detectTypeFromUrl(url)
    try {
      await addMediaSlide({ url, type, title: title.trim(), duration: dur, order: slides.length, enabled: true })
      addToast('Mídia adicionada!', 'success')
      resetForm()
    } catch { addToast('Erro ao salvar') }
  }

  const handleToggle = async (slide: MediaSlide) => {
    try { await updateMediaSlide(slide.id, { enabled: !slide.enabled }) }
    catch { addToast('Erro') }
  }

  const handleDelete = async (id: string) => {
    try { await deleteMediaSlide(id); addToast('Removido!', 'success') }
    catch { addToast('Erro ao remover') }
  }

  const handleMove = async (idx: number, dir: -1 | 1) => {
    const target = idx + dir
    if (target < 0 || target >= slides.length) return
    const a = slides[idx]; const b = slides[target]
    try {
      await updateMediaSlide(a.id, { order: b.order })
      await updateMediaSlide(b.id, { order: a.order })
    } catch { addToast('Erro ao reordenar') }
  }

  const uploading = uploadPct !== null && uploadPct < 100
  const detectedType = mode === 'file'
    ? (pickedFile ? detectTypeFromFile(pickedFile) : null)
    : (linkUrl.trim() ? detectTypeFromUrl(linkUrl.trim()) : null)

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <div>
          <h1 className="font-serif italic text-3xl text-accent-dark flex items-center gap-2">
            <Film className="text-accent" size={28} />
            Mídia do Painel
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Fotos e vídeos exibidos no painel externo enquanto não há pedidos
          </p>
        </div>
        <div className="flex-1" />
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 bg-accent hover:bg-accent-dark text-white px-4 py-2 rounded-2xl text-sm font-medium transition-colors"
        >
          <Plus size={16} /> Adicionar
        </button>
      </div>

      {/* Add form */}
      <AnimatePresence>
        {adding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-5"
          >
            <div className="bg-white rounded-3xl p-5 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-4">Nova mídia</h3>

              {/* Mode tabs */}
              <div className="flex gap-2 mb-4">
                {([['file', <Upload key="u" size={13} />, 'Subir arquivo'], ['link', <Link key="l" size={13} />, 'Link externo']] as const).map(([m, icon, label]) => (
                  <button
                    key={m}
                    onClick={() => setMode(m as Mode)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${mode === m ? 'bg-accent text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                  >
                    {icon} {label}
                  </button>
                ))}
              </div>

              {/* FILE MODE */}
              {mode === 'file' && (
                <div className="mb-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPT_ALL}
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) setPickedFile(f) }}
                  />
                  {!pickedFile ? (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={handleDrop}
                      className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${dragging ? 'border-accent bg-accent/5' : 'border-gray-200 hover:border-accent/50 hover:bg-gray-50'}`}
                    >
                      <Upload size={32} className="mx-auto mb-2 text-gray-300" />
                      <p className="text-sm font-medium text-gray-500">Clique ou arraste um arquivo aqui</p>
                      <p className="text-xs text-gray-400 mt-1">JPG, PNG, GIF, WEBP · MP4, WEBM, MOV</p>
                    </div>
                  ) : (
                    <div className="border border-gray-200 rounded-2xl p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                          {pickedFile.type.startsWith('video/') ? <Video size={20} className="text-blue-400" /> : <Image size={20} className="text-green-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{pickedFile.name}</p>
                          <p className="text-xs text-gray-400">{fmtBytes(pickedFile.size)}</p>
                        </div>
                        {!uploading && (
                          <button onClick={() => { setPickedFile(null); setUploadPct(null) }} className="text-gray-400 hover:text-red-500">
                            <X size={16} />
                          </button>
                        )}
                      </div>

                      {/* Upload progress */}
                      {uploadPct !== null && (
                        <div className="mt-3">
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <motion.div
                              className="h-full bg-accent rounded-full"
                              animate={{ width: `${uploadPct}%` }}
                              transition={{ duration: 0.2 }}
                            />
                          </div>
                          <p className="text-xs text-gray-400 mt-1 text-right">{Math.round(uploadPct)}%</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* LINK MODE */}
              {mode === 'link' && (
                <div className="mb-4">
                  <label className="text-xs text-gray-500 block mb-1">URL do arquivo (imagem ou vídeo)</label>
                  <input
                    type="text"
                    placeholder="https://exemplo.com/foto.jpg"
                    value={linkUrl}
                    autoFocus
                    onChange={(e) => setLinkUrl(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-accent text-sm"
                  />
                  {detectedType && (
                    <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                      Tipo detectado:
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium text-[10px] ${TYPE_BADGE[detectedType].cls}`}>
                        {TYPE_BADGE[detectedType].icon} {TYPE_BADGE[detectedType].label}
                      </span>
                    </p>
                  )}
                </div>
              )}

              {/* Shared fields */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Título (opcional)</label>
                  <input
                    type="text"
                    placeholder="Patrocinador, evento…"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-accent text-sm"
                  />
                </div>
                {detectedType !== 'video' && (
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Duração (segundos)</label>
                    <input
                      type="number" min={2} max={120}
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-accent text-sm"
                    />
                  </div>
                )}
              </div>

              {/* Cloudinary config status */}
              {mode === 'file' && (
                storageCfg?.url && storageCfg?.anon_key ? (
                  <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2 mb-4 text-xs text-green-700">
                    <Check size={13} className="shrink-0" />
                    <span>Supabase Storage configurado — bucket <strong>{storageCfg.bucket}</strong></span>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-4 text-xs text-amber-700">
                    <AlertCircle size={13} className="mt-0.5 shrink-0" />
                    <span>
                      Supabase não configurado. Acesse <strong>Config → Dados → Supabase Storage</strong> e
                      informe a URL do projeto e a anon key.
                    </span>
                  </div>
                )
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={uploading}
                  className="flex items-center gap-1.5 bg-accent text-white px-4 py-2 rounded-xl text-sm disabled:opacity-50"
                >
                  {uploading ? `Enviando… ${Math.round(uploadPct ?? 0)}%` : <><Check size={14} /> Salvar</>}
                </button>
                <button
                  onClick={resetForm}
                  disabled={uploading}
                  className="flex items-center gap-1.5 bg-gray-100 text-gray-600 px-4 py-2 rounded-xl text-sm disabled:opacity-50"
                >
                  <X size={14} /> Cancelar
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slides list */}
      {slides.length === 0 ? (
        <div className="bg-white rounded-3xl p-14 text-center shadow-sm">
          <Film size={48} className="mx-auto mb-3 text-gray-200" />
          <p className="text-gray-400">Nenhuma mídia cadastrada</p>
          <p className="text-gray-300 text-xs mt-1">
            Adicione fotos ou vídeos para exibir no painel externo enquanto o público espera
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {slides.map((slide, idx) => {
            const badge = TYPE_BADGE[slide.type]
            return (
              <motion.div
                key={slide.id}
                layout
                className={`bg-white rounded-2xl shadow-sm flex items-center gap-4 p-3 border transition-opacity ${slide.enabled ? 'border-gray-100' : 'border-gray-100 opacity-50'}`}
              >
                {/* Thumbnail */}
                <div className="w-20 h-14 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                  <SlideThumb slide={slide} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium text-[10px] ${badge.cls}`}>
                      {badge.icon} {badge.label}
                    </span>
                    {slide.type === 'image' && (
                      <span className="text-[10px] text-gray-400">{slide.duration}s</span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {slide.title || <span className="text-gray-400 font-normal italic">Sem título</span>}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{slide.url}</p>
                </div>

                {/* Reorder */}
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button onClick={() => handleMove(idx, -1)} disabled={idx === 0}
                    className="w-6 h-6 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-400 flex items-center justify-center disabled:opacity-20 transition-colors">
                    <ChevronUp size={12} />
                  </button>
                  <button onClick={() => handleMove(idx, 1)} disabled={idx === slides.length - 1}
                    className="w-6 h-6 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-400 flex items-center justify-center disabled:opacity-20 transition-colors">
                    <ChevronDown size={12} />
                  </button>
                </div>

                {/* Toggle */}
                <button onClick={() => handleToggle(slide)} className={`shrink-0 transition-colors ${slide.enabled ? 'text-accent' : 'text-gray-300'}`}>
                  {slide.enabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                </button>

                {/* Delete */}
                <button onClick={() => handleDelete(slide.id)}
                  className="w-8 h-8 rounded-xl bg-red-50 hover:bg-red-100 text-red-400 flex items-center justify-center shrink-0 transition-colors">
                  <Trash2 size={14} />
                </button>
              </motion.div>
            )
          })}
        </div>
      )}

      {slides.length > 0 && (
        <p className="text-center text-xs text-gray-300 mt-5">
          {slides.filter(s => s.enabled).length} de {slides.length} ativa(s) · exibidas em sequência quando não há pedidos
        </p>
      )}
    </div>
  )
}
