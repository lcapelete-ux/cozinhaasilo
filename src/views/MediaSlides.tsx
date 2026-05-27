import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Film, Plus, Trash2, Check, X, ToggleLeft, ToggleRight, ChevronUp, ChevronDown, Image, Youtube, Video } from 'lucide-react'
import { subscribeMediaSlides, addMediaSlide, updateMediaSlide, deleteMediaSlide } from '../services/firebaseService'
import { useApp } from '../App'
import type { MediaSlide } from '../types'

function detectType(url: string): MediaSlide['type'] {
  if (/youtube\.com|youtu\.be/.test(url)) return 'youtube'
  if (/\.(mp4|webm|ogg|mov)(\?|$)/i.test(url)) return 'video'
  return 'image'
}

function extractYoutubeId(url: string): string {
  const m = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/)
  return m ? m[1] : ''
}

function SlideThumb({ slide }: { slide: MediaSlide }) {
  if (slide.type === 'youtube') {
    const id = extractYoutubeId(slide.url)
    if (id) return <img src={`https://img.youtube.com/vi/${id}/mqdefault.jpg`} alt="" className="w-full h-full object-cover" />
    return <div className="w-full h-full flex items-center justify-center bg-red-900/30"><Youtube size={24} className="text-red-400" /></div>
  }
  if (slide.type === 'video') {
    return <div className="w-full h-full flex items-center justify-center bg-blue-900/30"><Video size={24} className="text-blue-400" /></div>
  }
  return (
    <img
      src={slide.url}
      alt=""
      className="w-full h-full object-cover"
      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
    />
  )
}

const TYPE_ICON: Record<MediaSlide['type'], React.ReactNode> = {
  image:   <Image size={11} />,
  video:   <Video size={11} />,
  youtube: <Youtube size={11} />,
}
const TYPE_LABEL: Record<MediaSlide['type'], string> = {
  image: 'Imagem', video: 'Vídeo', youtube: 'YouTube',
}
const TYPE_COLOR: Record<MediaSlide['type'], string> = {
  image: 'bg-green-100 text-green-700',
  video: 'bg-blue-100 text-blue-700',
  youtube: 'bg-red-100 text-red-700',
}

export default function MediaSlides() {
  const { addToast } = useApp()
  const [slides, setSlides] = useState<MediaSlide[]>([])
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ url: '', title: '', duration: '10' })

  useEffect(() => {
    const unsub = subscribeMediaSlides(setSlides)
    return unsub
  }, [])

  const handleAdd = async () => {
    const url = form.url.trim()
    if (!url) { addToast('Informe a URL da mídia'); return }
    const dur = parseInt(form.duration, 10)
    const type = detectType(url)
    try {
      await addMediaSlide({
        url,
        type,
        title: form.title.trim(),
        duration: isNaN(dur) || dur < 1 ? 10 : dur,
        order: slides.length,
        enabled: true,
      })
      setForm({ url: '', title: '', duration: '10' })
      setAdding(false)
      addToast('Mídia adicionada!', 'success')
    } catch { addToast('Erro ao adicionar') }
  }

  const handleToggle = async (slide: MediaSlide) => {
    try { await updateMediaSlide(slide.id, { enabled: !slide.enabled }) }
    catch { addToast('Erro ao atualizar') }
  }

  const handleDelete = async (id: string) => {
    try { await deleteMediaSlide(id); addToast('Removido!', 'success') }
    catch { addToast('Erro ao remover') }
  }

  const handleMove = async (idx: number, dir: -1 | 1) => {
    const target = idx + dir
    if (target < 0 || target >= slides.length) return
    const a = slides[idx]
    const b = slides[target]
    try {
      await updateMediaSlide(a.id, { order: b.order })
      await updateMediaSlide(b.id, { order: a.order })
    } catch { addToast('Erro ao reordenar') }
  }

  const autoDetectedType = form.url.trim() ? detectType(form.url.trim()) : null

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <div className="mb-6 flex items-center gap-4">
        <div>
          <h1 className="font-serif italic text-3xl text-accent-dark flex items-center gap-2">
            <Film className="text-accent" size={28} />
            Mídia do Painel
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Fotos, vídeos e YouTube exibidos no painel externo quando não há pedidos
          </p>
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
            className="overflow-hidden mb-5"
          >
            <div className="bg-white rounded-3xl p-5 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-4">Nova mídia</h3>
              <div className="space-y-3 mb-4">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">URL da mídia</label>
                  <input
                    type="text"
                    placeholder="https://... (imagem, vídeo mp4 ou YouTube)"
                    value={form.url}
                    autoFocus
                    onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-accent text-sm"
                  />
                  {autoDetectedType && (
                    <p className="text-xs text-gray-400 mt-1">
                      Tipo detectado: <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium text-[10px] ${TYPE_COLOR[autoDetectedType]}`}>
                        {TYPE_ICON[autoDetectedType]} {TYPE_LABEL[autoDetectedType]}
                      </span>
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Título (opcional)</label>
                    <input
                      type="text"
                      placeholder="Patrocinador, evento…"
                      value={form.title}
                      onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-accent text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Duração (seg) — imagens</label>
                    <input
                      type="number" min={2} max={120}
                      value={form.duration}
                      onChange={(e) => setForm((p) => ({ ...p, duration: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-accent text-sm"
                    />
                  </div>
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
                  onClick={() => { setAdding(false); setForm({ url: '', title: '', duration: '10' }) }}
                  className="flex items-center gap-1.5 bg-gray-100 text-gray-600 px-4 py-2 rounded-xl text-sm"
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
          {slides.map((slide, idx) => (
            <motion.div
              key={slide.id}
              layout
              className={`bg-white rounded-2xl shadow-sm flex items-center gap-4 p-3 border transition-colors ${slide.enabled ? 'border-gray-100' : 'border-gray-100 opacity-50'}`}
            >
              {/* Thumbnail */}
              <div className="w-20 h-14 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                <SlideThumb slide={slide} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium text-[10px] ${TYPE_COLOR[slide.type]}`}>
                    {TYPE_ICON[slide.type]} {TYPE_LABEL[slide.type]}
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

              {/* Order controls */}
              <div className="flex flex-col gap-0.5 shrink-0">
                <button
                  onClick={() => handleMove(idx, -1)} disabled={idx === 0}
                  className="w-6 h-6 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-400 flex items-center justify-center disabled:opacity-20 transition-colors"
                >
                  <ChevronUp size={12} />
                </button>
                <button
                  onClick={() => handleMove(idx, 1)} disabled={idx === slides.length - 1}
                  className="w-6 h-6 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-400 flex items-center justify-center disabled:opacity-20 transition-colors"
                >
                  <ChevronDown size={12} />
                </button>
              </div>

              {/* Toggle */}
              <button
                onClick={() => handleToggle(slide)}
                className={`shrink-0 transition-colors ${slide.enabled ? 'text-accent' : 'text-gray-300'}`}
                title={slide.enabled ? 'Desativar' : 'Ativar'}
              >
                {slide.enabled
                  ? <ToggleRight size={28} />
                  : <ToggleLeft size={28} />
                }
              </button>

              {/* Delete */}
              <button
                onClick={() => handleDelete(slide.id)}
                className="w-8 h-8 rounded-xl bg-red-50 hover:bg-red-100 text-red-400 flex items-center justify-center shrink-0 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {slides.length > 0 && (
        <p className="text-center text-xs text-gray-300 mt-5">
          {slides.filter(s => s.enabled).length} de {slides.length} ativa(s) · O painel exibe em sequência quando não há pedidos
        </p>
      )}
    </div>
  )
}
