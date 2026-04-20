import { useState } from 'react'
import { RefreshCw, Loader2 } from 'lucide-react'
import { PeriodTabs } from './PeriodTabs'
import { RankingTable } from './RankingTable'
import { StatusIndicator } from './StatusIndicator'
import { CHANNEL_META, type ChannelId, type PeriodKey } from '../types'
import { useRankingStore } from '../store/useRankingStore'

interface ChannelCardProps {
  channelId: ChannelId
}

export function ChannelCard({ channelId }: ChannelCardProps) {
  const meta = CHANNEL_META[channelId]
  const { selectedPeriods, setChannelPeriod, getSnapshot, status, isScraping, scrapingChannels, triggerChannelScrape } = useRankingStore()
  const [showAll, setShowAll] = useState(false)

  const selectedPeriod: PeriodKey = selectedPeriods[channelId] ?? 'realtime'
  const snapshot = getSnapshot(channelId, selectedPeriod)
  const hasError = !!status?.channelErrors[channelId]
  const ozCount = snapshot?.ozKidsEntries.length ?? 0
  const isThisChannelScraping = !!(isScraping || scrapingChannels[channelId])

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-card hover:shadow-card-hover transition-shadow overflow-hidden flex flex-col">
      {/* 헤더 */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-50">
        {/* 채널 컬러 스트립 */}
        <div
          className="w-1 h-10 rounded-full flex-shrink-0"
          style={{ backgroundColor: meta.color }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-gray-900 text-sm">{meta.label}</h3>
            {ozCount > 0 && (
              <span
                className="px-2 py-0.5 rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: meta.color }}
              >
                {ozCount}개
              </span>
            )}
          </div>
          <div className="mt-0.5">
            <StatusIndicator isRunning={isThisChannelScraping} hasError={hasError} />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* 채널별 수집 버튼 */}
          <button
            onClick={() => triggerChannelScrape(channelId)}
            disabled={isThisChannelScraping}
            title="이 채널만 수집"
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700 disabled:opacity-40 transition-colors"
          >
            {isThisChannelScraping ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <RefreshCw size={11} />
            )}
            수집
          </button>
          <button
            onClick={() => setShowAll((v) => !v)}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            {showAll ? '요약' : '전체'}
          </button>
        </div>
      </div>

      {/* 기간 탭 */}
      <div className="px-4 pt-3">
        <PeriodTabs
          periods={meta.supportedPeriods}
          selected={selectedPeriod}
          onChange={(p) => setChannelPeriod(channelId, p)}
        />
      </div>

      {/* 랭킹 목록 */}
      <div className="flex-1 px-4 pb-4 pt-3 overflow-y-auto max-h-80">
        <RankingTable snapshot={snapshot} showAll={showAll} />
      </div>

      {/* 마지막 수집 시각 */}
      {snapshot?.scrapedAt && (
        <div className="px-4 pb-3 flex items-center gap-1 text-xs text-gray-400">
          <RefreshCw size={11} />
          {new Date(snapshot.scrapedAt).toLocaleString('ko-KR', {
            month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })}
        </div>
      )}
    </div>
  )
}
