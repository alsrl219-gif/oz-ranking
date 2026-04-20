import { useState } from 'react'
import { RefreshCw, Loader2, ChevronDown, ChevronUp, ExternalLink, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { CHANNEL_META, PERIOD_LABEL, type ChannelId, type PeriodKey } from '../types'
import { useRankingStore } from '../store/useRankingStore'

interface ChannelCardProps {
  channelId: ChannelId
}

function RankDelta({ delta, isNew }: { delta: number | null; isNew: boolean }) {
  if (isNew) return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-100 text-violet-600">NEW</span>
  )
  if (delta === null || delta === 0) return (
    <span className="inline-flex items-center gap-0.5 text-[11px] text-gray-400">
      <Minus size={10} /> -
    </span>
  )
  if (delta > 0) return (
    <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-emerald-500">
      <TrendingUp size={11} /> {delta}
    </span>
  )
  return (
    <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-red-400">
      <TrendingDown size={11} /> {Math.abs(delta)}
    </span>
  )
}

export function ChannelCard({ channelId }: ChannelCardProps) {
  const meta = CHANNEL_META[channelId]
  const { selectedPeriods, setChannelPeriod, getSnapshot, status, isScraping, scrapingChannels, triggerChannelScrape } = useRankingStore()
  const [expanded, setExpanded] = useState(false)

  const selectedPeriod: PeriodKey = selectedPeriods[channelId] ?? meta.supportedPeriods[0] ?? 'realtime'
  const snapshot = getSnapshot(channelId, selectedPeriod)
  const hasError = !!status?.channelErrors[channelId]
  const isThisChannelScraping = !!(isScraping || scrapingChannels[channelId])
  const ozEntries = snapshot?.ozKidsEntries ?? []
  const hasOzKids = ozEntries.length > 0
  const isUnsupported = snapshot?.error === '이 채널은 해당 기간을 지원하지 않습니다'
  const isBlocked = hasError || (snapshot?.error && !isUnsupported && snapshot.products.length === 0)

  return (
    <div
      className="bg-white rounded-2xl border flex flex-col transition-all overflow-hidden"
      style={{
        borderColor: hasOzKids ? meta.color + '40' : '#E5E7EB',
        boxShadow: hasOzKids
          ? `0 0 0 1.5px ${meta.color}25, 0 2px 12px ${meta.color}10`
          : '0 1px 4px rgba(0,0,0,0.04)',
      }}
    >
      {/* 채널 컬러 바 */}
      <div className="h-1 w-full" style={{ backgroundColor: meta.color }} />

      {/* 헤더 */}
      <div className="flex items-center gap-3 px-4 pt-3 pb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-900 text-[15px]">{meta.label}</span>
            {/* 상태 점 */}
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: isBlocked ? '#EF4444' : isThisChannelScraping ? '#F59E0B' : '#10B981' }}
              title={isBlocked ? '오류' : isThisChannelScraping ? '수집 중' : '정상'}
            />
          </div>
        </div>

        {/* 수집 버튼 */}
        <button
          onClick={() => triggerChannelScrape(channelId)}
          disabled={isThisChannelScraping}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50 disabled:opacity-40 transition-all"
        >
          {isThisChannelScraping ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
          수집
        </button>
      </div>

      {/* 기간 탭 */}
      <div className="flex gap-1 px-4 pb-3">
        {meta.supportedPeriods.map((p) => (
          <button
            key={p}
            onClick={() => setChannelPeriod(channelId, p)}
            className="px-2.5 py-1 rounded-lg text-[12px] font-medium transition-all"
            style={
              selectedPeriod === p
                ? { backgroundColor: meta.color, color: meta.textColor }
                : { color: '#9CA3AF', backgroundColor: 'transparent' }
            }
          >
            {PERIOD_LABEL[p]}
          </button>
        ))}
      </div>

      {/* 메인 컨텐츠 */}
      <div className="flex-1 px-4 pb-2">
        {/* 로딩 중 */}
        {isThisChannelScraping && !snapshot && (
          <div className="flex items-center justify-center py-8 gap-2 text-gray-400 text-sm">
            <Loader2 size={16} className="animate-spin" />
            수집 중...
          </div>
        )}

        {/* 지원하지 않는 기간 */}
        {isUnsupported && (
          <div className="flex items-center justify-center py-6">
            <span className="text-sm text-gray-300">이 기간 미지원</span>
          </div>
        )}

        {/* 오류 */}
        {isBlocked && !isUnsupported && (
          <div className="flex items-center justify-center py-6 px-3">
            <span className="text-xs text-red-400 text-center">
              {snapshot?.error?.includes('봇 차단') ? '🚫 봇 차단' : '⚠️ 수집 오류'}
            </span>
          </div>
        )}

        {/* 데이터 없음 */}
        {!snapshot && !isThisChannelScraping && (
          <div className="flex flex-col items-center justify-center py-7 text-gray-300">
            <p className="text-sm">수집 전</p>
          </div>
        )}

        {/* OZ Kids 등장 */}
        {snapshot && !isUnsupported && !isBlocked && hasOzKids && (
          <div className="space-y-2">
            {ozEntries.slice(0, expanded ? undefined : 3).map((entry) => (
              <div
                key={`${entry.rank}-${entry.productName}`}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                style={{ backgroundColor: meta.bgLight }}
              >
                {/* 순위 */}
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-lg"
                  style={{ backgroundColor: meta.color + '20', color: meta.color }}
                >
                  #{entry.rank}
                </div>
                {/* 정보 */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-gray-900 leading-snug truncate">{entry.productName}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[12px] font-bold" style={{ color: meta.color }}>
                      {entry.price > 0 ? `${entry.price.toLocaleString()}원` : '-'}
                    </span>
                    <RankDelta delta={entry.rankDelta} isNew={entry.isNew} />
                  </div>
                </div>
                {/* 링크 */}
                {entry.productUrl && (
                  <a
                    href={entry.productUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink size={13} />
                  </a>
                )}
              </div>
            ))}

            {ozEntries.length > 3 && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                {expanded ? '접기' : `+${ozEntries.length - 3}개 더 보기`}
              </button>
            )}
          </div>
        )}

        {/* OZ Kids 미등장 */}
        {snapshot && !isUnsupported && !isBlocked && !hasOzKids && snapshot.products.length > 0 && (
          <div className="flex flex-col items-center justify-center py-7 gap-1">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-1">
              <span className="text-lg">—</span>
            </div>
            <p className="text-sm text-gray-400 font-medium">미등장</p>
            <p className="text-xs text-gray-300">전체 {snapshot.products.length}개 수집됨</p>
          </div>
        )}
      </div>

      {/* 푸터 */}
      {snapshot && !isUnsupported && (
        <div className="px-4 pb-3 flex items-center justify-between">
          <span className="text-[11px] text-gray-300">
            {snapshot.scrapedAt && new Date(snapshot.scrapedAt).toLocaleString('ko-KR', {
              month: 'short', day: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })} 수집
          </span>
          {snapshot.products.length > 0 && (
            <span className="text-[11px] text-gray-300">
              {hasOzKids
                ? `${snapshot.products.length}개 중 ${ozEntries.length}개 오즈키즈`
                : `${snapshot.products.length}개 수집`
              }
            </span>
          )}
        </div>
      )}
    </div>
  )
}
