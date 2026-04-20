import { useState, useMemo } from 'react'
import { RefreshCw, Loader2, ExternalLink, TrendingUp, TrendingDown, ChevronRight } from 'lucide-react'
import { useRankingStore } from '../store/useRankingStore'
import { useRankingData } from '../hooks/useRankingData'
import { ChannelLogo } from '../components/ChannelLogo'
import { CHANNEL_META, PERIOD_LABEL, type ChannelId, type PeriodKey, type OzKidsEntry, type RankingSnapshot } from '../types'

type ChannelFilter = 'all' | ChannelId
type OzEntry = OzKidsEntry & { channelId: ChannelId }

const CHANNELS: ChannelId[] = ['coupang', 'smartstore', 'musinsa', 'boribori', 'lotteon', 'kakao']
const PERIOD_TABS: { key: PeriodKey; label: string }[] = [
  { key: 'realtime', label: '실시간' },
  { key: 'daily',    label: '일간'   },
  { key: 'weekly',   label: '주간'   },
  { key: 'monthly',  label: '월간'   },
]

// ─── 순위 변동 뱃지 ────────────────────────────────────────────────────
function Delta({ delta, isNew }: { delta: number | null; isNew: boolean }) {
  if (isNew) return (
    <span className="inline-block text-[9px] font-extrabold text-violet-600 bg-violet-50 border border-violet-100 px-1.5 py-0.5 rounded-full leading-none">
      NEW
    </span>
  )
  if (!delta) return <span className="text-gray-300 text-xs">—</span>
  if (delta > 0) return (
    <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-emerald-500">
      <TrendingUp size={10} /> {delta}
    </span>
  )
  return (
    <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-rose-400">
      <TrendingDown size={10} /> {Math.abs(delta)}
    </span>
  )
}

