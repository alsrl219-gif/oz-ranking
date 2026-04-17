import { AlertCircle, RefreshCw } from 'lucide-react'
import { SummaryBar } from '../components/SummaryBar'
import { ChannelCard } from '../components/ChannelCard'
import { useRankingStore } from '../store/useRankingStore'
import { useRankingData } from '../hooks/useRankingData'
import type { ChannelId } from '../types'

const CHANNELS: ChannelId[] = ['coupang', 'smartstore', 'musinsa', 'boribori', 'lotteon', 'kakao']

export function Dashboard() {
  useRankingData()

  const { data, isLoading, error, fetchData } = useRankingStore()

  return (
    <div className="space-y-6">
      {/* 페이지 타이틀 */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">채널별 랭킹 현황</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          6개 채널에서 오즈키즈 제품의 실시간 순위를 확인하세요
        </p>
      </div>

      {/* 요약 통계 */}
      <SummaryBar summary={data?.summary ?? null} isLoading={isLoading} />

      {/* 에러 */}
      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 flex items-start gap-3">
          <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-700">{error}</p>
            <p className="text-xs text-red-500 mt-0.5">
              서버가 실행 중인지 확인하세요 (port 3002)
            </p>
          </div>
          <button
            onClick={fetchData}
            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
          >
            <RefreshCw size={12} />
            재시도
          </button>
        </div>
      )}

      {/* 채널 카드 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {CHANNELS.map((channelId) => (
          <ChannelCard key={channelId} channelId={channelId} />
        ))}
      </div>
    </div>
  )
}
