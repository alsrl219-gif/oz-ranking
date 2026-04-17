import { ExternalLink } from 'lucide-react'
import { RankBadge } from './RankBadge'
import { RankMovement } from './RankMovement'
import type { OzKidsEntry } from '../types'

interface OZProductRowProps {
  entry: OzKidsEntry
}

export function OZProductRow({ entry }: OZProductRowProps) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 bg-brand-50 border-l-4 border-brand-400 rounded-r-lg hover:bg-brand-100 transition-colors">
      <RankBadge rank={entry.rank} size="md" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{entry.productName}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs font-bold text-brand-600">
            {entry.price > 0 ? `${entry.price.toLocaleString()}원` : '가격 미표시'}
          </span>
          <RankMovement delta={entry.rankDelta} isNew={entry.isNew} />
        </div>
      </div>
      {entry.productUrl && (
        <a
          href={entry.productUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 p-1 text-gray-400 hover:text-brand-500 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink size={14} />
        </a>
      )}
    </div>
  )
}
