import { useState, useMemo } from 'react'
import { RefreshCw, Loader2, ExternalLink } from 'lucide-react'
import { useRankingStore } from '../store/useRankingStore'
import { useRankingData } from '../hooks/useRankingData'
import { ChannelLogo } from '../components/ChannelLogo'
import { CHANNEL_META, PERIOD_LABEL, type ChannelId, type PeriodKey, type RankingSnapshot, type OzKidsEntry } from '../types'

type ChannelFilter = 'all' | ChannelId
type OzEntry = OzKidsEntry & { channelId: ChannelId }

const CHANNELS: ChannelId[] = ['coupang', 'smartstore', 'musinsa', 'boribori', 'lotteon', 'kakao']
const PERIOD_TABS: { key: PeriodKey; label: string }[] = [
  { key: 'realtime', label: '실시간' },
  { key: 'daily',    label: '일간'   },
  { key: 'weekly',   label: '주간'   },
  { key: 'monthly',  label: '월간'   },
]

// ─────────────────────────────────────────────────────────────────
// 소형 컴포넌트들
// ─────────────────────────────────────────────────────────────────

function Delta({ delta, isNew }: { delta: number | null; isNew: boolean }) {
  if (isNew) return (
    <span className="text-[9px] font-black text-violet-500 bg-violet-50 px-1 py-0.5 rounded leading-none">NEW</span>
  )
  if (!delta) return <span className="text-gray-300 text-xs leading-none">—</span>
  if (delta > 0) return <span className="text-emerald-500 text-[11px] font-bold leading-none">▲{delta}</span>
  return <span className="text-rose-400 text-[11px] font-bold leading-none">▼{Math.abs(delta)}</span>
}

// 패널 하나의 상품 행
function ProductRow({
  rank, delta, isNew, productName, price, imageUrl, productUrl, channelId, showChannel,
}: {
  rank: number; delta: number | null; isNew: boolean
  productName: string; price: number; imageUrl?: string; productUrl?: string
  channelId: ChannelId; showChannel: boolean
}) {
  const meta = CHANNEL_META[channelId]
  return (
    <div className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-gray-50 transition-colors group">
      {/* 순위 + 변동 */}
      <div className="flex-shrink-0 w-[52px]">
        <p className="text-[15px] font-black leading-none" style={{ color: meta.color }}>
          #{rank}
        </p>
        <div className="mt-0.5">
          <Delta delta={delta} isNew={isNew} />
        </div>
      </div>

      {/* 채널 뱃지 (전체 모드) */}
      {showChannel && (
        <div className="flex-shrink-0">
          <ChannelLogo channelId={channelId} size="sm" />
        </div>
      )}

      {/* 썸네일 */}
      <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="w-full h-full object-cover"
            loading="lazy" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-gray-300 text-[9px]">no img</span>
          </div>
        )}
      </div>

      {/* 제품 정보 */}
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold text-gray-800 truncate leading-tight">{productName}</p>
        <p className="text-[11px] font-bold mt-0.5 leading-none" style={{ color: meta.color }}>
          {price > 0 ? `${price.toLocaleString()}원` : '—'}
        </p>
      </div>

      {/* 링크 */}
      {productUrl && (
        <a href={productUrl} target="_blank" rel="noopener noreferrer"
          className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-gray-500">
          <ExternalLink size={12} />
        </a>
      )}
    </div>
  )
}

