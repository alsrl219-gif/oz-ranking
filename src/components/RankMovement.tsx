import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface RankMovementProps {
  delta: number | null
  isNew: boolean
}

export function RankMovement({ delta, isNew }: RankMovementProps) {
  if (isNew) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-brand-100 text-brand-600">
        NEW
      </span>
    )
  }
  if (delta === null) return null
  if (delta > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-600">
        <TrendingUp size={12} />
        {delta}
      </span>
    )
  }
  if (delta < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-red-500">
        <TrendingDown size={12} />
        {Math.abs(delta)}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-xs text-gray-400">
      <Minus size={12} />
    </span>
  )
}
