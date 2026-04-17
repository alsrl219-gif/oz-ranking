import { Trophy, Store, TrendingUp, Clock } from 'lucide-react'
import { CHANNEL_META, type RankingSummary } from '../types'

interface SummaryBarProps {
  summary: RankingSummary | null
  isLoading: boolean
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType
  label: string
  value: string
  sub?: string
  color: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-card px-5 py-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-xl font-bold text-gray-900 leading-tight">{value}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  )
}

export function SummaryBar({ summary, isLoading }: SummaryBarProps) {
  if (isLoading || !summary) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 h-20 animate-pulse" />
        ))}
      </div>
    )
  }

  const bestChannelLabel = summary.bestRankChannel
    ? CHANNEL_META[summary.bestRankChannel]?.label
    : null

  const updatedAt = summary.lastUpdatedAt
    ? new Date(summary.lastUpdatedAt).toLocaleString('ko-KR', {
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : '-'

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        icon={TrendingUp}
        label="총 랭킹 등장"
        value={`${summary.totalOzKidsAppearances}회`}
        sub="전 채널 합산"
        color="bg-brand-500"
      />
      <StatCard
        icon={Store}
        label="활성 채널"
        value={`${summary.channelsWithOzKids} / 6`}
        sub="오즈키즈 등장"
        color="bg-blue-500"
      />
      <StatCard
        icon={Trophy}
        label="최고 순위"
        value={summary.bestRankOverall ? `#${summary.bestRankOverall}` : '-'}
        sub={bestChannelLabel ?? undefined}
        color="bg-amber-400"
      />
      <StatCard
        icon={Clock}
        label="마지막 수집"
        value={updatedAt}
        color="bg-gray-400"
      />
    </div>
  )
}
