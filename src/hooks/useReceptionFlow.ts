import { useState, useEffect, useRef, useCallback } from 'react'
import { subscribeMenuItems, createOrder, resolveFicha, setActiveSession, clearActiveSession, getActiveOrderByTicket, setOrderStatus, deleteOrder } from '../services/firebaseService'
import { useApp } from '../App'
import { useScanner } from './useScanner'
import { displayTicket, isCupomCode } from '../utils/ticket'
import type { MenuItem } from '../types'

export interface SessionItem {
  name: string
  quantity: number
  sector: string
  price: number
  completed: boolean
}

export interface Session {
  ficha: string
  items: SessionItem[]
}

export interface SentOrder {
  ficha: string
  items: SessionItem[]
  sentAt: Date
}

function playOrderSentSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const notes = [784, 988, 1175, 988, 1175]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = freq; osc.type = 'triangle'
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.1)
      gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + i * 0.1 + 0.04)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.2)
      osc.start(ctx.currentTime + i * 0.1)
      osc.stop(ctx.currentTime + i * 0.1 + 0.2)
    })
  } catch { /* audio not available */ }
}

function playProductAddSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.frequency.value = 880; osc.type = 'sine'
    gain.gain.setValueAtTime(0.2, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.15)
  } catch { /* audio not available */ }
}

function playCancelSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const notes = [440, 330]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = freq; osc.type = 'square'
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.15)
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + i * 0.15 + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.18)
      osc.start(ctx.currentTime + i * 0.15)
      osc.stop(ctx.currentTime + i * 0.15 + 0.18)
    })
  } catch { /* audio not available */ }
}

const COUNTDOWN_SECONDS = 45
const CANCEL_SCAN_COUNT = 3
const CANCEL_SCAN_WINDOW_MS = 5000

