import { useState, useMemo } from 'react'
import { RefreshCw, Loader2, ExternalLink, Award, LayoutGrid, ChevronRight } from 'lucide-react'
import { useRankingStore } from '../store/useRankingStore'
import { useRankingData } from '../hooks/useRankingData'
import { CHANNEL_META, PERIOD_LABEL, type ChannelId, type PeriodKey, type OzKidsEntry, type RankingSnapshot } from '../types'

type ChannelFilter = 'all' | ChannelId
type OzEntry = OzKidsEntry & { channelId: ChannelId }

const CHANNELS: ChannelId[] = ['coupang', 'smartstore', 'musinsa', 'boribori', 'lotteon', 'kakao']

const PERIOD_TABS: { key: PeriodKey; label: string }[] = [
  { key: 'realtime', label: '실시간' },
  { key: 'daily',    label: '일간' },
  { key: 'weekly',   label: '주간' },
  { key: 'monthly',  label: '월간' },
]

// 채널별 로고 뱃지 텍스트 + 색상
const CHANNEL_LOGO: Record<ChannelId, { text: string; bg: string; textColor: string }> = {
  coupang:    { text: 'coupang', bg: '#E52222', textColor: '#fff' },
  smartstore: { text: 'N+',      bg: '#03C75A', textColor: '#fff' },
  musinsa:    { text: 'M',       bg: '#1A1A1A', textColor: '#fff' },
  boribori:   { text: 'bori',    bg: '#FF6B9D', textColor: '#fff' },
  lotteon:    { text: 'lotte',   bg: '#E60012', textColor: '#fff' },
  kakao:      { text: 'kakao',   bg: '#FEE500', textColor: '#3A1D00' },
}

function RankDelta({ delta, isNew }: { delta: number | null; isNew: boolean }) {
  if (isNew) return (
    <span className="text-[9px] font-extrabold text-purple-600 bg-purple-50 border border-purple-100 px-1.5 py-0.5 rounded leading-none">
      NEW
    </span>
  )
  if (delta === null || delta === 0) return <span className="text-gray-300 text-xs">—</span>
  if (delta > 0) return <span className="text-emerald-500 text-[11px] font-bold">▲{delta}</span>
  return <span className="text-red-400 text-[11px] font-bold">▼{Math.abs(delta)}</span>
}

function ChannelLogoTab({
  channelId,
  isActive,
  hasOz,
  onClick,
}: {
  channelId: ChannelId
  isActive: boolean
  hasOz: boolean
  onClick: () => void
}) {
  const meta = CHANNEL_META[channelId]
  const logo = CHANNEL_LOGO[channelId]

  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 transition-all flex-shrink-0 ${
        isActive
          ? 'border-gray-900 bg-white shadow-md'
          : 'border-gray-200 bg-white hover:border-gray-400 hover:shadow-sm'
      }`}
    >
      {/* 브랜드 로고 뱃지 */}
      <div
        className="flex items-center justify-center rounded-md flex-shrink-0 font-black text-[11px] tracking-tight"
        style={{
          backgroundColor: logo.bg,
          color: logo.textColor,
          padding: logo.text.length > 2 ? '4px 7px' : '4px 9px',
          fontSize: logo.text.length > 4 ? '9px' : '11px',
          minWidth: 36,
          height: 26,
        }}
      >
        {logo.text}
      </div>

      {/* 채널명 */}
      <span className={`text-sm font-semibold whitespace-nowrap ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>
        {meta.label}
      </span>

      {/* OZ 등장 표시 */}
      {hasOz && (
        <span
          className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full border-2 border-white"
          style={{ backgroundColor: meta.color }}
        />
      )}
    </button>
  )
}

