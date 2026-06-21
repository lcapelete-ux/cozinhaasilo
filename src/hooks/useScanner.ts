import { useEffect, useRef } from 'react'

// Robust keyboard-wedge QR/barcode scanner reader.
//
// A scanner "types" every character of one code in a tight burst (each char a
// few ms apart) and usually — but not always — ends with Enter. The hard part
// is segmenting one scan from the next when the kitchen screens are under heavy
// render load (many active orders): the main thread blocks, keystrokes from a
// *second* scan queue up, and then fire in a burst the instant the first scan
// finishes processing. If segmentation relied on wall-clock setTimeout timers
// (which fire late under load), those queued keystrokes would keep resetting
// the timer and the two codes would concatenate into one giant number that
// matches no ficha — exactly the "número grande que não reconhece" bug.
//
// The fix: segment by the *real* time each key was pressed. e.timeStamp is set
// by the browser when the key is physically pressed, so it is immune to thread
// lag — even keystrokes processed late in a burst still carry accurate relative
// timing. A gap larger than BURST_GAP_MS means a brand-new code started, so we
// flush whatever we had (a complete previous scan) and start fresh. This makes
// merging impossible regardless of render load, even when the scanner sends no
// trailing Enter.

const BURST_GAP_MS = 100   // gap since last key > this ⇒ a new scan is starting
const QUIET_FLUSH_MS = 130 // no Enter + input went quiet ⇒ flush the buffer
const MIN_SCAN_LEN = 2     // ignore lone stray keystrokes (Enter still flushes 1)

export function useScanner(onScan: (value: string) => void) {
  const onScanRef = useRef(onScan)
  onScanRef.current = onScan

  useEffect(() => {
    let buffer = ''
    let lastTime = 0
    let timer: ReturnType<typeof setTimeout> | null = null

    const flush = (minLen: number) => {
      if (timer) { clearTimeout(timer); timer = null }
      const val = buffer.trim()
      buffer = ''
      lastTime = 0
      if (val.length >= minLen) onScanRef.current(val)
    }

    const handler = (e: KeyboardEvent) => {
      // Let the manual-entry input (and any other field) work normally.
      if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) return
      // Some scanners emit Tab between fields; never let it move focus away.
      if (e.key === 'Tab') { e.preventDefault(); return }

      if (e.key === 'Enter') {
        e.preventDefault(); e.stopPropagation()
        flush(1) // explicit terminator: accept even a single-character code
        return
      }

      if (e.key.length !== 1) return
      e.preventDefault(); e.stopPropagation()

      const now = e.timeStamp
      // A large gap means the previous buffer is a finished scan: flush it
      // before this new code's first character lands, so they never merge.
      if (buffer && now - lastTime > BURST_GAP_MS) flush(MIN_SCAN_LEN)
      lastTime = now
      buffer += e.key

      if (timer) clearTimeout(timer)
      timer = setTimeout(() => flush(MIN_SCAN_LEN), QUIET_FLUSH_MS)
    }

    window.addEventListener('keydown', handler, { capture: true })
    return () => {
      window.removeEventListener('keydown', handler, { capture: true })
      if (timer) clearTimeout(timer)
    }
  }, [])
}
