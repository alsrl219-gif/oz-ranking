interface RankBadgeProps {
  rank: number
  size?: 'sm' | 'md' | 'lg'
}

const MEDAL: Record<number, string> = {
  1: 'bg-amber-400 text-white shadow-amber-200',
  2: 'bg-gray-300 text-gray-700 shadow-gray-200',
  3: 'bg-orange-400 text-white shadow-orange-200',
}

export function RankBadge({ rank, size = 'md' }: RankBadgeProps) {
  const sizeClass = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-11 h-11 text-base',
  }[size]

  const colorClass = MEDAL[rank] ?? 'bg-gray-100 text-gray-500'

  return (
    <div
      className={`${sizeClass} ${colorClass} rounded-full flex items-center justify-center font-bold shadow-sm flex-shrink-0`}
    >
      {rank}
    </div>
  )
}
