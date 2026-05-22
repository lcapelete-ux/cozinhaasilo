import type { OrderStatus } from '../types'

const config: Record<OrderStatus, { label: string; className: string }> = {
  pending: { label: 'Aguardando', className: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' },
  preparing: { label: 'Preparando', className: 'bg-blue-500/20 text-blue-300 border border-blue-500/30' },
  ready: { label: 'Pronto!', className: 'bg-green-500/20 text-green-300 border border-green-500/30' },
  delivered: { label: 'Entregue', className: 'bg-gray-500/20 text-gray-400 border border-gray-500/30' },
}

export default function StatusBadge({ status }: { status: OrderStatus }) {
  const { label, className } = config[status]
  return (
    <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}
