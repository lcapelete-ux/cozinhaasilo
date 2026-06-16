import { useState, useEffect, useRef, useCallback, type RefObject } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChefHat, UtensilsCrossed } from 'lucide-react'
import { subscribeOrders, setOrderStatus, resolveFicha, subscribeMediaSlides, createOrder, getActiveOrderByTicket, subscribeMenuItems, setActiveSession, clearActiveSession, subscribeBrandingConfig } from '../services/firebaseService'
import { useQrScanner } from '../hooks/useQrScanner'
import type { Order, MediaSlide, MenuItem } from '../types'

export const DISPLAY_ZOOM_KEY = 'display-zoom'
export const DISPLAY_SCANNER_HIDDEN_KEY = 'display-scanner-hidden'
export const DISPLAY_CARD_SIZE_KEY = 'display-card-size'
export const DISPLAY_ORIENTATION_KEY = 'display-orientation'

const JUNINA_PHRASES = [
  'Eita! O trem tá pronto, sô!',
  'Vem buscar que tá quentinho!',
  'Olha a cobra! É mentira, é o seu pedido!',
  'Uai, seu pedido já saiu do fogo!',
  'Pula a fogueira e vem buscar!',
  'Tá mais pronto que milho em dia de festa!',
  'Aperta o passo que a comida tá na mesa!',
  'Santo Antônio ajudou e seu pedido chegou!',
  'Anarriê! Seu pedido tá no balcão!',
  'Êta trem bão, seu pedido tá pronto!',
  'Corre que o quentão tá esperando!',
  'Segura o chapéu, seu pedido chegou!',
  'Mais rápido que foguete de São João!',
  'O sanfoneiro parou pra ver seu pedido!',
  'Tá cheirando melhor que canjica!',
  'Vem pro arraiá, seu pedido tá na mão!',
  'Simbora buscar que a festa não para!',
  'Olha o balão! E olha o seu pedido!',
  'Ficou pronto no capricho, sô!',
  'Alegria, alegria! Seu pedido tá aqui!',
]

interface ReadyNotif { ticket: string; phrase: string }

// ── Bunting flags ────────────────────────────────────────────────────────────
const FLAG_COLORS = ['#FFD700', '#FF4444', '#44BB44', '#4488FF', '#FF8800', '#CC44CC', '#FFD700', '#FF4444', '#44BB44', '#4488FF', '#FF8800', '#CC44CC', '#FFD700', '#FF4444', '#44BB44', '#4488FF', '#FF8800']

function Bunting() {
  return (
    <div className="relative w-full overflow-hidden" style={{ height: 36 }}>
      <svg width="100%" height="36" preserveAspectRatio="none">
        {/* String */}
        <path d="M0,8 Q50,4 100,8 Q150,12 200,8 Q250,4 300,8 Q350,12 400,8 Q450,4 500,8 Q550,12 600,8 Q650,4 700,8 Q750,12 800,8 Q850,4 900,8 Q950,12 1000,8 Q1100,4 1200,8 Q1300,12 1400,8" stroke="#888" strokeWidth="1.5" fill="none" />
        {FLAG_COLORS.map((color, i) => {
          const x = (i / (FLAG_COLORS.length - 1)) * 1400
          return (
            <polygon
              key={i}
              points={`${x - 10},4 ${x + 10},4 ${x},28`}
              fill={color}
              opacity={0.95}
            />
          )
        })}
      </svg>
    </div>
  )
}

// ── Animated fire ────────────────────────────────────────────────────────────
function FireAnimated({ size = 48 }: { size?: number }) {
  return (
    <motion.div
      style={{ fontSize: size, lineHeight: 1, display: 'inline-block', originY: 1 }}
      animate={{
        scaleY: [1, 1.08, 0.95, 1.06, 1],
        scaleX: [1, 0.96, 1.04, 0.97, 1],
        rotate: [-2, 2, -1, 3, -2],
      }}
      transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
    >
      🔥
    </motion.div>
  )
}

// ── Clock ────────────────────────────────────────────────────────────────────
function Clock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  const h = String(time.getHours()).padStart(2, '0')
  const m = String(time.getMinutes()).padStart(2, '0')
  return (
    <span className="font-black text-4xl md:text-5xl tabular-nums" style={{ color: '#FF8800' }}>
      {h}<motion.span animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1, repeat: Infinity }}>:</motion.span>{m}
    </span>
  )
}

