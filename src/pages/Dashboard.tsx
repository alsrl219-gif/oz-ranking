import { useState, useMemo } from 'react'
import { RefreshCw, Loader2, ExternalLink, Award, LayoutGrid } from 'lucide-react'
import { useRankingStore } from '../store/useRankingStore'
import { useRankingData } from '../hooks/useRankingData'
import { CHANNEL_META, PERIOD_LABEL, type ChannelId, type PeriodKey, type OzKidsEntry, type RankingSnapshot } from '../types'

type ChannelFilter = 'all' | ChannelId

const CHANNELS: ChannelId[] = ['coupang', 'smartstore', 'musinsa', 'boribori', 'lotteon', 'kakao']

const PERIOD_TABS: { key: PeriodKey; label: string }[] = [
  { key: 'realtime', label: '실시간' },
  { key: 'daily',    label: '일간' },
  { key: 'weekly',   label: '주간' },
  { key: 'monthly',  label: '월간' },
]

type OzEntry = OzKidsEntry & { channelId: ChannelId }

function RankDelta({ delta, isNew }: { delta: number | null; isNew: boolean }) {
  if (isNew) return (
    <span className="text-[9px] font-extrabold text-purple-600 bg-purple-50 border border-purple-100 px-1.5 py-0.5 rounded leading-none">
      NEW
    </span>
  )
  if (delta === null || delta === 0) return <span className="text-gray-300 text-[11px]">—</span>
  if (delta > 0) return (
    <span className="text-emerald-500 text-[11px] font-bold">▲{delta}</span>
  )
  return (
    <span className="text-red-400 text-[11px] font-bold">▼{Math.abs(delta)}</span>
  )
}

