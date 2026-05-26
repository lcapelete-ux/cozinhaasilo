import { useEffect, useRef, useCallback } from 'react'

// Max ms between characters to be classified as scanner (not human typing)
const SCAN_THRESHOLD_MS = 55

interface UseQrScannerOptions {
  onScan: (value: string) => void
  onInputType?: (type: 'scanner' | 'keyboard') => void
  enabled?: boolean
  minLength?: number
}

export function useQrScanner({
  onScan,
  onInputType,
  enabled = true,
  minLength = 2,
}: UseQrScannerOptions) {
  const bufferRef = useRef('')
  const lastTimeRef = useRef(0)
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flush = useCallback(() => {
    const val = bufferRef.current.trim()
    bufferRef.current = ''
    lastTimeRef.current = 0
    if (val.length >= minLength) {
      onScan(val)
      onInputType?.('scanner')
    }
  }, [onScan, onInputType, minLength])

  useEffect(() => {
    if (!enabled) return

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (bufferRef.current.length >= minLength) {
          e.preventDefault()
          e.stopPropagation()
          if (flushTimerRef.current) clearTimeout(flushTimerRef.current)
          if (clearTimerRef.current) clearTimeout(clearTimerRef.current)
          flush()
        }
        return
      }

      if (e.key.length !== 1) return

      const now = Date.now()
      const delta = now - lastTimeRef.current

      if (lastTimeRef.current > 0 && delta < SCAN_THRESHOLD_MS) {
        // Scanner speed — capture
        e.preventDefault()
        e.stopPropagation()
        bufferRef.current += e.key
        if (clearTimerRef.current) clearTimeout(clearTimerRef.current)
        if (flushTimerRef.current) clearTimeout(flushTimerRef.current)
        flushTimerRef.current = setTimeout(flush, 100)
      } else {
        // Keyboard speed — pass through, start fresh buffer
        onInputType?.('keyboard')
        if (flushTimerRef.current) clearTimeout(flushTimerRef.current)
        if (clearTimerRef.current) clearTimeout(clearTimerRef.current)
        bufferRef.current = e.key
        clearTimerRef.current = setTimeout(() => {
          bufferRef.current = ''
          lastTimeRef.current = 0
        }, 300)
      }

      lastTimeRef.current = now
    }

    window.addEventListener('keydown', handler, { capture: true })
    return () => {
      window.removeEventListener('keydown', handler, { capture: true })
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current)
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current)
    }
  }, [enabled, flush, minLength])
}