// ─── 상품 이미지 카드 ──────────────────────────────────────────────────
function ProductCard({ product, channelId }: { product: RankingSnapshot['products'][0]; channelId: ChannelId }) {
  const meta = CHANNEL_META[channelId]
  const isOz = product.isOzKids
  return (
    <div
      className="bg-white rounded-xl overflow-hidden hover:shadow-lg transition-all"
      style={
        isOz
          ? { outline: `2px solid ${meta.color}`, boxShadow: `0 4px 16px ${meta.color}22` }
          : { boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #F0F2F5' }
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
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-gray-200 text-xs">no image</span>
          </div>
        )}
        {/* 순위 */}
        <div
          className="absolute top-1.5 left-1.5 min-w-[22px] h-[22px] px-1 rounded-md flex items-center justify-center text-[11px] font-black shadow-sm"
          style={
            product.rank <= 3
              ? { background: ['#F59E0B','#9CA3AF','#F97316'][product.rank - 1], color: '#fff' }
              : isOz
              ? { background: meta.color, color: meta.textColor }
              : { background: 'rgba(255,255,255,0.9)', color: '#6B7280', border: '1px solid #e5e7eb' }
          }
        >
          {product.rank}
        </div>
        {/* OZ 마크 */}
        {isOz && (
          <div
            className="absolute top-1.5 right-1.5 text-[8px] font-black px-1.5 py-0.5 rounded-md"
            style={{ background: meta.color, color: meta.textColor }}
          >
            OZ
          </div>
        )}
      </div>
      {/* 텍스트 */}
      <div className="p-2">
        <p className="text-[10px] text-gray-400 truncate leading-none mb-1">{product.brandName || '—'}</p>
        <p className="text-[11px] font-semibold text-gray-800 leading-tight line-clamp-2 min-h-[2.6em]">
          {product.productName}
        </p>
        <div className="flex items-center justify-between mt-1.5">
          <p className="text-[12px] font-bold" style={{ color: meta.color }}>
            {product.price > 0 ? `${product.price.toLocaleString()}원` : '—'}
          </p>
          {product.productUrl && (
            <a href={product.productUrl} target="_blank" rel="noopener noreferrer"
              className="text-gray-200 hover:text-gray-400 transition-colors">
              <ExternalLink size={11} />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── 채널 요약 카드 (전체 모드) ────────────────────────────────────────
function ChannelSummaryCard({
  channelId, snap, period, isScraping, onSelect, onScrape,
}: {
  channelId: ChannelId
  snap: RankingSnapshot | null
  period: PeriodKey
  isScraping: boolean
  onSelect: () => void
  onScrape: (e: React.MouseEvent) => void
}) {
  const meta = CHANNEL_META[channelId]
  const oz = snap?.ozKidsEntries ?? []
  const isUnsupported = snap?.error === '이 채널은 해당 기간을 지원하지 않습니다'
  const isError = !isUnsupported && !!snap?.error && snap.products.length === 0

  return (
    <div
      className="bg-white rounded-2xl overflow-hidden cursor-pointer group hover:shadow-lg transition-all border border-gray-100"
      style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
      onClick={onSelect}
    >
      {/* 채널 컬러 상단 바 */}
      <div className="h-[3px]" style={{ background: meta.color }} />

      <div className="p-4">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <ChannelLogo channelId={channelId} size="sm" />
            {isScraping && <Loader2 size={11} className="animate-spin text-gray-400" />}
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={onScrape}
              disabled={isScraping}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors disabled:opacity-40"
            >
              <RefreshCw size={11} />
            </button>
            <ChevronRight size={13} className="text-gray-300" />
          </div>
        </div>

        {/* 데이터 */}
        {isUnsupported ? (
          <p className="text-xs text-gray-300">{PERIOD_LABEL[period]} 미지원</p>
        ) : isError ? (
          <p className="text-xs text-rose-400">수집 오류</p>
        ) : isScraping && !snap ? (
          <p className="text-xs text-gray-400 animate-pulse">수집 중…</p>
        ) : oz.length > 0 ? (
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black leading-none" style={{ color: meta.color }}>
                #{oz[0].rank}
              </span>
              <div className="text-xs text-gray-400 leading-tight">
                <p className="font-semibold text-gray-600">{oz.length}개 등장</p>
                <p className="text-gray-300">{snap?.products.length ?? 0}개 중</p>
              </div>
            </div>
            {/* 최상위 제품명 */}
            <p className="text-[11px] text-gray-500 mt-2 truncate leading-tight">
              {oz[0].productName}
            </p>
          </div>
        ) : (
          <div>
            <p className="text-sm font-semibold text-gray-400">미등장</p>
            <p className="text-xs text-gray-300 mt-0.5">{snap?.products.length ?? 0}개 수집됨</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// 메인 대시보드
// ═══════════════════════════════════════════════════════════════════════
export function Dashboard() {
  useRankingData()

  const {
    data, isLoading, isScraping, scrapingChannels, status,
    triggerScrape, triggerChannelScrape,
  } = useRankingStore()

  const [selectedChannel, setSelectedChannel] = useState<ChannelFilter>('all')
  const [selectedPeriod, setSelectedPeriod]   = useState<PeriodKey>('realtime')

  const getSnap = (ch: ChannelId) =>
    data?.snapshots.find(s => s.channelId === ch && s.period === selectedPeriod) ?? null

  // OZ 등장 목록
  const ozEntries: OzEntry[] = useMemo(() => {
    if (!data) return []
    const chs = selectedChannel === 'all' ? CHANNELS : [selectedChannel as ChannelId]
    const out: OzEntry[] = []
    for (const ch of chs) {
      const snap = data.snapshots.find(s => s.channelId === ch && s.period === selectedPeriod)
      for (const e of snap?.ozKidsEntries ?? []) out.push({ ...e, channelId: ch })
    }
    return out.sort((a, b) => a.rank - b.rank)
  }, [data, selectedChannel, selectedPeriod])

  // 오른쪽 패널 스냅샷
  const rightSnap = useMemo<RankingSnapshot | null>(() => {
    if (selectedChannel === 'all' || !data) return null
    return data.snapshots.find(s => s.channelId === selectedChannel && s.period === selectedPeriod) ?? null
  }, [data, selectedChannel, selectedPeriod])

  // 선택 채널 지원 기간
  const supportedPeriods = useMemo(() => {
    if (selectedChannel === 'all') return new Set(PERIOD_TABS.map(t => t.key))
    return new Set(CHANNEL_META[selectedChannel as ChannelId]?.supportedPeriods ?? [])
  }, [selectedChannel])

  const isCurrentScraping =
    selectedChannel !== 'all'
      ? !!(isScraping || scrapingChannels[selectedChannel as ChannelId])
      : isScraping

  const ageText = status?.ageMinutes != null
    ? status.ageMinutes < 1 ? '방금 전'
      : status.ageMinutes < 60 ? `${status.ageMinutes}분 전`
      : `${Math.floor(status.ageMinutes / 60)}시간 전`
    : null

  return (
    <div className="space-y-4">

      {/* ════════════════════════════════════════════════════════
          헤더 카드 — 타이틀 + 채널 탭
      ════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl shadow-sm" style={{ border: '1px solid #EAECF0' }}>
        <div className="px-7 pt-6 pb-0">
          {/* 타이틀 */}
          <div className="flex items-end justify-between mb-5">
            <div>
              <h2 className="text-[22px] font-extrabold text-gray-900 tracking-tight leading-tight">
                랭킹 확인하기
              </h2>
              <p className="text-[13px] text-gray-400 mt-1">
                6개 채널의 오즈키즈 제품 순위를 한눈에 확인하세요.
                {ageText && <span className="text-gray-300 ml-1.5">· {ageText} 수집</span>}
              </p>
            </div>
          </div>

          {/* ── 채널 탭 (sellha.kr 스타일 하단 보더 탭) ── */}
          <div className="flex items-end gap-0 overflow-x-auto" style={{ borderBottom: '1.5px solid #F0F2F5' }}>

            {/* 전체 탭 */}
            <button
              onClick={() => setSelectedChannel('all')}
              className="flex items-center gap-2.5 px-5 py-3.5 flex-shrink-0 transition-all relative"
              style={{
                borderBottom: selectedChannel === 'all' ? '2.5px solid #111827' : '2.5px solid transparent',
                marginBottom: -1.5,
              }}
            >
              <span
                className="inline-flex items-center justify-center rounded-md font-black text-white text-[11px]"
                style={{ background: '#3B6FF6', height: 24, minWidth: 36, padding: '0 8px' }}
              >
                ALL
              </span>
              <span className={`text-[13px] font-semibold whitespace-nowrap ${selectedChannel === 'all' ? 'text-gray-900' : 'text-gray-500'}`}>
                전체
              </span>
              {/* OZ 등장 수 뱃지 */}
              {data && selectedChannel !== 'all' && (() => {
                const total = CHANNELS.reduce((acc, ch) => {
                  const s = getSnap(ch)
                  return acc + (s?.ozKidsEntries.length ?? 0)
                }, 0)
                return total > 0 ? (
                  <span className="ml-0.5 text-[10px] font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-full">
                    {total}
                  </span>
                ) : null
              })()}
            </button>

            {CHANNELS.map(ch => {
              const snap = data?.snapshots.find(s => s.channelId === ch && s.period === selectedPeriod)
              const hasOz = (snap?.ozKidsEntries.length ?? 0) > 0
              const isActive = selectedChannel === ch
              return (
                <button
                  key={ch}
                  onClick={() => setSelectedChannel(ch)}
                  className="flex items-center gap-2.5 px-5 py-3.5 flex-shrink-0 transition-all relative"
                  style={{
                    borderBottom: isActive ? `2.5px solid ${CHANNEL_META[ch].color}` : '2.5px solid transparent',
                    marginBottom: -1.5,
                  }}
                >
                  <ChannelLogo channelId={ch} size="sm" />
                  <span className={`text-[13px] font-semibold whitespace-nowrap ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                    {CHANNEL_META[ch].label}
                  </span>
                  {/* OZ 등장 점 */}
                  {hasOz && (
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: CHANNEL_META[ch].color }}
                    />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── 기간 탭 + 수집 버튼 ─────────────────────────────── */}
        <div className="flex items-center justify-between px-7 py-3">
          {/* 기간 토글 */}
          <div className="flex items-center gap-0.5 bg-gray-50 rounded-xl p-1" style={{ border: '1px solid #EAECF0' }}>
            {PERIOD_TABS.map(({ key, label }) => {
              const supported = supportedPeriods.has(key)
              const active = selectedPeriod === key
              return (
                <button
                  key={key}
                  onClick={() => supported && setSelectedPeriod(key)}
                  className={`px-4 py-2 rounded-lg text-[12px] font-semibold transition-all ${
                    active
                      ? 'bg-gray-900 text-white shadow-sm'
                      : supported
                      ? 'text-gray-500 hover:text-gray-800 hover:bg-white'
                      : 'text-gray-300 cursor-not-allowed'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {/* 수집 버튼 */}
          <button
            onClick={
              selectedChannel !== 'all'
                ? () => triggerChannelScrape(selectedChannel as ChannelId)
                : triggerScrape
            }
            disabled={isCurrentScraping}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-semibold text-white transition-all disabled:opacity-50"
            style={{
              background: isCurrentScraping
                ? '#93c5fd'
                : 'linear-gradient(135deg, #3B6FF6 0%, #5B8FF9 100%)',
              boxShadow: '0 2px 8px rgba(59,111,246,0.3)',
            }}
          >
            {isCurrentScraping ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {selectedChannel !== 'all'
              ? `${CHANNEL_META[selectedChannel as ChannelId]?.label} 수집`
              : '전체 수집'
            }
          </button>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          메인 컨텐츠
      ════════════════════════════════════════════════════════ */}
      {isLoading && !data ? (
        <div className="bg-white rounded-2xl flex items-center justify-center h-64 gap-3 text-gray-400"
          style={{ border: '1px solid #EAECF0' }}>
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">데이터를 불러오는 중...</span>
        </div>

      ) : !data ? (
        <div className="bg-white rounded-2xl flex flex-col items-center justify-center h-56 gap-3 text-gray-400"
          style={{ border: '1px solid #EAECF0' }}>
          <p className="text-base font-semibold text-gray-600">수집된 데이터가 없습니다</p>
          <p className="text-sm text-gray-400">수집 버튼을 눌러 데이터를 가져오세요</p>
          <button
            onClick={triggerScrape}
            disabled={isScraping}
            className="mt-2 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #3B6FF6 0%, #5B8FF9 100%)' }}
          >
            {isScraping ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            전체 수집 시작
          </button>
        </div>

      ) : (
        <div className="flex gap-4 items-start">

          {/* ── 왼쪽: 오즈키즈 등장 현황 ─────────────────────── */}
          <div className="w-[288px] xl:w-[320px] flex-shrink-0 bg-white rounded-2xl overflow-hidden"
            style={{ border: '1px solid #EAECF0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>

            {/* 패널 헤더 */}
            <div className="flex items-center justify-between px-5 py-3.5"
              style={{ borderBottom: '1px solid #F5F6F8' }}>
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-bold text-gray-900">🏆 오즈키즈 등장</span>
              </div>
              <span className="text-[11px] font-semibold text-gray-400 bg-gray-50 px-2.5 py-1 rounded-full"
                style={{ border: '1px solid #EAECF0' }}>
                {ozEntries.length}개
              </span>
            </div>

            {/* 등장 리스트 */}
            <div className="overflow-y-auto" style={{ maxHeight: 520 }}>
              {ozEntries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 gap-2 text-gray-300">
                  <span className="text-2xl">📭</span>
                  <p className="text-sm font-medium text-gray-400">오즈키즈 미등장</p>
                  <p className="text-xs">
                    {supportedPeriods.has(selectedPeriod) ? '이 기간 데이터 없음' : '지원하지 않는 기간'}
                  </p>
                </div>
              ) : (
                <div className="divide-y" style={{ '--tw-divide-opacity': 1 } as any}>
                  {ozEntries.map((entry, i) => {
                    const meta = CHANNEL_META[entry.channelId]
                    return (
                      <div
                        key={`${entry.channelId}-${entry.rank}-${i}`}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                      >
                        {/* 순서 번호 */}
                        <span className="w-4 text-center text-[11px] font-bold text-gray-300 flex-shrink-0">
                          {i + 1}
                        </span>

                        {/* 순위 뱃지 */}
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-[13px] font-black flex-shrink-0"
                          style={{ background: meta.color + '15', color: meta.color }}
                        >
                          {entry.rank}
                        </div>

                        {/* 내용 */}
                        <div className="flex-1 min-w-0">
                          {selectedChannel === 'all' && (
                            <span
                              className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-full mb-0.5"
                              style={{ background: meta.color + '15', color: meta.color }}
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
                          <Delta delta={entry.rankDelta} isNew={entry.isNew} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── 오른쪽 ──────────────────────────────────────────── */}
          <div className="flex-1 min-w-0">

            {/* 전체 모드: 채널별 요약 카드 */}
            {selectedChannel === 'all' ? (
              <div>
                <p className="text-[12px] font-semibold text-gray-400 mb-3 pl-1">
                  채널별 현황 &nbsp;·&nbsp; <span className="text-gray-300">{PERIOD_LABEL[selectedPeriod]} 기준</span>
                </p>
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
              /* 채널 모드: 상품 이미지 카드 그리드 */
              <div>
                <div className="flex items-center gap-2 mb-3 pl-1">
                  <ChannelLogo channelId={selectedChannel as ChannelId} size="sm" />
                  <span className="text-[13px] font-bold text-gray-700">전체 랭킹</span>
                  {rightSnap && !rightSnap.error && (
                    <span className="text-[11px] text-gray-400 bg-white px-2 py-0.5 rounded-full"
                      style={{ border: '1px solid #EAECF0' }}>
                      {rightSnap.products.length}개
                    </span>
                  )}
                </div>

                {!rightSnap || (rightSnap.error && rightSnap.products.length === 0) ? (
                  <div className="bg-white rounded-2xl flex items-center justify-center h-48 text-gray-400"
                    style={{ border: '1px solid #EAECF0' }}>
                    <p className="text-sm">{rightSnap?.error ?? (isCurrentScraping ? '수집 중...' : '데이터 없음')}</p>
                  </div>
                ) : (
                  <div
                    className="grid gap-2.5 overflow-y-auto pr-0.5"
                    style={{
                      gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                      maxHeight: 570,
                    }}
                  >
                    {rightSnap.products.slice(0, 60).map(product => (
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
