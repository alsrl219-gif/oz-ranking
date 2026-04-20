import { AlertTriangle, RefreshCw, ExternalLink, Info } from 'lucide-react'
import { SummaryBar } from '../components/SummaryBar'
import { ChannelCard } from '../components/ChannelCard'
import { useRankingStore } from '../store/useRankingStore'
import { useRankingData } from '../hooks/useRankingData'
import { API_BASE } from '../config'
import type { ChannelId } from '../types'

// OZ Kids 있는 채널을 앞에 표시
const ALL_CHANNELS: ChannelId[] = ['coupang', 'smartstore', 'musinsa', 'boribori', 'lotteon', 'kakao']

export function Dashboard() {
  useRankingData()

  const { data, isLoading, error, status, fetchData } = useRankingStore()

  // OZ Kids 등장하는 채널을 앞으로 정렬
  const sortedChannels = [...ALL_CHANNELS].sort((a, b) => {
    if (!data) return 0
    const aHas = data.snapshots.some(s => s.channelId === a && s.ozKidsEntries.length > 0)
    const bHas = data.snapshots.some(s => s.channelId === b && s.ozKidsEntries.length > 0)
    if (aHas && !bHas) return -1
    if (!aHas && bHas) return 1
    return 0
  })

  const noApiUrl = !API_BASE && !import.meta.env.VITE_API_URL

  return (
    <div className="space-y-6">

      {/* 서버 연결 안내 배너 */}
      {noApiUrl && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 flex items-start gap-3">
          <Info size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">Render 백엔드 URL 설정 필요</p>
            <p className="text-xs text-amber-600 mt-1">
              Vercel 대시보드 → Settings → Environment Variables 에서
              <code className="mx-1 px-1.5 py-0.5 bg-amber-100 rounded font-mono text-[11px]">VITE_API_URL</code>
              에 Render 서비스 URL을 추가하고 재배포하세요.
            </p>
          </div>
          <a
            href="https://vercel.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 flex-shrink-0 font-medium"
          >
            Vercel <ExternalLink size={11} />
          </a>
        </div>
      )}

      {/* 에러 */}
      {error && !noApiUrl && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 flex items-center gap-3">
          <AlertTriangle size={16} className="text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-700 flex-1">{error}</p>
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-500 hover:text-red-700 border border-red-200 rounded-lg transition-colors"
          >
            <RefreshCw size={11} /> 재시도
          </button>
        </div>
      )}

      {/* 페이지 헤더 */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">채널별 랭킹 현황</h1>
          <p className="text-sm text-gray-400 mt-1">
            6개 채널에서 오즈키즈 제품의 순위를 실시간으로 확인합니다
          </p>
        </div>
        {data?.scrapedAt && (
          <p className="text-xs text-gray-300 pb-0.5">
            {new Date(data.scrapedAt).toLocaleString('ko-KR', {
              month: 'short', day: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })} 기준
          </p>
        )}
      </div>

      {/* 요약 통계 */}
      <SummaryBar
        summary={data?.summary ?? null}
        isLoading={isLoading}
        dataAge={status?.ageMinutes}
        isConnected={!error}
      />

      {/* 채널 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sortedChannels.map((channelId) => (
          <ChannelCard key={channelId} channelId={channelId} />
        ))}
      </div>
    </div>
  )
}
