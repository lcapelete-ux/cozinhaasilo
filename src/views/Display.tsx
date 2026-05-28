import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChefHat, UtensilsCrossed } from 'lucide-react'
import { subscribeOrders, setOrderStatus, resolveFicha, subscribeMediaSlides } from '../services/firebaseService'
import { useQrScanner } from '../hooks/useQrScanner'
import type { Order, MediaSlide } from '../types'

export const DISPLAY_ZOOM_KEY = 'display-zoom'
export const DISPLAY_SCANNER_HIDDEN_KEY = 'display-scanner-hidden'

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

// ── Slideshow ────────────────────────────────────────────────────────────────
function extractYoutubeId(url: string): string {
  const m = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/)
  return m ? m[1] : ''
}

function SlideshowPlayer({ slides, onCycleComplete }: { slides: MediaSlide[]; onCycleComplete: () => void }) {
  const [idx, setIdx] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const current = slides[idx]

  useEffect(() => { setIdx(0) }, [slides.length])

  const advance = useCallback(() => {
    setIdx((i) => {
      const next = i + 1
      if (next >= slides.length) {
        onCycleComplete()
        return 0
      }
      return next
    })
  }, [slides.length, onCycleComplete])

  useEffect(() => {
    if (!current || current.type !== 'image') return
    const ms = Math.max(2000, (current.duration || 8) * 1000)
    timerRef.current = setTimeout(advance, ms)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [idx, current, advance])

  if (!current) return null

  const ytId = current.type === 'youtube' ? extractYoutubeId(current.url) : ''

  return (
    <div className="absolute inset-0 bg-black overflow-hidden flex flex-col">
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="absolute inset-0"
        >
          {current.type === 'image' && (
            <img src={current.url} alt={current.title} className="w-full h-full object-cover" />
          )}
          {current.type === 'video' && (
            <video
              key={current.url}
              src={current.url}
              autoPlay muted playsInline
              className="w-full h-full object-cover"
              onEnded={advance}
            />
          )}
          {current.type === 'youtube' && ytId && (
            <iframe
              src={`https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${ytId}&modestbranding=1`}
              className="w-full h-full border-0"
              allow="autoplay; fullscreen"
              title={current.title}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Title overlay */}
      {current.title && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent pt-12 pb-5 px-6 z-10">
          <p className="text-white font-bold text-xl drop-shadow">{current.title}</p>
        </div>
      )}

      {/* Progress dots */}
      {slides.length > 1 && (
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-10">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
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
  const [zoom, setZoom] = useState<number>(readZoom)
  const readScannerHidden = () => localStorage.getItem(DISPLAY_SCANNER_HIDDEN_KEY) === 'true'
  const [scannerHidden, setScannerHidden] = useState<boolean>(readScannerHidden)

  useEffect(() => {
    const onStorage = () => {
      setZoom(readZoom())
      setScannerHidden(readScannerHidden())
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener('display-zoom-change', onStorage)
    window.addEventListener('display-scanner-hidden-change', onStorage)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('display-zoom-change', onStorage)
      window.removeEventListener('display-scanner-hidden-change', onStorage)
    }
  }, [])

  const [slides, setSlides] = useState<MediaSlide[]>([])

  useEffect(() => {
    const unsub = subscribeMediaSlides(setSlides)
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

  const confirmDelivery = useCallback(async (raw: string) => {
    const ticket = await resolveFicha(raw)
    const order =
      readyOrdersRef.current.find((o) => o.ticket_number === ticket) ??
      activeOrdersRef.current.find((o) => o.ticket_number === ticket)
    if (!order) {
      // Show debug info so operator knows the scan was received but ticket not found
      setScanDebug(`Lido: "${raw}" → ficha "${ticket}" não encontrada`)
      if (scanDebugTimer.current) clearTimeout(scanDebugTimer.current)
      scanDebugTimer.current = setTimeout(() => setScanDebug(null), 5000)
      return
    }
    setScanDebug(null)
    await setOrderStatus(order.id, 'delivered')
  }, [])

  // minLength:1 so single-digit ticket numbers (ficha #1, #2…) are not silently dropped
  useQrScanner({ onScan: confirmDelivery, minLength: 1 })

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
  // Cycle: slideshow (8s per image) → orders panel (60s) → slideshow → …
  // Interrupted immediately if a new order arrives during slideshow
  const ORDERS_PANEL_MS = 60_000

  const [displayMode, setDisplayMode] = useState<'orders' | 'slideshow'>('orders')
  const displayModeRef = useRef<'orders' | 'slideshow'>('orders')
  const ordersTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevOrderTotalRef = useRef(activeOrders.length + readyOrders.length)
  const enabledSlidesRef = useRef(enabledSlides)
  useEffect(() => { enabledSlidesRef.current = enabledSlides }, [enabledSlides])

  const setMode = useCallback((m: 'orders' | 'slideshow') => {
    displayModeRef.current = m
    setDisplayMode(m)
  }, [])

  // Start first slideshow as soon as slides load
  const slideshowStartedRef = useRef(false)
  useEffect(() => {
    if (!slideshowStartedRef.current && enabledSlides.length > 0) {
      slideshowStartedRef.current = true
      setMode('slideshow')
    }
  }, [enabledSlides.length, setMode])

  // Called by SlideshowPlayer when all slides have been shown once
  const handleSlideshowComplete = useCallback(() => {
    setMode('orders')
    if (ordersTimerRef.current) clearTimeout(ordersTimerRef.current)
    ordersTimerRef.current = setTimeout(() => {
      if (enabledSlidesRef.current.length > 0) setMode('slideshow')
    }, ORDERS_PANEL_MS)
  }, [setMode])

  // New order arrives during slideshow → interrupt immediately, schedule return
  useEffect(() => {
    const total = activeOrders.length + readyOrders.length
    if (displayModeRef.current === 'slideshow' && total > prevOrderTotalRef.current) {
      setMode('orders')
      if (ordersTimerRef.current) clearTimeout(ordersTimerRef.current)
      ordersTimerRef.current = setTimeout(() => {
        if (enabledSlidesRef.current.length > 0) setMode('slideshow')
      }, ORDERS_PANEL_MS)
    }
    prevOrderTotalRef.current = total
  }, [activeOrders.length, readyOrders.length, setMode])

  // Cleanup timer on unmount
  useEffect(() => () => { if (ordersTimerRef.current) clearTimeout(ordersTimerRef.current) }, [])

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#111111', zoom }}>
      {/* Bunting */}
      <Bunting />

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4" style={{ background: '#1a1a1a' }}>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl"
            style={{ background: 'linear-gradient(135deg, #FF6B00, #FF2200)' }}>
            🔥
          </div>
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
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
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
                      <FireAnimated size={56} />
                      <div className="text-center">
                        <p className="text-white/40 text-sm uppercase tracking-widest">Ficha</p>
                        <p className="font-black text-5xl text-white leading-none mt-1">#{order.ticket_number}</p>
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
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
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
                          style={{ color: '#FFD700', fontSize: 'clamp(3rem, 8vw, 6rem)' }}
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
        {/* Slideshow overlay — timed rotation */}
        <AnimatePresence>
          {displayMode === 'slideshow' && enabledSlides.length > 0 && (
            <motion.div
              className="absolute inset-0 z-10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
            >
              <SlideshowPlayer slides={enabledSlides} onCycleComplete={handleSlideshowComplete} />
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
  )
}