// ── Sound ────────────────────────────────────────────────────────────────────
function playChime() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const notes = [523, 659, 784, 1047]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = freq; osc.type = 'sine'
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.15)
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + i * 0.15 + 0.05)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.4)
      osc.start(ctx.currentTime + i * 0.15)
      osc.stop(ctx.currentTime + i * 0.15 + 0.4)
    })
  } catch { /* audio not available */ }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function dedup(orders: Order[]): Order[] {
  const seen = new Set<string>()
  return orders.filter((o) => {
    if (seen.has(o.ticket_number)) return false
    seen.add(o.ticket_number)
    return true
  })
}

// ── Chroma-key canvas ─────────────────────────────────────────────────────────
// Toca um vídeo (fundo verde) num <video> oculto e re-renderiza cada quadro
// num <canvas>, zerando o alpha dos pixels verdes em tempo real.
function useChromaKey(
  videoRef: RefObject<HTMLVideoElement>,
  canvasRef: RefObject<HTMLCanvasElement>,
  src: string,
) {
  useEffect(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    let rafId = 0

    const tick = () => {
      if (video.readyState >= 2 && video.videoWidth > 0) {
        if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth
        if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight
        ctx.drawImage(video, 0, 0)
        const frame = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const d = frame.data
        for (let i = 0; i < d.length; i += 4) {
          const g = d[i + 1]
          const excess = g - Math.max(d[i], d[i + 2]) // quanto verde "sobra" sobre R e B
          if (excess > 35) d[i + 3] = Math.max(0, 255 - excess * 5)
        }
        ctx.putImageData(frame, 0, 0)
      }
      rafId = requestAnimationFrame(tick)
    }

    video.play().catch(() => {})
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [videoRef, canvasRef, src])
}

function ChromaKeyVideo({ src, height }: { src: string; height: number }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useChromaKey(videoRef, canvasRef, src)
  return (
    <>
      <video ref={videoRef} src={src} muted loop playsInline style={{ display: 'none' }} />
      <canvas ref={canvasRef} style={{ height, width: 'auto', display: 'block' }} />
    </>
  )
}

