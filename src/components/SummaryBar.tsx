import { Trophy, Layers, TrendingUp, Clock, Wifi, WifiOff } from 'lucide-react'
import { CHANNEL_META, type RankingSummary } from '../types'

interface SummaryBarProps {
  summary: RankingSummary | null
  isLoading: boolean
  dataAge?: number | null
  isConnected?: boolean
}

export function SummaryBar({ summary, isLoading, dataAge, isConnected = true }: SummaryBarProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 h-24 animate-pulse" />
        ))}
      </div>
    )
  }

  const bestChannelLabel = summary?.bestRankChannel
    ? CHANNEL_META[summary.bestRankChannel]?.label
    : null

  const updatedAt = summary?.lastUpdatedAt
    ? new Date(summary.lastUpdatedAt).toLocaleString('ko-KR', {
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : '-'

  const stats = [
    {
      icon: Layers,
      label: '등장 채널',
      value: summary ? `${summary.channelsWithOzKids}` : '-',
      unit: '/ 6',
      sub: summary?.channelsWithOzKids ? `${summary.channelsWithOzKids}개 채널에 등장` : '등장 없음',
      accent: '#6366F1',
      bg: '#EEF2FF',
    },
    {
      icon: Trophy,
      label: '최고 순위',
      value: summary?.bestRankOverall ? `#${summary.bestRankOverall}` : '-',
      unit: '',
      sub: bestChannelLabel ?? '데이터 없음',
      accent: '#F59E0B',
      bg: '#FFFBEB',
    },
    {
      icon: TrendingUp,
      label: '총 등장 횟수',
      value: summary ? `${summary.totalOzKidsAppearances}` : '-',
      unit: '회',
      sub: '전 채널 합산',
      accent: '#10B981',
      bg: '#ECFDF5',
    },
    {
      icon: dataAge !== null && dataAge !== undefined ? Clock : (isConnected ? Wifi : WifiOff),
      label: '마지막 수집',
      value: dataAge !== null && dataAge !== undefined
        ? dataAge < 1 ? '방금' : dataAge < 60 ? `${dataAge}분` : `${Math.floor(dataAge / 60)}시간`
        : '-',
      unit: dataAge !== null && dataAge !== undefined && dataAge >= 1 ? ' 전' : '',
      sub: updatedAt,
      accent: isConnected ? '#6B7280' : '#EF4444',
      bg: isConnected ? '#F9FAFB' : '#FEF2F2',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map(({ icon: Icon, label, value, unit, sub, accent, bg }) => (
        <div
          key={label}
          className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-center gap-4"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
        >
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: bg }}>
            <Icon size={20} style={{ color: accent }} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-400 font-medium mb-0.5">{label}</p>
            <p className="text-2xl font-bold text-gray-900 leading-none">
              {value}
              {unit && <span className="text-sm font-medium text-gray-400 ml-0.5">{unit}</span>}
            </p>
            <p className="text-xs text-gray-400 mt-1 truncate">{sub}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
