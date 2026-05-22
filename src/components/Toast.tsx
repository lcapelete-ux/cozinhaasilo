import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, AlertCircle, CheckCircle, Info } from 'lucide-react'

export interface ToastMessage {
  id: string
  message: string
  type: 'error' | 'success' | 'info'
}

interface Props {
  toasts: ToastMessage[]
  onRemove: (id: string) => void
}

function ToastItem({ toast, onRemove }: { toast: ToastMessage; onRemove: (id: string) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onRemove(toast.id), 4000)
    return () => clearTimeout(t)
  }, [toast.id, onRemove])

  const icons = {
    error: <AlertCircle size={18} className="text-red-400" />,
    success: <CheckCircle size={18} className="text-green-400" />,
    info: <Info size={18} className="text-blue-400" />,
  }

  const borders = {
    error: 'border-red-500/30',
    success: 'border-green-500/30',
    info: 'border-blue-500/30',
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 60, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, scale: 0.9 }}
      className={`flex items-start gap-3 bg-[#1a1d20] border ${borders[toast.type]} rounded-2xl px-4 py-3 shadow-2xl min-w-[280px] max-w-sm`}
    >
      <span className="mt-0.5">{icons[toast.type]}</span>
      <span className="text-sm text-white/90 flex-1">{toast.message}</span>
      <button
        onClick={() => onRemove(toast.id)}
        className="text-white/40 hover:text-white/80 transition-colors"
      >
        <X size={14} />
      </button>
    </motion.div>
  )
}

export default function Toast({ toasts, onRemove }: Props) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onRemove={onRemove} />
        ))}
      </AnimatePresence>
    </div>
  )
}
