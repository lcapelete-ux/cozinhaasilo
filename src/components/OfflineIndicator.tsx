import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { WifiOff } from 'lucide-react'

// Mostra um selo fixo quando o computador está sem internet. O app continua
// funcionando (vendas e baixa de estoque são gravadas no cache local do
// Firestore) e sincroniza sozinho quando a conexão volta.
export default function OfflineIndicator() {
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-full shadow-lg text-sm font-bold"
        >
          <WifiOff size={16} />
          Sem internet — salvando localmente
        </motion.div>
      )}
    </AnimatePresence>
  )
}