function ProductCard({ product, channelId }: { product: RankingSnapshot['products'][0]; channelId: ChannelId }) {
  const meta = CHANNEL_META[channelId]
  const isOz = product.isOzKids
  return (
    <div
      className="bg-white rounded-xl overflow-hidden transition-shadow hover:shadow-md cursor-default"
      style={
        isOz
          ? { boxShadow: `0 0 0 2px ${meta.color}, 0 2px 8px rgba(0,0,0,0.08)` }
          : { boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }
      }
    >
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
            이미지 없음
          </div>
        )}
        <div
          className="absolute top-1.5 left-1.5 w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-black shadow"
          style={
            product.rank === 1 ? { backgroundColor: '#F59E0B', color: '#fff' }
            : product.rank === 2 ? { backgroundColor: '#9CA3AF', color: '#fff' }
            : product.rank === 3 ? { backgroundColor: '#F97316', color: '#fff' }
            : isOz ? { backgroundColor: meta.color, color: meta.textColor }
            : { backgroundColor: 'rgba(255,255,255,0.9)', color: '#6B7280' }
          }
        >
          {product.rank}
        </div>
        {isOz && (
          <div
            className="absolute top-1.5 right-1.5 text-[9px] font-black px-1.5 py-0.5 rounded"
            style={{ backgroundColor: meta.color, color: meta.textColor }}
          >
            OZ
          </div>
        )}
      </div>
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
  const logo = CHANNEL_LOGO[channelId]
  const ozEntries = snap?.ozKidsEntries ?? []
  const bestRank = ozEntries[0]?.rank ?? null
  const isUnsupported = snap?.error === '이 채널은 해당 기간을 지원하지 않습니다'
  const isError = !isUnsupported && !!snap?.error && snap.products.length === 0

  return (
    <div
      className="bg-white rounded-2xl border-2 border-gray-100 overflow-hidden cursor-pointer hover:border-gray-300 hover:shadow-md transition-all group"
      onClick={onSelect}
    >
      <div className="h-1 w-full" style={{ backgroundColor: meta.color }} />
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div
              className="flex items-center justify-center rounded-md font-black text-[10px]"
              style={{ backgroundColor: logo.bg, color: logo.textColor, padding: '3px 7px', minWidth: 32, height: 22 }}
            >
              {logo.text}
            </div>
            <span className="font-bold text-gray-900 text-[14px]">{meta.label}</span>
            {isScraping && <Loader2 size={11} className="animate-spin text-gray-400" />}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onScrape}
              disabled={isScraping}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-300 hover:text-gray-500 transition-colors disabled:opacity-40"
            >
              <RefreshCw size={11} />
            </button>
            <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-400 transition-colors" />
          </div>
        </div>

        {isUnsupported ? (
          <p className="text-xs text-gray-300">{PERIOD_LABEL[period]} 미지원</p>
        ) : isError ? (
          <p className="text-xs text-red-400">수집 오류</p>
        ) : isScraping && !snap ? (
          <p className="text-xs text-gray-400">수집 중…</p>
        ) : ozEntries.length > 0 ? (
          <div className="flex items-end gap-2">
            <div className="text-3xl font-black leading-none" style={{ color: meta.color }}>
              #{bestRank}
            </div>
            <div className="pb-0.5 text-xs text-gray-400 leading-tight">
              <p>{ozEntries.length}개 등장</p>
              <p className="text-gray-300">{snap?.products.length ?? 0}개 중</p>
            </div>
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

export function Dashboard() {
  useRankingData()

  const { data, isLoading, isScraping, scrapingChannels, status, triggerScrape, triggerChannelScrape } = useRankingStore()

  const [selectedChannel, setSelectedChannel] = useState<ChannelFilter>('all')
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>('realtime')

  const getSnap = (channelId: ChannelId): RankingSnapshot | null =>
    data?.snapshots.find(s => s.channelId === channelId && s.period === selectedPeriod) ?? null

  const ozEntries: OzEntry[] = useMemo(() => {
    if (!data) return []
    const channels = selectedChannel === 'all' ? CHANNELS : [selectedChannel as ChannelId]
    const all: OzEntry[] = []
    for (const ch of channels) {
      const snap = data.snapshots.find(s => s.channelId === ch && s.period === selectedPeriod)
      for (const e of snap?.ozKidsEntries ?? []) all.push({ ...e, channelId: ch })
    }
    return all.sort((a, b) => a.rank - b.rank)
  }, [data, selectedChannel, selectedPeriod])

  const rightSnap: RankingSnapshot | null = useMemo(() => {
    if (selectedChannel === 'all' || !data) return null
    return data.snapshots.find(s => s.channelId === selectedChannel && s.period === selectedPeriod) ?? null
  }, [data, selectedChannel, selectedPeriod])

  const supportedPeriods: Set<PeriodKey> = useMemo(() => {
    if (selectedChannel === 'all') return new Set(PERIOD_TABS.map(t => t.key))
    return new Set(CHANNEL_META[selectedChannel as ChannelId]?.supportedPeriods ?? [])
  }, [selectedChannel])

  const isCurrentScraping =
    selectedChannel !== 'all'
      ? !!(isScraping || scrapingChannels[selectedChannel as ChannelId])
      : isScraping

  const ageText =
    status?.ageMinutes != null
      ? status.ageMinutes < 1 ? '방금 전'
        : status.ageMinutes < 60 ? `${status.ageMinutes}분 전`
        : `${Math.floor(status.ageMinutes / 60)}시간 전`
      : null

  const activeChannelMeta = selectedChannel !== 'all' ? CHANNEL_META[selectedChannel as ChannelId] : null

  return (
    <div className="space-y-5">

      {/* ═══════════════════════════════════════════════════
          헤더 카드 — 타이틀 + 채널 탭
      ═══════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl px-7 pt-7 pb-5 shadow-sm border border-gray-100">

        {/* 타이틀 */}
        <div className="mb-5">
          <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">랭킹 확인하기</h2>
          <p className="text-sm text-gray-400 mt-1">
            6개 채널의 오즈키즈 제품 순위를 한눈에 확인하세요.
            {ageText && (
              <span className="ml-2 text-gray-300">· {ageText} 수집</span>
            )}
          </p>
        </div>

        {/* ── 채널 탭 ─────────────────────────────────── */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* 전체 탭 */}
          <button
            onClick={() => setSelectedChannel('all')}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 transition-all ${
              selectedChannel === 'all'
                ? 'border-gray-900 bg-white shadow-md'
                : 'border-gray-200 bg-white hover:border-gray-400 hover:shadow-sm'
            }`}
          >
            <div className="flex items-center justify-center rounded-md font-black text-[11px]"
              style={{ backgroundColor: '#3B6FF6', color: '#fff', padding: '4px 9px', minWidth: 36, height: 26 }}
            >
              ALL
            </div>
            <span className={`text-sm font-semibold ${selectedChannel === 'all' ? 'text-gray-900' : 'text-gray-500'}`}>
              전체
            </span>
          </button>

          {CHANNELS.map(ch => {
            const snap = data?.snapshots.find(s => s.channelId === ch && s.period === selectedPeriod)
            const hasOz = (snap?.ozKidsEntries.length ?? 0) > 0
            return (
              <ChannelLogoTab
                key={ch}
                channelId={ch}
                isActive={selectedChannel === ch}
                hasOz={hasOz}
                onClick={() => setSelectedChannel(ch)}
              />
            )
          })}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
          기간 토글 + 수집 버튼
      ═══════════════════════════════════════════════════ */}
      <div className="flex items-center justify-between">
        {/* 기간 토글 */}
        <div className="flex items-center gap-1 bg-white rounded-xl p-1 shadow-sm border border-gray-100">
          {PERIOD_TABS.map(({ key, label }) => {
            const supported = supportedPeriods.has(key)
            return (
              <button
                key={key}
                onClick={() => supported && setSelectedPeriod(key)}
                className={`px-4 py-2 rounded-lg text-[13px] font-semibold transition-all ${
                  selectedPeriod === key
                    ? 'bg-gray-900 text-white shadow-sm'
                    : supported
                    ? 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
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
          onClick={selectedChannel !== 'all'
            ? () => triggerChannelScrape(selectedChannel as ChannelId)
            : triggerScrape
          }
          disabled={isCurrentScraping}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-sm transition-all disabled:opacity-50"
          style={{ background: isCurrentScraping ? '#9db8f8' : 'linear-gradient(135deg, #3B6FF6 0%, #5B8FF9 100%)' }}
        >
          {isCurrentScraping
            ? <Loader2 size={13} className="animate-spin" />
            : <RefreshCw size={13} />
          }
          {selectedChannel !== 'all'
            ? `${activeChannelMeta?.label} 수집`
            : '전체 수집'
          }
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════
          메인 컨텐츠
      ═══════════════════════════════════════════════════ */}
      {isLoading && !data ? (
        <div className="bg-white rounded-2xl flex items-center justify-center h-64 gap-3 text-gray-400 shadow-sm border border-gray-100">
          <Loader2 size={20} className="animate-spin" />
          <span>데이터를 불러오는 중...</span>
        </div>
      ) : !data ? (
        <div className="bg-white rounded-2xl flex flex-col items-center justify-center h-56 gap-3 text-gray-400 shadow-sm border border-gray-100">
          <p className="text-base font-semibold">수집된 데이터가 없습니다</p>
          <p className="text-sm">수집 버튼을 눌러 데이터를 가져오세요</p>
          <button
            onClick={triggerScrape}
            disabled={isScraping}
            className="mt-1 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #3B6FF6 0%, #5B8FF9 100%)' }}
          >
            {isScraping ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            전체 수집 시작
          </button>
        </div>
      ) : (
        <div className="flex gap-4 items-start">

          {/* ── 왼쪽: 오즈키즈 등장 현황 ─────────────────────── */}
          <div
            className="w-[300px] xl:w-[340px] flex-shrink-0 bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
              <div className="flex items-center gap-2">
                <Award size={15} className="text-amber-400" />
                <span className="font-bold text-gray-900 text-[14px]">오즈키즈 등장</span>
              </div>
              <span className="text-[11px] font-semibold text-gray-400 bg-gray-50 px-2.5 py-1 rounded-full">
                {ozEntries.length}개
              </span>
            </div>

            <div className="divide-y divide-gray-50 overflow-y-auto" style={{ maxHeight: 540 }}>
              {ozEntries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-gray-300">
                  <p className="text-sm font-medium">오즈키즈 미등장</p>
                  <p className="text-xs mt-1">
                    {supportedPeriods.has(selectedPeriod)
                      ? '이 기간 등장 없음'
                      : '지원하지 않는 기간'}
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
                      <span className="w-4 text-center text-xs font-bold text-gray-300 flex-shrink-0">{i + 1}</span>

                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-[13px] font-black flex-shrink-0"
                        style={{ backgroundColor: meta.color + '18', color: meta.color }}
                      >
                        {entry.rank}
                      </div>

                      <div className="flex-1 min-w-0">
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

                      <div className="flex-shrink-0 w-9 text-right">
                        <RankDelta delta={entry.rankDelta} isNew={entry.isNew} />
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* ── 오른쪽: 채널 현황 or 상품 그리드 ────────────────── */}
          <div className="flex-1 min-w-0">
            {selectedChannel === 'all' ? (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <LayoutGrid size={14} className="text-gray-400" />
                  <span className="font-bold text-gray-700 text-[14px]">채널별 현황</span>
                  <span className="text-[11px] text-gray-400 bg-white px-2 py-0.5 rounded-full shadow-sm border border-gray-100">
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
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: activeChannelMeta?.color }}
                  />
                  <span className="font-bold text-gray-700 text-[14px]">
                    {activeChannelMeta?.label} 전체 랭킹
                  </span>
                  {rightSnap && !rightSnap.error && (
                    <span className="text-[11px] text-gray-400 bg-white px-2 py-0.5 rounded-full shadow-sm border border-gray-100">
                      {rightSnap.products.length}개
                    </span>
                  )}
                </div>

                {!rightSnap || (rightSnap.error && rightSnap.products.length === 0) ? (
                  <div className="bg-white rounded-2xl flex items-center justify-center h-48 text-gray-400 shadow-sm border border-gray-100">
                    <p className="text-sm">{rightSnap?.error ?? (isCurrentScraping ? '수집 중...' : '데이터 없음')}</p>
                  </div>
                ) : (
                  <div
                    className="grid gap-3 overflow-y-auto"
                    style={{
                      gridTemplateColumns: 'repeat(auto-fill, minmax(145px, 1fr))',
                      maxHeight: 570,
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
              </>
            )}
          </div>

        </div>
      )}
    </div>
  )
}
