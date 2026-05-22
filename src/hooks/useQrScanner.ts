import { useEffect, useRef, useCallback } from 'react'

interface UseQrScannerOptions {
  onScan: (value: string) => void
  onInputType?: (type: 'qr' | 'keyboard') => void
  enabled?: boolean
}

export function useQrScanner({ onScan, onInputType, enabled = true }: UseQrScannerOptions) {
  const bufferRef = useRef('')
  const lastKeyTimeRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flushBuffer = useCallback(() => {
    const val = bufferRef.current.trim()
    if (val) {
      onScan(val)
      onInputType?.('qr')
    }
    bufferRef.current = ''
    lastKeyTimeRef.current = 0
  }, [onScan, onInputType])

  useEffect(() => {
    if (!enabled) return

    const handler = (e: KeyboardEvent) => {
      const now = Date.now()
      const delta = now - lastKeyTimeRef.current

      if (e.key === 'Enter') {
        if (bufferRef.current.length > 0) {
          e.preventDefault()
          e.stopPropagation()
          if (timerRef.current) clearTimeout(timerRef.current)
          flushBuffer()
        }
        return
      }

      // Ignore non-printable keys when not in qr mode
      if (e.key.length !== 1) return

      if (lastKeyTimeRef.current !== 0 && delta < 80) {
        // QR scanner speed — capture in buffer
        e.preventDefault()
        e.stopPropagation()
        bufferRef.current += e.key

        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
          flushBuffer()
        }, 150)
      } else {
        // Human typing speed — let it through to normal inputs
        onInputType?.('keyboard')
        // If there was a partial buffer from before, clear it
        if (bufferRef.current.length > 0) {
          bufferRef.current = ''
        }
        // Start potential qr buffer with this char only if it's fast enough next key
        bufferRef.current = e.key
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
          // single char typed slowly — not qr, clear
          bufferRef.current = ''
        }, 200)
      }

      lastKeyTimeRef.current = now
    }

    window.addEventListener('keydown', handler, { capture: true })
    return () => {
      window.removeEventListener('keydown', handler, { capture: true })
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [enabled, flushBuffer, onInputType])
}