// Lógica de bipagem de fichas/cupons e montagem do pedido, compartilhada entre
// a tela de Recepção e o Painel Interno (cada um com seu próprio bipador).
export function useReceptionFlow() {
  const { addToast } = useApp()
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [session, setSession] = useState<Session | null>(null)
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS)
  const [lastScan, setLastScan] = useState<{ type: 'ficha' | 'product' | 'error'; label: string } | null>(null)
  const [sending, setSending] = useState(false)
  const [lastSent, setLastSent] = useState<string | null>(null)
  const [sentHistory, setSentHistory] = useState<SentOrder[]>([])

  const sessionRef = useRef<Session | null>(null)
  const menuItemsRef = useRef<MenuItem[]>([])
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const scanTicketRef = useRef<string | null>(null)
  const scanCountRef = useRef(0)
  const scanTimeRef = useRef(0)

  useEffect(() => {
    sessionRef.current = session
    if (session) {
      setActiveSession({ ficha: session.ficha, items: session.items.map(i => ({ name: i.name, quantity: i.quantity, sector: i.sector })) })
    } else {
      clearActiveSession()
    }
  }, [session])
  useEffect(() => { menuItemsRef.current = menuItems }, [menuItems])

  useEffect(() => {
    const unsub = subscribeMenuItems(setMenuItems)
    return unsub
  }, [])

  const submitSession = useCallback(async (sessionData?: Session) => {
    const s = sessionData ?? sessionRef.current
    if (!s || s.items.length === 0) {
      if (s && s.items.length === 0) {
        setSession(null)
        sessionRef.current = null
      }
      return
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
      countdownIntervalRef.current = null
    }
    setSending(true)
    try {
      await createOrder(s.ficha, s.items)
      playOrderSentSound()
      setLastSent(s.ficha)
      setSentHistory(prev => [{ ficha: s.ficha, items: s.items, sentAt: new Date() }, ...prev].slice(0, 20))
      setSession(null)
      sessionRef.current = null
      setCountdown(COUNTDOWN_SECONDS)
      setLastScan(null)
    } catch (err) {
      console.error('createOrder error:', err)
      addToast('Erro ao enviar pedido para a cozinha')
    } finally {
      setSending(false)
    }
  }, [addToast])

  const handleManualSend = useCallback(async (ficha: string, items: SessionItem[]) => {
    try {
      await createOrder(ficha, items)
      playOrderSentSound()
      setLastSent(ficha)
      setSentHistory(prev => [{ ficha, items, sentAt: new Date() }, ...prev].slice(0, 20))
    } catch (err) {
      console.error('manual createOrder error:', err)
      addToast('Erro ao enviar pedido manual')
    }
  }, [addToast])

  const startCountdown = useCallback(() => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
    setCountdown(COUNTDOWN_SECONDS)
    let remaining = COUNTDOWN_SECONDS
    countdownIntervalRef.current = setInterval(() => {
      remaining--
      setCountdown(remaining)
      if (remaining <= 0) {
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
        submitSession()
      }
    }, 1000)
  }, [submitSession])

  // QR do cupom físico: "0844-124791" → 4 primeiros dígitos = código do produto
  // Fichas: número puro 1–999 (String(n) sem zeros à esquerda, sem traços)
  const processQrScan = useCallback(async (raw: string) => {
    const items = menuItemsRef.current
    const rawTrimmed = raw.trim()
    const digits = rawTrimmed.replace(/\D/g, '')
    const first4 = digits.substring(0, 4)

    if (digits.length >= 4) {
      const matchedProduct = items.find(m => m.code && first4 === m.code)

      if (matchedProduct) {
        if (!sessionRef.current) {
          setLastScan({ type: 'error', label: 'Bipe a ficha primeiro!' })
          return
        }
        playProductAddSound()
        setLastScan({ type: 'product', label: `+1 ${matchedProduct.name}` })
        setSession(prev => {
          if (!prev) return prev
          const existing = prev.items.find(i => i.name === matchedProduct.name)
          const updated: Session = existing
            ? { ...prev, items: prev.items.map(i => i.name === matchedProduct.name ? { ...i, quantity: i.quantity + 1 } : i) }
            : { ...prev, items: [...prev.items, { name: matchedProduct.name, quantity: 1, sector: matchedProduct.sector, price: matchedProduct.price, completed: false }] }
          sessionRef.current = updated
          return updated
        })
        startCountdown()
        return
      }

      if (/^0[89]/.test(first4)) {
        setLastScan({ type: 'error', label: `Código ${first4} não cadastrado — vá em Configurações → Cardápio` })
        return
      }
    }

    if (isCupomCode(rawTrimmed)) {
      setLastScan({ type: 'error', label: 'Código de produto não cadastrado — vá em Configurações → Cardápio' })
      return
    }

    try {
      const ticket = await resolveFicha(raw)
      if (!ticket) {
        setLastScan({ type: 'error', label: 'Leitura não reconhecida — bipe novamente' })
        return
      }

      // Conta bipadas seguidas na mesma ficha para detectar erro de leitura
      const now = Date.now()
      if (scanTicketRef.current === ticket && now - scanTimeRef.current < CANCEL_SCAN_WINDOW_MS) {
        scanCountRef.current += 1
      } else {
        scanTicketRef.current = ticket
        scanCountRef.current = 1
      }
      scanTimeRef.current = now

      const current = sessionRef.current
      const existing = await getActiveOrderByTicket(ticket)

      // 3 bipadas seguidas na mesma ficha (em até 5s) = pedido entrou errado, cancelar
      if (scanCountRef.current >= CANCEL_SCAN_COUNT) {
        scanCountRef.current = 0
        scanTicketRef.current = null
        const hadOpenSession = current?.ficha === ticket
        if (existing) await deleteOrder(existing.id)
        if (hadOpenSession) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current)
            countdownIntervalRef.current = null
          }
          setSession(null)
          sessionRef.current = null
        }
        if (existing || hadOpenSession) {
          playCancelSound()
          setLastScan({ type: 'error', label: `Pedido da ficha #${displayTicket(ticket)} cancelado! Ficha liberada.` })
          return
        }
        // Nada para cancelar (3ª bipada de uma ficha nova) — segue o fluxo normal abaixo
      }

      if (existing?.status === 'ready') {
        await setOrderStatus(existing.id, 'delivered')
        setLastScan({ type: 'ficha', label: `Ficha #${displayTicket(ticket)} entregue!` })
        return
      }

      if (!current) {
        if (existing) {
          setLastScan({ type: 'error', label: `Ficha #${displayTicket(ticket)} já está na cozinha (em preparo)` })
          return
        }
        const newSession: Session = { ficha: ticket, items: [] }
        setSession(newSession)
        sessionRef.current = newSession
        setLastScan({ type: 'ficha', label: `Ficha #${displayTicket(ticket)} aberta` })
        startCountdown()
      } else if (current.ficha !== ticket) {
        if (existing) {
          setLastScan({ type: 'error', label: `Ficha #${displayTicket(ticket)} já está na cozinha (em preparo)` })
          return
        }
        await submitSession(current)
        const newSession: Session = { ficha: ticket, items: [] }
        setSession(newSession)
        sessionRef.current = newSession
        setLastScan({ type: 'ficha', label: `Ficha #${displayTicket(ticket)} aberta` })
        startCountdown()
      } else {
        setLastScan({ type: 'ficha', label: `Ficha #${displayTicket(ticket)} (continuando)` })
        startCountdown()
      }
    } catch {
      addToast('Erro ao processar QR Code')
    }
  }, [startCountdown, submitSession, addToast])

  useScanner(processQrScan)

  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
    }
  }, [])

  return {
    menuItems, session, countdown, lastScan, sending, lastSent, setLastSent, sentHistory,
    submitSession, handleManualSend,
  }
}

export const RECEPTION_COUNTDOWN_SECONDS = COUNTDOWN_SECONDS
