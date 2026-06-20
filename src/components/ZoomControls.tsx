import { ZoomIn, ZoomOut } from 'lucide-react'

export const ZOOM_STEPS = [0.75, 0.85, 1, 1.15, 1.3, 1.5, 1.75, 2, 2.3, 2.6, 3]

export default function ZoomControls({ zoom, onChange, steps = ZOOM_STEPS }: { zoom: number; onChange: (z: number) => void; steps?: number[] }) {
  const idx = steps.indexOf(zoom)
  const dec = () => { if (idx > 0) onChange(steps[idx - 1]) }
  const inc = () => { if (idx < steps.length - 1) onChange(steps[idx + 1]) }
  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-xl px-1 py-1">
      <button onClick={dec} disabled={idx === 0} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:bg-white hover:text-gray-800 disabled:opacity-30 transition-colors">
        <ZoomOut size={14} />
      </button>
      <span className="text-xs font-bold text-gray-500 w-10 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
      <button onClick={inc} disabled={idx === ZOOM_STEPS.length - 1} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:bg-white hover:text-gray-800 disabled:opacity-30 transition-colors">
        <ZoomIn size={14} />
      </button>
    </div>
  )
}