// 패널 래퍼
function Panel({
  title, borderColor, children, count, scrollable = false,
}: {
  title: string; borderColor: string; children: React.ReactNode
  count?: number; scrollable?: boolean
}) {
  return (
    <div className="bg-white rounded-2xl overflow-hidden flex flex-col"
      style={{ border: '1px solid #EAECF0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', borderLeft: `4px solid ${borderColor}` }}>
      <div className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid #F0F2F5' }}>
        <span className="text-[13px] font-bold text-gray-800">{title}</span>
        {count !== undefined && (
          <span className="text-[11px] font-semibold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full"
            style={{ border: '1px solid #EAECF0' }}>
            {count}개
          </span>
        )}
      </div>
      <div className={`flex-1 divide-y divide-gray-50 ${scrollable ? 'overflow-y-auto' : ''}`}
        style={scrollable ? { maxHeight: 360 } : {}}>
        {children}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// 메인 대시보드
// ─────────────────────────────────────────────────────────────────
export function Dashboard() {
  useRankingData()

  const {
    data, isLoading, isScraping, scrapingChannels, status,
    triggerScrape, triggerChannelScrape,
  } = useRankingStore()

  const [selectedChannel, setSelectedChannel] = useState<ChannelFilter>('all')
  const [selectedPeriod,  setSelectedPeriod]  = useState<PeriodKey>('realtime')

  const getSnap = (ch: ChannelId): RankingSnapshot | null =>
    data?.snapshots.find(s => s.channelId === ch && s.period === selectedPeriod) ?? null

  // 전체 OZ Kids 등장 (선택 채널 기준)
  const allOzEntries: OzEntry[] = useMemo(() => {
    if (!data) return []
    const chs = selectedChannel === 'all' ? CHANNELS : [selectedChannel as ChannelId]
    const out: OzEntry[] = []
    for (const ch of chs) {
      const snap = data.snapshots.find(s => s.channelId === ch && s.period === selectedPeriod)
      for (const e of snap?.ozKidsEntries ?? []) out.push({ ...e, channelId: ch })
    }
    return out.sort((a, b) => a.rank - b.rank)
  }, [data, selectedChannel, selectedPeriod])

  // 신규 진입
  const newEntries = useMemo(() => allOzEntries.filter(e => e.isNew), [allOzEntries])

  // 순위 상승 TOP
  const risingEntries = useMemo(() =>
    [...allOzEntries]
      .filter(e => e.rankDelta && e.rankDelta > 0)
      .sort((a, b) => (b.rankDelta ?? 0) - (a.rankDelta ?? 0))
      .slice(0, 10),
    [allOzEntries]
  )

  // 오른쪽: 전체 랭킹 (채널 모드)
  const rightSnap: RankingSnapshot | null = useMemo(() => {
    if (selectedChannel === 'all' || !data) return null
    return data.snapshots.find(s => s.channelId === selectedChannel && s.period === selectedPeriod) ?? null
  }, [data, selectedChannel, selectedPeriod])

  // 지원 기간
  const supportedPeriods = useMemo(() => {
    if (selectedChannel === 'all') return new Set(PERIOD_TABS.map(t => t.key))
    return new Set(CHANNEL_META[selectedChannel as ChannelId]?.supportedPeriods ?? [])
  }, [selectedChannel])

  const isCurrentScraping =
    selectedChannel !== 'all'
      ? !!(isScraping || scrapingChannels[selectedChannel as ChannelId])
      : isScraping

  const now = new Date()
  const dateStr = now.toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
  })

  const ageText = status?.ageMinutes != null
    ? status.ageMinutes < 1 ? '방금 전'
      : status.ageMinutes < 60 ? `${status.ageMinutes}분 전`
      : `${Math.floor(status.ageMinutes / 60)}시간 전`
    : null

  const activeChannelMeta = selectedChannel !== 'all' ? CHANNEL_META[selectedChannel as ChannelId] : null

  return (
    <div className="flex flex-col min-h-screen">

      {/* ═══════════════════════════════════════════════════════
          상단 헤더
      ═══════════════════════════════════════════════════════ */}
      <div className="bg-white px-8 pt-6 pb-0" style={{ borderBottom: '1px solid #EAECF0' }}>
        {/* 타이틀 행 */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-[22px] font-extrabold text-gray-900 tracking-tight">랭킹 분석</h1>
            <p className="text-[13px] text-gray-400 mt-0.5">오즈키즈 채널별 랭킹 실시간 모니터링</p>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <span className="text-[12px] text-gray-400">{dateStr}</span>
            {ageText && <span className="text-[11px] text-gray-300">· {ageText} 수집</span>}
            <button
              onClick={selectedChannel !== 'all' ? () => triggerChannelScrape(selectedChannel as ChannelId) : triggerScrape}
              disabled={isCurrentScraping}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold text-white transition-all disabled:opacity-50"
              style={{ background: isCurrentScraping ? '#93c5fd' : 'linear-gradient(135deg, #3B6FF6 0%, #5B8FF9 100%)' }}
            >
              {isCurrentScraping ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              새로고침
            </button>
          </div>
        </div>

        {/* 채널 탭 */}
        <div className="flex items-end gap-0 overflow-x-auto" style={{ borderBottom: '2px solid transparent' }}>
          {/* 전체 */}
          <button
            onClick={() => setSelectedChannel('all')}
            className="flex items-center gap-2 px-5 py-3 flex-shrink-0 text-[13px] font-semibold transition-all relative"
            style={{
              color: selectedChannel === 'all' ? '#111827' : '#9CA3AF',
              borderBottom: selectedChannel === 'all' ? '2.5px solid #111827' : '2.5px solid transparent',
              marginBottom: -2,
            }}
          >
            전체
          </button>

          {CHANNELS.map(ch => {
            const snap = data?.snapshots.find(s => s.channelId === ch && s.period === selectedPeriod)
            const hasOz = (snap?.ozKidsEntries.length ?? 0) > 0
            const isActive = selectedChannel === ch
            return (
              <button
                key={ch}
                onClick={() => setSelectedChannel(ch)}
                className="flex items-center gap-2 px-4 py-3 flex-shrink-0 transition-all"
                style={{
                  borderBottom: isActive ? `2.5px solid ${CHANNEL_META[ch].color}` : '2.5px solid transparent',
                  marginBottom: -2,
                  color: isActive ? '#111827' : '#9CA3AF',
                }}
              >
                <ChannelLogo channelId={ch} size="sm" />
                <span className="text-[13px] font-semibold whitespace-nowrap">
                  {CHANNEL_META[ch].label}
                </span>
                {hasOz && (
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: CHANNEL_META[ch].color }} />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          기간 필터
      ═══════════════════════════════════════════════════════ */}
      <div className="bg-white flex items-center gap-4 px-8 py-3" style={{ borderBottom: '1px solid #F0F2F5' }}>
        <span className="text-[12px] text-gray-500 font-medium whitespace-nowrap">기간 기준</span>
        <div className="flex items-center gap-0.5">
          {PERIOD_TABS.map(({ key, label }) => {
            const supported = supportedPeriods.has(key)
            const active = selectedPeriod === key
            return (
              <button
                key={key}
                onClick={() => supported && setSelectedPeriod(key)}
                className={`px-3.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                  active ? 'bg-gray-900 text-white' :
                  supported ? 'text-gray-500 hover:bg-gray-100' :
                  'text-gray-300 cursor-not-allowed'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
        {activeChannelMeta && (
          <span className="text-[11px] text-gray-400 ml-2">
            {activeChannelMeta.label} 기준
          </span>
        )}
        <div className="ml-auto text-[11px] text-gray-400">
          OZ 등장: <span className="font-bold text-gray-700">{allOzEntries.length}개</span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          메인 콘텐츠
      ═══════════════════════════════════════════════════════ */}
      <div className="flex-1 px-8 py-5 space-y-4">

        {isLoading && !data ? (
          <div className="bg-white rounded-2xl flex items-center justify-center h-64 gap-3 text-gray-400"
            style={{ border: '1px solid #EAECF0' }}>
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">데이터를 불러오는 중...</span>
          </div>

        ) : !data ? (
          <div className="bg-white rounded-2xl flex flex-col items-center justify-center h-56 gap-3"
            style={{ border: '1px solid #EAECF0' }}>
            <p className="text-base font-semibold text-gray-500">수집된 데이터가 없습니다</p>
            <p className="text-sm text-gray-400">새로고침 버튼으로 데이터를 수집하세요</p>
            <button onClick={triggerScrape} disabled={isScraping}
              className="mt-2 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #3B6FF6 0%, #5B8FF9 100%)' }}>
              {isScraping ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              전체 수집 시작
            </button>
          </div>

        ) : selectedChannel === 'all' ? (
          /* ── 전체 모드: 4패널 ── */
          <div className="grid grid-cols-4 gap-4">

            {/* 패널 1: 오즈키즈 등장 TOP */}
            <Panel title="오즈키즈 등장 TOP" borderColor="#FF5043" count={allOzEntries.length} scrollable>
              {allOzEntries.length === 0 ? (
                <div className="flex items-center justify-center py-10 text-gray-300 text-sm">미등장</div>
              ) : allOzEntries.map((e, i) => (
                <ProductRow key={`${e.channelId}-${e.rank}-${i}`}
                  rank={e.rank} delta={e.rankDelta} isNew={e.isNew}
                  productName={e.productName} price={e.price}
                  channelId={e.channelId} showChannel={true} />
              ))}
            </Panel>

            {/* 패널 2: 신규 진입 */}
            <Panel title="신규 진입 TOP" borderColor="#8B5CF6" count={newEntries.length} scrollable>
              {newEntries.length === 0 ? (
                <div className="flex items-center justify-center py-10 text-gray-300 text-sm">신규 없음</div>
              ) : newEntries.map((e, i) => (
                <ProductRow key={`new-${e.channelId}-${e.rank}-${i}`}
                  rank={e.rank} delta={e.rankDelta} isNew={e.isNew}
                  productName={e.productName} price={e.price}
                  channelId={e.channelId} showChannel={true} />
              ))}
            </Panel>

            {/* 패널 3: 순위 상승 TOP */}
            <Panel title="순위 상승 TOP" borderColor="#10B981" count={risingEntries.length} scrollable>
              {risingEntries.length === 0 ? (
                <div className="flex items-center justify-center py-10 text-gray-300 text-sm">상승 없음</div>
              ) : risingEntries.map((e, i) => (
                <ProductRow key={`rise-${e.channelId}-${e.rank}-${i}`}
                  rank={e.rank} delta={e.rankDelta} isNew={e.isNew}
                  productName={e.productName} price={e.price}
                  channelId={e.channelId} showChannel={true} />
              ))}
            </Panel>

            {/* 패널 4: 채널별 현황 요약 */}
            <Panel title="채널별 현황" borderColor="#3B6FF6">
              {CHANNELS.map(ch => {
                const snap = getSnap(ch)
                const oz = snap?.ozKidsEntries ?? []
                const meta = CHANNEL_META[ch]
                const isUnsupported = snap?.error === '이 채널은 해당 기간을 지원하지 않습니다'
                const isError = !isUnsupported && !!snap?.error && snap.products.length === 0
                return (
                  <div
                    key={ch}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => setSelectedChannel(ch)}
                  >
                    <ChannelLogo channelId={ch} size="sm" />
                    <div className="flex-1 min-w-0">
                      {isUnsupported ? (
                        <p className="text-[11px] text-gray-300">기간 미지원</p>
                      ) : isError ? (
                        <p className="text-[11px] text-rose-400">수집 오류</p>
                      ) : oz.length > 0 ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13px] font-black" style={{ color: meta.color }}>#{oz[0].rank}</span>
                          <span className="text-[11px] text-gray-500">{oz.length}개 등장</span>
                        </div>
                      ) : (
                        <p className="text-[11px] text-gray-400">미등장 · {snap?.products.length ?? 0}개 수집</p>
                      )}
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); triggerChannelScrape(ch) }}
                      disabled={!!(isScraping || scrapingChannels[ch])}
                      className="p-1 rounded-lg hover:bg-gray-100 text-gray-300 transition-colors disabled:opacity-40"
                    >
                      {scrapingChannels[ch]
                        ? <Loader2 size={11} className="animate-spin" />
                        : <RefreshCw size={11} />
                      }
                    </button>
                  </div>
                )
              })}
            </Panel>
          </div>

        ) : (
          /* ── 채널 모드: 2+2 패널 ── */
          <div className="grid grid-cols-4 gap-4">

            {/* 패널 1: OZ 등장 */}
            <Panel
              title={`${activeChannelMeta?.label} OZ 등장`}
              borderColor={activeChannelMeta?.color ?? '#FF5043'}
              count={allOzEntries.length}
              scrollable
            >
              {allOzEntries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-300 gap-1">
                  <p className="text-sm">미등장</p>
                  <p className="text-xs">{PERIOD_LABEL[selectedPeriod]} 기준</p>
                </div>
              ) : allOzEntries.map((e, i) => (
                <ProductRow key={`${e.rank}-${i}`}
                  rank={e.rank} delta={e.rankDelta} isNew={e.isNew}
                  productName={e.productName} price={e.price}
                  channelId={selectedChannel as ChannelId} showChannel={false} />
              ))}
            </Panel>

            {/* 패널 2: 신규 진입 */}
            <Panel title="신규 진입" borderColor="#8B5CF6" count={newEntries.length} scrollable>
              {newEntries.length === 0 ? (
                <div className="flex items-center justify-center py-10 text-gray-300 text-sm">신규 없음</div>
              ) : newEntries.map((e, i) => (
                <ProductRow key={`new-${i}`}
                  rank={e.rank} delta={e.rankDelta} isNew={true}
                  productName={e.productName} price={e.price}
                  channelId={selectedChannel as ChannelId} showChannel={false} />
              ))}
            </Panel>

            {/* 패널 3-4: 전체 랭킹 (넓게) */}
            <div className="col-span-2">
              <div className="bg-white rounded-2xl overflow-hidden"
                style={{
                  border: '1px solid #EAECF0',
                  borderLeft: `4px solid ${activeChannelMeta?.color ?? '#3B6FF6'}`,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                }}>
                <div className="flex items-center justify-between px-4 py-3"
                  style={{ borderBottom: '1px solid #F0F2F5' }}>
                  <span className="text-[13px] font-bold text-gray-800">
                    {activeChannelMeta?.label} 전체 랭킹 TOP {rightSnap?.products.length ?? 0}
                  </span>
                  {rightSnap && (
                    <span className="text-[11px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full"
                      style={{ border: '1px solid #EAECF0' }}>
                      {rightSnap.products.length}개
                    </span>
                  )}
                </div>

                {!rightSnap || (rightSnap.error && rightSnap.products.length === 0) ? (
                  <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
                    {rightSnap?.error ?? '데이터 없음'}
                  </div>
                ) : (
                  <div className="overflow-y-auto" style={{ maxHeight: 360 }}>
                    {rightSnap.products.slice(0, 60).map(p => (
                      <div key={`${p.rank}-${p.productName}`}
                        className="flex items-center gap-2.5 px-4 py-2 hover:bg-gray-50 transition-colors group"
                        style={{ borderBottom: '1px solid #F8F9FB' }}
                      >
                        {/* 순위 */}
                        <div className="flex-shrink-0 w-8 text-right">
                          <span
                            className="text-[13px] font-black"
                            style={{
                              color: p.rank <= 3 ? ['#F59E0B','#9CA3AF','#F97316'][p.rank-1]
                                : p.isOzKids ? activeChannelMeta?.color ?? '#3B6FF6'
                                : '#D1D5DB'
                            }}
                          >
                            #{p.rank}
                          </span>
                        </div>
                        {/* 썸네일 */}
                        <div className="w-8 h-8 rounded-md bg-gray-100 overflow-hidden flex-shrink-0">
                          {p.imageUrl
                            ? <img src={p.imageUrl} alt="" className="w-full h-full object-cover"
                                loading="lazy" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                            : null
                          }
                        </div>
                        {/* 텍스트 */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-[12px] font-semibold truncate ${p.isOzKids ? '' : 'text-gray-700'}`}
                            style={p.isOzKids ? { color: activeChannelMeta?.color } : {}}>
                            {p.productName}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            {p.price > 0 ? `${p.price.toLocaleString()}원` : '—'}
                          </p>
                        </div>
                        {/* OZ 마크 */}
                        {p.isOzKids && (
                          <span className="flex-shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded"
                            style={{ background: activeChannelMeta?.color, color: activeChannelMeta?.textColor }}>
                            OZ
                          </span>
                        )}
                        {/* 링크 */}
                        {p.productUrl && (
                          <a href={p.productUrl} target="_blank" rel="noopener noreferrer"
                            className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-gray-500">
                            <ExternalLink size={11} />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            순위 추이 영역
        ═══════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-2xl px-6 py-4 flex items-center justify-between"
          style={{ border: '1px solid #EAECF0' }}>
          <div>
            <p className="text-[13px] font-bold text-gray-800">순위 추이</p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              제품을 클릭하면 순위 변동 차트를 확인할 수 있습니다
            </p>
          </div>
          <a
            href="/history"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            style={{ border: '1px solid #EAECF0' }}
          >
            추이 분석 보기 →
          </a>
        </div>

      </div>
    </div>
  )
}
