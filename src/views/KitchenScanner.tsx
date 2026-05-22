import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Scan, CheckCircle, AlertCircle } from 'lucide-react'
import { getOrderByTicket, setOrderStatus, resolveFicha } from '../services/firebaseService'
import { useApp } from '../App'

type ScanResult = { type: 'success'; ticket: string } | { type: 'error'; message: string } | null

export default function KitchenScanner() {
  const { addToast } = useApp()
  const [result, setResult] = useState<ScanResult>(null)
  const [processing, setProcessing] = useState(false)

  const bufferRef = useRef('')
  const lastKeyTimeRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const processTicket = useCallback(async (raw: string) => {
    if (processing) return
    setProcessing(true)
    try {
      const ticket = await resolveFicha(raw)
      const order = await getOrderByTicket(ticket)
      if (!order) {
        setResult({ type: 'error', message: `Ficha #${ticket} não encontrada` })
        return
      }
      if (order.status === 'delivered') {
        setResult({ type: 'error', message: `Ficha #${ticket} já foi entregue` })
        return
      }
      if (order.status === 'ready') {
        setResult({ type: 'error', message: `Ficha #${ticket} já está pronta` })
        return
      }
      await setOrderStatus(order.id, 'ready')
      setResult({ type: 'success', ticket })
    } catch (err) {
      addToast('Erro ao processar ficha')
      setResult({ type: 'error', message: 'Erro interno' })
    } finally {
      setProcessing(false)
      setTimeout(() => setResult(null), 3000)
    }
  }, [processing, addToast])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (bufferRef.current.length > 0) {
          e.preventDefault()
          e.stopPropagation()
          if (timerRef.current) clearTimeout(timerRef.current)
          const val = bufferRef.current.trim()
          bufferRef.current = ''
          lastKeyTimeRef.current = 0
          if (val) processTicket(val)
        }
        return
      }
      if (e.key.length !== 1) return

      const now = Date.now()
      const delta = now - lastKeyTimeRef.current

      if (lastKeyTimeRef.current !== 0 && delta < 80) {
        e.preventDefault()
        e.stopPropagation()
        bufferRef.current += e.key
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
          const val = bufferRef.current.trim()
          bufferRef.current = ''
          lastKeyTimeRef.current = 0
          if (val) processTicket(val)
        }, 150)
      } else {
        bufferRef.current = e.key
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => { bufferRef.current = '' }, 200)
      }

      lastKeyTimeRef.current = now
    }

    window.addEventListener('keydown', handler, { capture: true })
    return () => {
      window.removeEventListener('keydown', handler, { capture: true })
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [processTicket])

  return (
    <div className="min-h-screen bg-sidebar flex flex-col items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center"
      >
        <div className="mb-8">
          <h1 className="font-serif italic text-4xl text-white mb-2">Bip Cozinha</h1>
          <p className="text-white/50 text-sm">Bipe a ficha para marcar como pronto</p>
        </div>

        <div className={`relative w-48 h-48 mx-auto mb-8 rounded-3xl border-4 flex items-center justify-center transition-colors duration-300 ${
          processing
            ? 'border-yellow-500 bg-yellow-500/10'
            : result?.type === 'success'
            ? 'border-green-500 bg-green-500/10'
            : result?.type === 'error'
            ? 'border-red-500 bg-red-500/10'
            : 'border-white/20 bg-white/5'
        }`}>
          <AnimatePresence mode="wait">
            {processing ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                  className="w-16 h-16 border-4 border-yellow-400 border-t-transparent rounded-full"
                />
              </motion.div>
            ) : result?.type === 'success' ? (
              <motion.div
                key="success"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
              >
                <CheckCircle size={64} className="text-green-400" />
              </motion.div>
            ) : result?.type === 'error' ? (
              <motion.div
                key="error"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
              >
                <AlertCircle size={64} className="text-red-400" />
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <Scan size={64} className="text-white/30" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className={`text-lg font-bold mb-2 ${
                result.type === 'success' ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {result.type === 'success'
                ? `✓ Ficha #${result.ticket} marcada como pronta!`
                : result.message}
            </motion.div>
          )}
        </AnimatePresence>

        {!result && !processing && (
          <p className="text-white/30 text-sm">Aguardando leitura...</p>
        )}

        <div className="mt-12 grid grid-cols-4 gap-3 opacity-20">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-1 bg-white rounded-full" />
          ))}
        </div>
      </motion.div>
    </div>
  )
}