function ProductCard({
  product,
  channelId,
}: {
  product: RankingSnapshot['products'][0]
  channelId: ChannelId
}) {
  const meta = CHANNEL_META[channelId]
  const isOz = product.isOzKids
  return (
    <div
      className="bg-white rounded-xl overflow-hidden transition-shadow hover:shadow-md"
      style={
        isOz
          ? { boxShadow: `0 0 0 2px ${meta.color}, 0 2px 8px ${meta.color}22` }
          : { boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }
      }
    >
      {/* 이미지 */}
      <div className="relative aspect-square bg-gray-50 overflow-hidden">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.productName}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-200 text-xs">
            No image
          </div>
        )}
        {/* 순위 뱃지 */}
        <div
          className="absolute top-1.5 left-1.5 w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-black shadow"
          style={
            product.rank <= 3
              ? {
                  backgroundColor:
                    product.rank === 1 ? '#F59E0B' : product.rank === 2 ? '#9CA3AF' : '#F97316',
                  color: '#fff',
                }
              : isOz
              ? { backgroundColor: meta.color, color: meta.textColor }
              : { backgroundColor: 'rgba(255,255,255,0.9)', color: '#6B7280' }
          }
        >
          {product.rank}
        </div>
        {/* OZ 표시 */}
        {isOz && (
          <div
            className="absolute top-1.5 right-1.5 text-[9px] font-black px-1.5 py-0.5 rounded"
            style={{ backgroundColor: meta.color, color: meta.textColor }}
          >
            OZ
          </div>
        )}
      </div>
      {/* 텍스트 */}
      <div className="p-2">
        <p className="text-[10px] text-gray-400 truncate">{product.brandName || '—'}</p>
        <p className="text-[12px] font-semibold text-gray-900 leading-tight line-clamp-2 mt-0.5 min-h-[2.4em]">
          {product.productName}
        </p>
        <div className="flex items-center justify-between mt-1.5">
          <p className="text-[12px] font-bold" style={{ color: meta.color }}>
            {product.price > 0 ? `${product.price.toLocaleString()}원` : '—'}
          </p>
          {product.productUrl && (
            <a
              href={product.productUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-300 hover:text-gray-500 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink size={11} />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

function ChannelSummaryCard({
  channelId,
  snap,
  period,
  isScraping,
  onSelect,
  onScrape,
}: {
  channelId: ChannelId
  snap: RankingSnapshot | null
  period: PeriodKey
  isScraping: boolean
  onSelect: () => void
  onScrape: (e: React.MouseEvent) => void
}) {
  const meta = CHANNEL_META[channelId]
  const ozEntries = snap?.ozKidsEntries ?? []
  const bestRank = ozEntries[0]?.rank ?? null
  const isUnsupported = snap?.error === '이 채널은 해당 기간을 지원하지 않습니다'
  const isError = !isUnsupported && !!snap?.error && snap.products.length === 0

  return (
    <div
      className="bg-white rounded-2xl overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
      style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
      onClick={onSelect}
    >
      <div className="h-1 w-full" style={{ backgroundColor: meta.color }} />
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-900">{meta.label}</span>
            {isScraping && <Loader2 size={11} className="animate-spin text-gray-400" />}
          </div>
          <button
            onClick={onScrape}
            disabled={isScraping}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40"
          >
            <RefreshCw size={11} />
          </button>
        </div>

        {isUnsupported ? (
          <p className="text-xs text-gray-300 py-1">{PERIOD_LABEL[period]} 미지원</p>
        ) : isError ? (
          <p className="text-xs text-red-400 py-1">수집 오류</p>
        ) : isScraping && !snap ? (
          <p className="text-xs text-gray-400 py-1">수집 중…</p>
        ) : ozEntries.length > 0 ? (
          <div className="flex items-end gap-2">
            <div className="text-3xl font-black leading-none" style={{ color: meta.color }}>
              #{bestRank}
            </div>
            <div className="pb-0.5 text-xs text-gray-400">
              <p>{ozEntries.length}개 등장</p>
              <p className="text-gray-300">{snap?.products.length ?? 0}개 중</p>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium text-gray-400">미등장</p>
            <p className="text-xs text-gray-300">{snap?.products.length ?? 0}개 수집됨</p>
          </div>
        )}
      </div>
    </div>
  )
}

export function Dashboard() {
  useRankingData()

  const {
    data,
    isLoading,
    isScraping,
    scrapingChannels,
    status,
    triggerScrape,
    triggerChannelScrape,
  } = useRankingStore()

  const [selectedChannel, setSelectedChannel] = useState<ChannelFilter>('all')
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>('realtime')

  // ─── 선택된 채널+기간 스냅샷 ─────────────────────────────────────
  const getSnap = (channelId: ChannelId): RankingSnapshot | null =>
    data?.snapshots.find(s => s.channelId === channelId && s.period === selectedPeriod) ?? null

  // ─── 왼쪽 패널: 오즈키즈 등장 목록 ────────────────────────────────
  const ozEntries: OzEntry[] = useMemo(() => {
    if (!data) return []
    const channels = selectedChannel === 'all' ? CHANNELS : [selectedChannel as ChannelId]
    const all: OzEntry[] = []
    for (const ch of channels) {
      const snap = data.snapshots.find(s => s.channelId === ch && s.period === selectedPeriod)
      for (const e of snap?.ozKidsEntries ?? []) {
        all.push({ ...e, channelId: ch })
      }
    }
    return all.sort((a, b) => a.rank - b.rank)
  }, [data, selectedChannel, selectedPeriod])

  // ─── 오른쪽 패널: 전체 랭킹 ─────────────────────────────────────
  const rightSnap: RankingSnapshot | null = useMemo(() => {
    if (selectedChannel === 'all' || !data) return null
    return data.snapshots.find(s => s.channelId === selectedChannel && s.period === selectedPeriod) ?? null
  }, [data, selectedChannel, selectedPeriod])

  // ─── 선택 채널의 지원 기간 ───────────────────────────────────────
  const supportedPeriods: Set<PeriodKey> = useMemo(() => {
    if (selectedChannel === 'all') return new Set(PERIOD_TABS.map(t => t.key))
    return new Set(CHANNEL_META[selectedChannel as ChannelId]?.supportedPeriods ?? [])
  }, [selectedChannel])

  const isCurrentScraping =
    selectedChannel !== 'all' ? !!(isScraping || scrapingChannels[selectedChannel as ChannelId]) : isScraping

  const ageText =
    status?.ageMinutes !== null && status?.ageMinutes !== undefined
      ? status.ageMinutes < 1
        ? '방금 전'
        : status.ageMinutes < 60
        ? `${status.ageMinutes}분 전`
        : `${Math.floor(status.ageMinutes / 60)}시간 전`
      : null

  const activeChannelMeta = selectedChannel !== 'all' ? CHANNEL_META[selectedChannel as ChannelId] : null

  return (
    <div>
      {/* ─── 채널 탭 + 기간 토글 ─────────────────────────────────── */}
      <div className="bg-white rounded-2xl mb-4 overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        {/* 채널 탭 */}
        <div className="flex items-center gap-0.5 px-4 pt-3 border-b border-gray-100 overflow-x-auto">
          {/* 전체 탭 */}
          <button
            onClick={() => setSelectedChannel('all')}
            className={`flex-shrink-0 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-all ${
              selectedChannel === 'all'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            전체
          </button>

          {CHANNELS.map(ch => {
            const meta = CHANNEL_META[ch]
            const isActive = selectedChannel === ch
            const snap = data?.snapshots.find(s => s.channelId === ch && s.period === selectedPeriod)
            const hasOz = (snap?.ozKidsEntries.length ?? 0) > 0
            return (
              <button
                key={ch}
                onClick={() => setSelectedChannel(ch)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-all ${
                  isActive
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                {meta.label}
                {hasOz && (
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: meta.color }}
                  />
                )}
              </button>
            )
          })}
        </div>

        {/* 기간 토글 + 액션 */}
        <div className="flex items-center justify-between px-4 py-2.5">
          {/* 기간 토글 */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {PERIOD_TABS.map(({ key, label }) => {
              const supported = supportedPeriods.has(key)
              return (
                <button
                  key={key}
                  onClick={() => supported && setSelectedPeriod(key)}
                  className={`px-3.5 py-1.5 rounded-md text-[13px] font-semibold transition-all ${
                    selectedPeriod === key
                      ? 'bg-white text-gray-900 shadow-sm'
                      : supported
                      ? 'text-gray-500 hover:text-gray-700'
                      : 'text-gray-300 cursor-not-allowed'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {/* 우측: 시간 + 수집 버튼 */}
          <div className="flex items-center gap-3">
            {ageText && (
              <span className="text-xs text-gray-400">{ageText} 수집</span>
            )}
            {selectedChannel !== 'all' ? (
              <button
                onClick={() => triggerChannelScrape(selectedChannel as ChannelId)}
                disabled={isCurrentScraping}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #3B6FF6 0%, #5B8FF9 100%)' }}
              >
                {isCurrentScraping ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <RefreshCw size={12} />
                )}
                {activeChannelMeta?.label} 수집
              </button>
            ) : (
              <button
                onClick={triggerScrape}
                disabled={isScraping}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-50"
                style={{
                  background: isScraping
                    ? '#9db8f8'
                    : 'linear-gradient(135deg, #3B6FF6 0%, #5B8FF9 100%)',
                }}
              >
                {isScraping ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <RefreshCw size={12} />
                )}
                전체 수집
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── 메인 컨텐츠 ──────────────────────────────────────────── */}
      {isLoading && !data ? (
        <div className="flex items-center justify-center h-64 gap-3 text-gray-400">
          <Loader2 size={20} className="animate-spin" />
          <span>데이터를 불러오는 중...</span>
        </div>
      ) : !data ? (
        <div className="bg-white rounded-2xl flex flex-col items-center justify-center h-52 gap-3 text-gray-400" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <p className="text-base font-medium">수집된 데이터가 없습니다</p>
          <p className="text-sm">상단의 수집 버튼을 눌러 데이터를 가져오세요</p>
          <button
            onClick={triggerScrape}
            disabled={isScraping}
            className="mt-2 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #3B6FF6 0%, #5B8FF9 100%)' }}
          >
            {isScraping ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            전체 수집 시작
          </button>
        </div>
      ) : (
        <div className="flex gap-4 items-start">

          {/* ── 왼쪽: 오즈키즈 등장 현황 ───────────────────────────── */}
          <div
            className="w-[320px] xl:w-[360px] flex-shrink-0 bg-white rounded-2xl overflow-hidden"
            style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
              <div className="flex items-center gap-2">
                <Award size={15} className="text-amber-400" />
                <span className="font-bold text-gray-900 text-[14px]">오즈키즈 등장 현황</span>
              </div>
              <span className="text-[11px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full font-medium">
                {ozEntries.length}개
              </span>
            </div>

            {/* 리스트 */}
            <div className="divide-y divide-gray-50 overflow-y-auto" style={{ maxHeight: 520 }}>
              {ozEntries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-gray-300">
                  <p className="text-sm font-medium">오즈키즈 미등장</p>
                  <p className="text-xs mt-1">
                    {supportedPeriods.has(selectedPeriod)
                      ? '이 기간에 등장한 제품이 없습니다'
                      : '선택한 기간을 지원하지 않습니다'}
                  </p>
                </div>
              ) : (
                ozEntries.map((entry, i) => {
                  const meta = CHANNEL_META[entry.channelId]
                  return (
                    <div
                      key={`${entry.channelId}-${entry.rank}-${i}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      {/* 번호 */}
                      <span className="w-4 text-center text-xs font-bold text-gray-300 flex-shrink-0">
                        {i + 1}
                      </span>

                      {/* 순위 */}
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-[13px] font-black flex-shrink-0"
                        style={{ backgroundColor: meta.color + '18', color: meta.color }}
                      >
                        {entry.rank}
                      </div>

                      {/* 내용 */}
                      <div className="flex-1 min-w-0">
                        {/* 채널 뱃지 (전체 모드에서만) */}
                        {selectedChannel === 'all' && (
                          <span
                            className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded mb-0.5"
                            style={{ backgroundColor: meta.color + '18', color: meta.color }}
                          >
                            {meta.label}
                          </span>
                        )}
                        <p className="text-[13px] font-semibold text-gray-900 leading-tight truncate">
                          {entry.productName}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {entry.price > 0 ? `${entry.price.toLocaleString()}원` : '—'}
                        </p>
                      </div>

                      {/* 순위 변동 */}
                      <div className="flex-shrink-0 w-9 text-right">
                        <RankDelta delta={entry.rankDelta} isNew={entry.isNew} />
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* ── 오른쪽: 전체 채널 현황 OR 상품 랭킹 ─────────────────── */}
          <div className="flex-1 min-w-0">

            {/* ─ 전체 모드: 채널별 요약 카드 ─ */}
            {selectedChannel === 'all' ? (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <LayoutGrid size={15} className="text-blue-400" />
                  <span className="font-bold text-gray-900 text-[14px]">채널별 현황</span>
                  <span className="text-[11px] text-gray-400 bg-white px-2 py-0.5 rounded-full" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
                    {PERIOD_LABEL[selectedPeriod]} 기준
                  </span>
                </div>
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                  {CHANNELS.map(ch => (
                    <ChannelSummaryCard
                      key={ch}
                      channelId={ch}
                      snap={getSnap(ch)}
                      period={selectedPeriod}
                      isScraping={!!(isScraping || scrapingChannels[ch])}
                      onSelect={() => setSelectedChannel(ch)}
                      onScrape={(e) => { e.stopPropagation(); triggerChannelScrape(ch) }}
                    />
                  ))}
                </div>
              </div>
            ) : (
              /* ─ 채널 모드: 상품 카드 그리드 ─ */
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: activeChannelMeta?.color }} />
                  <span className="font-bold text-gray-900 text-[14px]">
                    {activeChannelMeta?.label} 랭킹 Best
                  </span>
                  {rightSnap && !rightSnap.error && (
                    <span className="text-[11px] text-gray-400 bg-white px-2 py-0.5 rounded-full" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
                      {rightSnap.products.length}개 수집
                    </span>
                  )}
                </div>

                {!rightSnap || (rightSnap.error && rightSnap.products.length === 0) ? (
                  <div
                    className="bg-white rounded-2xl flex items-center justify-center h-48 text-gray-400"
                    style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
                  >
                    <p className="text-sm">
                      {rightSnap?.error ?? (isCurrentScraping ? '수집 중...' : '데이터 없음')}
                    </p>
                  </div>
                ) : (
                  <div
                    className="grid gap-3 overflow-y-auto pr-0.5"
                    style={{
                      gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))',
                      maxHeight: 560,
                    }}
                  >
                    {rightSnap.products.slice(0, 60).map((product) => (
                      <ProductCard
                        key={`${product.rank}-${product.productName}`}
                        product={product}
                        channelId={selectedChannel as ChannelId}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