// ── Vilhinho ─────────────────────────────────────────────────────────────────
function VilhinhoWalker({ imgUrl, animated, type, chroma }: { imgUrl?: string; animated?: boolean; type?: 'image' | 'video'; chroma?: boolean }) {
  const SIZE = 200
  const isVideo = type === 'video'
  // Vídeo e GIF animado: personagem só caminha + leve balanço (a mídia faz a dança).
  // Imagem estática PNG: dança CSS completa (pulo + ginga + saltito).
  const passiveOnly = isVideo || animated
  const danceCss = passiveOnly
    ? `@keyframes vilhinho-dance {
         0%, 100% { transform: translateY(0px) rotate(-2deg); }
         50%       { transform: translateY(-6px) rotate(2deg); }
       }`
    : `@keyframes vilhinho-dance {
         0%, 100% { transform: translateY(0px)   rotate(-8deg) scaleY(1); }
         25%       { transform: translateY(-28px) rotate(0deg)  scaleY(1.05); }
         50%       { transform: translateY(0px)   rotate(8deg)  scaleY(1); }
         75%       { transform: translateY(-28px) rotate(0deg)  scaleY(1.05); }
       }`
  const danceDur = passiveOnly ? '1.4s' : '0.5s'

  return (
    <>
      <style>{`
        ${danceCss}
      `}</style>
      <div
        className="pointer-events-none"
        style={{ position: 'absolute', left: 16, bottom: 8, height: SIZE + 40, zIndex: 15 }}
      >
        <div style={{ position: 'absolute', left: 0, bottom: 0 }}>
          <div
            style={{
              animation: `vilhinho-dance ${danceDur} ease-in-out infinite`,
              transformOrigin: 'bottom center',
              filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.6))',
              userSelect: 'none',
            }}
          >
            {isVideo && imgUrl && chroma ? (
              <ChromaKeyVideo src={imgUrl} height={SIZE} />
            ) : isVideo && imgUrl ? (
              <video
                key={imgUrl}
                src={imgUrl}
                autoPlay muted loop playsInline
                style={{ height: SIZE, width: 'auto', display: 'block', objectFit: 'contain', background: 'transparent' }}
              />
            ) : imgUrl ? (
              <img
                src={imgUrl}
                alt="Vilhinho"
                draggable={false}
                style={{ height: SIZE, width: 'auto', display: 'block', objectFit: 'contain' }}
              />
            ) : (
              <span style={{ fontSize: 96, lineHeight: 1, display: 'block' }}>👴</span>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ── Slideshow ────────────────────────────────────────────────────────────────
function extractYoutubeId(url: string): string {
  const m = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/)
  return m ? m[1] : ''
}

// Mostra uma única mídia por vez — a troca de mídia é controlada pelo
// rodízio do Display (1 minuto por mídia, alternando com o painel de pedidos).
function MediaSlideView({ slide, idx, total }: { slide: MediaSlide; idx: number; total: number }) {
  const ytId = slide.type === 'youtube' ? extractYoutubeId(slide.url) : ''

  return (
    <div className="absolute inset-0 bg-black overflow-hidden flex flex-col">
      <AnimatePresence mode="wait">
        <motion.div
          key={slide.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="absolute inset-0"
        >
          {slide.type === 'image' && (
            <img src={slide.url} alt={slide.title} className="w-full h-full object-contain" />
          )}
          {slide.type === 'video' && (
            <video
              key={slide.url}
              src={slide.url}
              autoPlay muted loop playsInline
              className="w-full h-full object-contain"
            />
          )}
          {slide.type === 'youtube' && ytId && (
            <iframe
              src={`https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${ytId}&modestbranding=1`}
              className="w-full h-full border-0"
              allow="autoplay; fullscreen"
              title={slide.title}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Title overlay */}
      {slide.title && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent pt-12 pb-5 px-6 z-10">
          <p className="text-white font-bold text-xl drop-shadow">{slide.title}</p>
        </div>
      )}

      {/* Progress dots */}
      {total > 1 && (
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-10">
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className={`h-2 rounded-full transition-all ${i === idx ? 'bg-white w-6' : 'bg-white/40 w-2'}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}


// ── Main Display ─────────────────────────────────────────────────────────────
export default function Display() {
  const [activeOrders, setActiveOrders] = useState<Order[]>([])
  const [readyOrders, setReadyOrders] = useState<Order[]>([])
  const [readyNotif, setReadyNotif] = useState<ReadyNotif | null>(null)
  const [deliveryInput, setDeliveryInput] = useState('')

  const readZoom = () => {
    const saved = localStorage.getItem(DISPLAY_ZOOM_KEY)
    const val = saved ? parseFloat(saved) : 1
    return isNaN(val) ? 1 : val
  }
  const readCardSize = () => {
    const saved = localStorage.getItem(DISPLAY_CARD_SIZE_KEY)
    const val = saved ? parseFloat(saved) : 1
    return isNaN(val) ? 1 : val
  }
  const readOrientation = () =>
    localStorage.getItem(DISPLAY_ORIENTATION_KEY) === 'portrait' ? 'portrait' : 'landscape' as const
  const [zoom, setZoom] = useState<number>(readZoom)
  const [cardSize, setCardSize] = useState<number>(readCardSize)
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>(readOrientation)
  const readScannerHidden = () => localStorage.getItem(DISPLAY_SCANNER_HIDDEN_KEY) === 'true'
  const [scannerHidden, setScannerHidden] = useState<boolean>(readScannerHidden)

  useEffect(() => {
    const onStorage = () => {
      setZoom(readZoom())
      setScannerHidden(readScannerHidden())
      setCardSize(readCardSize())
      setOrientation(readOrientation())
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener('display-zoom-change', onStorage)
    window.addEventListener('display-scanner-hidden-change', onStorage)
    window.addEventListener('display-card-size-change', onStorage)
    window.addEventListener('display-orientation-change', onStorage)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('display-zoom-change', onStorage)
      window.removeEventListener('display-scanner-hidden-change', onStorage)
      window.removeEventListener('display-card-size-change', onStorage)
      window.removeEventListener('display-orientation-change', onStorage)
    }
  }, [])

  const [slides, setSlides] = useState<MediaSlide[]>([])

  useEffect(() => {
    const unsub = subscribeMediaSlides(setSlides)
    return unsub
  }, [])

  const [logoUrl, setLogoUrl] = useState('')
  const [vilhinhoEnabled, setVilhinhoEnabled] = useState(false)
  const [vilhinhoUrl, setVilhinhoUrl] = useState('')
  const [vilhinhoAnimated, setVilhinhoAnimated] = useState(false)
  const [vilhinhoType, setVilhinhoType] = useState<'image' | 'video'>('image')
  const [vilhinhoChroma, setVilhinhoChroma] = useState(false)

  useEffect(() => {
    const unsub = subscribeBrandingConfig((cfg) => {
      setLogoUrl(cfg?.logo_url ?? '')
      setVilhinhoEnabled(cfg?.vilhinho_enabled ?? false)
      setVilhinhoUrl(cfg?.vilhinho_url ?? '')
      setVilhinhoAnimated(cfg?.vilhinho_animated ?? false)
      setVilhinhoType(cfg?.vilhinho_type ?? 'image')
      setVilhinhoChroma(cfg?.vilhinho_chroma ?? false)
    })
    return unsub
  }, [])

  const prevReadyRef = useRef<Set<string>>(new Set())
  const announcementTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const readyOrdersRef = useRef<Order[]>([])
  const activeOrdersRef = useRef<Order[]>([])
  const [scanDebug, setScanDebug] = useState<string | null>(null)
  const scanDebugTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const deliveryInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { readyOrdersRef.current = readyOrders }, [readyOrders])
  useEffect(() => { activeOrdersRef.current = activeOrders }, [activeOrders])

  // ── Background entry session (hidden from display UI) ─────────────────────
  const menuItemsRef = useRef<MenuItem[]>([])
  const bgFichaRef = useRef<string | null>(null)
  const bgItemsRef = useRef<Order['items']>([])
  const bgCountdownRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return subscribeMenuItems((items) => { menuItemsRef.current = items })
  }, [])

  const confirmBgSession = useCallback(async () => {
    const ficha = bgFichaRef.current
    const items = bgItemsRef.current
    bgFichaRef.current = null
    bgItemsRef.current = []
    await clearActiveSession()
    if (!ficha || items.length === 0) return
    try {
      await createOrder(ficha, items)
    } catch (e) {
      console.error('Display bg-entry failed:', e)
    }
  }, [])

  const restartBgCountdown = useCallback(() => {
    if (bgCountdownRef.current) clearTimeout(bgCountdownRef.current)
    bgCountdownRef.current = setTimeout(confirmBgSession, 45000)
  }, [confirmBgSession])

  const processDisplayScan = useCallback(async (raw: string) => {
    const digits = raw.trim().replace(/\D/g, '')
    const first4 = digits.substring(0, 4)

    // Product code (4+ digits matching a menu item)
    if (digits.length >= 4) {
      const matched = menuItemsRef.current.find((m) => m.code && first4 === m.code)
      if (matched) {
        if (!bgFichaRef.current) return // need ficha first
        const existing = bgItemsRef.current.find((i) => i.name === matched.name)
        if (existing) {
          existing.quantity += 1
        } else {
          bgItemsRef.current.push({ name: matched.name, quantity: 1, sector: matched.sector, price: matched.price, completed: false })
        }
        setActiveSession({ ficha: bgFichaRef.current, items: bgItemsRef.current.map((i) => ({ name: i.name, quantity: i.quantity, sector: i.sector })) })
        restartBgCountdown()
        return
      }
      if (/^0[89]/.test(first4)) return // unknown standard code
    }

    // Ficha scan
    const ticket = await resolveFicha(raw)
    if (!ticket) return

    // Ready order → deliver
    const readyOrder = readyOrdersRef.current.find((o) => o.ticket_number === ticket)
    if (readyOrder) {
      setScanDebug(null)
      await setOrderStatus(readyOrder.id, 'delivered')
      return
    }

    // Existing pending/preparing order → ignore
    const activeOrder = await getActiveOrderByTicket(ticket)
    if (activeOrder) return

    // New ficha → flush previous session and start a new one
    if (bgCountdownRef.current) clearTimeout(bgCountdownRef.current)
    await confirmBgSession()
    bgFichaRef.current = ticket
    bgItemsRef.current = []
    setActiveSession({ ficha: ticket, items: [] })
    restartBgCountdown()
  }, [confirmBgSession, restartBgCountdown])

  const confirmDelivery = useCallback(async (raw: string) => {
    const ticket = await resolveFicha(raw)
    const order =
      readyOrdersRef.current.find((o) => o.ticket_number === ticket) ??
      activeOrdersRef.current.find((o) => o.ticket_number === ticket)
    if (!order) {
      setScanDebug(`Lido: "${raw}" → ficha "${ticket}" não encontrada`)
      if (scanDebugTimer.current) clearTimeout(scanDebugTimer.current)
      scanDebugTimer.current = setTimeout(() => setScanDebug(null), 5000)
      return
    }
    setScanDebug(null)
    await setOrderStatus(order.id, 'delivered')
  }, [])

  // minLength:1 so single-digit ticket numbers (ficha #1, #2…) are not silently dropped
  useQrScanner({ onScan: processDisplayScan, minLength: 1 })

  useEffect(() => {
    const unsub1 = subscribeOrders(['pending', 'preparing'], (orders) => setActiveOrders(dedup(orders)))
    return unsub1
  }, [])

  useEffect(() => {
    const unsub2 = subscribeOrders(['ready'], (orders) => {
      const unique = dedup(orders)
      unique.forEach((o) => {
        if (!prevReadyRef.current.has(o.ticket_number)) {
          const phrase = JUNINA_PHRASES[Math.floor(Math.random() * JUNINA_PHRASES.length)]
          setReadyNotif({ ticket: o.ticket_number, phrase })
          if (announcementTimer.current) clearTimeout(announcementTimer.current)
          announcementTimer.current = setTimeout(() => setReadyNotif(null), 6000)
        }
      })
      prevReadyRef.current = new Set(unique.map((o) => o.ticket_number))
      setReadyOrders(unique)
    })
    return () => {
      unsub2()
      if (announcementTimer.current) clearTimeout(announcementTimer.current)
    }
  }, [])

  const enabledSlides = slides.filter((s) => s.enabled)

  // ── Display mode rotation ─────────────────────────────────────────────────
  // Painel de pedidos por 1 min, depois UMA mídia por vez pelo tempo
  // configurado nela (slide.duration), alternando: pedidos → mídia 1 →
  // pedidos → mídia 2 → pedidos → … Interrompido imediatamente se um novo
  // pedido chegar durante a mídia.
  const ORDERS_MS = 60_000

  const [displayMode, setDisplayMode] = useState<'orders' | 'slideshow'>('orders')
  const displayModeRef = useRef<'orders' | 'slideshow'>('orders')
  const [mediaIdx, setMediaIdx] = useState(0)
  const prevOrderTotalRef = useRef(activeOrders.length + readyOrders.length)
  const enabledSlidesRef = useRef(enabledSlides)
  useEffect(() => { enabledSlidesRef.current = enabledSlides })

  const setMode = useCallback((m: 'orders' | 'slideshow') => {
    displayModeRef.current = m
    setDisplayMode(m)
  }, [])

  // Agenda a próxima troca: 1 min para o painel de pedidos, ou o tempo
  // configurado na mídia atual (slide.duration, em segundos) para a mídia.
  useEffect(() => {
    const slides = enabledSlidesRef.current
    const slide = displayMode === 'slideshow' && slides.length > 0 ? slides[mediaIdx % slides.length] : null
    const ms = slide ? Math.max(2, slide.duration) * 1000 : ORDERS_MS

    const t = setTimeout(() => {
      if (displayModeRef.current === 'orders') {
        if (enabledSlidesRef.current.length > 0) setMode('slideshow')
      } else {
        const len = enabledSlidesRef.current.length
        setMediaIdx((i) => (len > 0 ? (i + 1) % len : 0))
        setMode('orders')
      }
    }, ms)
    return () => clearTimeout(t)
  }, [displayMode, mediaIdx, enabledSlides.length, setMode])

  // New order arrives during slideshow → interrompe imediatamente, volta ao painel
  useEffect(() => {
    const total = activeOrders.length + readyOrders.length
    if (displayModeRef.current === 'slideshow' && total > prevOrderTotalRef.current) {
      const len = enabledSlidesRef.current.length
      setMediaIdx((i) => (len > 0 ? (i + 1) % len : 0))
      setMode('orders')
    }
    prevOrderTotalRef.current = total
  }, [activeOrders.length, readyOrders.length, setMode])

  return (
    <div style={orientation === 'portrait' ? { position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', overflow: 'hidden' } : {}}>
    <div
      className="flex flex-col"
      style={{
        background: '#111111',
        ...(orientation === 'portrait'
          ? { width: '100vh', height: '100vw', transform: 'rotate(90deg)', overflow: 'hidden', flexShrink: 0 }
          : { minHeight: '100vh', zoom }),
      }}
    >
      {/* Bunting */}
      <Bunting />

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4" style={{ background: '#1a1a1a' }}>
        <div className="flex items-center gap-4">
          {logoUrl ? (
            <div className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center bg-black/20">
              <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl"
              style={{ background: 'linear-gradient(135deg, #FF6B00, #FF2200)' }}>
              🔥
            </div>
          )}
          <div>
            <h1 className="font-black text-3xl md:text-4xl uppercase italic tracking-wide"
              style={{ color: '#FFD700', textShadow: '0 0 20px rgba(255,200,0,0.5)' }}>
              Arraiá do Lar São Cristóvão
            </h1>
            <p className="text-sm font-semibold tracking-widest mt-0.5" style={{ color: '#FF8800' }}>
              ✦ Festa de São João 2026
            </p>
          </div>
        </div>
        <Clock />
      </div>

      {/* Festive ready overlay */}
      <AnimatePresence>
        {readyNotif && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] flex items-center justify-center"
            style={{ backdropFilter: 'blur(12px)', backgroundColor: 'rgba(0,0,0,0.78)' }}
            onClick={() => setReadyNotif(null)}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0, y: 48 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 24 }}
              transition={{ type: 'spring', stiffness: 280, damping: 22 }}
              className="w-[min(90vw,560px)] rounded-3xl p-10 flex flex-col items-center text-center"
              style={{
                background: '#1a1a1a',
                boxShadow: '0 0 0 2.5px #FF8800, 0 0 80px rgba(255,136,0,0.25)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <motion.div
                animate={{ rotate: [-18, 18, -12, 12, -6, 6, 0] }}
                transition={{ duration: 0.9, repeat: Infinity, repeatDelay: 1.2 }}
                className="text-6xl mb-5 select-none"
              >
                🔔
              </motion.div>

              <p
                className="font-black uppercase italic mb-7 leading-tight px-2"
                style={{ color: '#FFD700', fontSize: 'clamp(1.1rem, 4vw, 1.6rem)' }}
              >
                {readyNotif.phrase}
              </p>

              <motion.p
                className="font-black leading-none mb-8"
                style={{ fontSize: 'clamp(6rem, 28vw, 11rem)', color: '#FFFFFF', lineHeight: 0.9 }}
                animate={{ scale: [1, 1.04, 1] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
              >
                {readyNotif.ticket}
              </motion.p>

              <div
                className="px-8 py-3 rounded-full font-black uppercase tracking-widest"
                style={{ background: '#FFD700', color: '#111', fontSize: '0.8rem' }}
              >
                Favor retirar no balcão
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main panels */}
      <div className="flex flex-1 divide-x divide-white/10 relative">
        {/* LEFT — Em produção */}
        <div className="flex-1 flex flex-col" style={{ background: '#161616' }}>
          {/* Panel header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
            <div className="flex items-center gap-3">
              <motion.div
                animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="w-4 h-4 rounded-full bg-orange-500"
              />
              <h2 className="font-black text-2xl uppercase italic tracking-wide text-orange-400">
                Esquentando o Fuzuê
              </h2>
            </div>
            <ChefHat size={28} className="text-white/30" />
          </div>

          {/* Orders list */}
          <div className="flex-1 p-5 overflow-auto">
            {activeOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 opacity-30">
                <ChefHat size={64} className="text-white" strokeWidth={1} />
                <p className="text-white/60 text-xl italic">Cozinha livre no momento</p>
              </div>
            ) : (
              <div className={"grid grid-cols-2 sm:grid-cols-3 gap-4"}>
                <AnimatePresence>
                  {activeOrders.map((order) => (
                    <motion.div
                      key={order.id}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      className="rounded-3xl p-5 flex flex-col items-center gap-3"
                      style={{ background: '#222' }}
                    >
                      <FireAnimated size={Math.round(36 * cardSize)} />
                      <div className="text-center">
                        <p className="text-white/40 text-sm uppercase tracking-widest">Ficha</p>
                        <p className="font-black text-white leading-none mt-1" style={{ fontSize: `${2.5 * cardSize}rem` }}>#{order.ticket_number}</p>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — Pronto */}
        <div className="flex-1 flex flex-col" style={{ background: '#1a1a1a' }}>
          {/* Panel header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
            <div className="flex items-center gap-3">
              <motion.div
                animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
                transition={{ duration: 0.6, repeat: Infinity }}
                className="w-4 h-4 rounded-full bg-yellow-400"
              />
              <h2 className="font-black text-2xl uppercase italic tracking-wide text-white">
                Tá no Ponto, Sô!
              </h2>
            </div>
            <span className="font-black text-sm px-4 py-1.5 rounded-full uppercase tracking-wider"
              style={{ background: '#FFD700', color: '#111' }}>
              Balcão
            </span>
          </div>

          {/* Ready list */}
          <div className="flex-1 p-5 overflow-auto">
            {readyOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 opacity-30">
                <UtensilsCrossed size={64} className="text-white" strokeWidth={1} />
                <p className="text-white/60 text-xl italic uppercase tracking-widest">O Arraiá tá começando...</p>
              </div>
            ) : (
              <div className={"grid grid-cols-2 sm:grid-cols-3 gap-4"}>
                <AnimatePresence>
                  {readyOrders.map((order) => (
                    <motion.div
                      key={order.id}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      className="rounded-3xl p-5 flex flex-col items-center gap-3 border"
                      style={{ background: '#222', borderColor: '#FFD70040' }}
                    >
                      <div className="text-center">
                        <p className="text-yellow-400/60 text-sm uppercase tracking-widest mb-1">Ficha</p>
                        <motion.p
                          className="font-black leading-none"
                          style={{ color: '#FFD700', fontSize: `${3 * cardSize}rem` }}
                          animate={{ scale: [1, 1.08, 1], textShadow: ['0 0 0px #FFD700', '0 0 32px #FFD700', '0 0 0px #FFD700'] }}
                          transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
                        >
                          #{order.ticket_number}
                        </motion.p>
                      </div>
                      <span className="text-base font-black px-4 py-1 rounded-full uppercase"
                        style={{ background: '#FFD700', color: '#111' }}>
                        Pronto!
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
        {/* Media overlay — 1 mídia por minuto, alternando com o painel */}
        <AnimatePresence>
          {displayMode === 'slideshow' && enabledSlides.length > 0 && (
            <motion.div
              className="absolute inset-0 z-10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
            >
              <MediaSlideView
                slide={enabledSlides[mediaIdx % enabledSlides.length]}
                idx={mediaIdx % enabledSlides.length}
                total={enabledSlides.length}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Vilhinho dançando */}
        <AnimatePresence>
          {vilhinhoEnabled && (
            <motion.div key="vilhinho" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 pointer-events-none z-20">
              <VilhinhoWalker imgUrl={vilhinhoUrl} animated={vilhinhoAnimated} type={vilhinhoType} chroma={vilhinhoChroma} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Debug banner: shows when scan received but ticket not matched */}
      <AnimatePresence>
        {scanDebug && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
            style={{ background: '#7c3aed' }}
          >
            <p className="text-center py-3 font-bold text-sm text-white uppercase tracking-wide">
              🔍 {scanDebug}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer: delivery confirmation (hidden when scanner-hidden mode is on) */}
      {!scannerHidden ? (
        <form
          onSubmit={(e) => { e.preventDefault(); if (deliveryInput.trim()) { confirmDelivery(deliveryInput.trim()); setDeliveryInput('') } }}
          className="flex items-center justify-end gap-2 px-4 py-2"
          style={{ background: '#0d0d0d' }}
        >
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#555' }}>Confirmar entrega:</span>
          <input
            ref={deliveryInputRef}
            type="text"
            inputMode="numeric"
            placeholder="Nº ficha"
            value={deliveryInput}
            onChange={(e) => setDeliveryInput(e.target.value)}
            className="w-28 px-3 py-2 rounded-xl text-base font-bold text-center focus:outline-none"
            style={{ background: '#222', color: '#FFD700', border: '1px solid #333' }}
          />
          <button type="submit"
            className="px-4 py-2 rounded-xl text-sm font-bold uppercase transition-colors"
            style={{ background: '#333', color: '#FFD700' }}>
            OK
          </button>
        </form>
      ) : (
        <div style={{ background: '#0d0d0d', height: 4 }} />
      )}
    </div>
    </div>
  )
}
