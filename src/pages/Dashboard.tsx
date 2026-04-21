import { useState, useMemo } from 'react'
import { RefreshCw, Loader2, ExternalLink, TrendingUp, TrendingDown, Minus, Award, Zap, Package } from 'lucide-react'
import { useRankingStore } from '../store/useRankingStore'
import { useRankingData } from '../hooks/useRankingData'
import { ChannelLogo } from '../components/ChannelLogo'
import { CHANNEL_META, type ChannelId, type PeriodKey, type RankingSnapshot, type OzKidsEntry } from '../types'

type ChannelFilter = 'all' | ChannelId

const CHANNELS: ChannelId[] = ['coupang', 'smartstore', 'musinsa', 'boribori', 'lotteon', 'kakao']
const PERIOD_TABS: { key: PeriodKey; label: string }[] = [
  { key: 'realtime', label: '실시간' },
  { key: 'daily',    label: '일간' },
  { key: 'weekly',   label: '주간' },
  { key: 'monthly',  label: '월간' },
]

type OzEntry = OzKidsEntry & { channelId: ChannelId }

// ─── 순위 배지 ───────────────────────────────────────────────────────────────

function getRankStyle(rank: number): { bg: string; text: string } {
  if (rank <= 3)  return { bg: '#F59E0B', text: '#fff' }
  if (rank <= 10) return { bg: '#10B981', text: '#fff' }
  if (rank <= 30) return { bg: '#3B82F6', text: '#fff' }
  if (rank <= 50) return { bg: '#8B5CF6', text: '#fff' }
  return { bg: '#94A3B8', text: '#fff' }
}

function RankBadge({ rank }: { rank: number }) {
  const { bg, text } = getRankStyle(rank)
  return (
    <span className="inline-flex items-center justify-center rounded-lg text-[12px] font-black tabular-nums"
      style={{ background: bg, color: text, minWidth: 36, height: 26, padding: '0 6px' }}>
      #{rank}
    </span>
  )
}

function DeltaPill({ delta, isNew }: { delta: number | null; isNew: boolean }) {
  if (isNew) return (
    <span className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{ background: '#EDE9FE', color: '#7C3AED' }}>NEW</span>
  )
  if (!delta || delta === 0) return <Minus size={10} className="text-slate-300" />
  if (delta > 0) return (
    <span className="flex items-center gap-0.5 text-[11px] font-bold" style={{ color: '#10B981' }}>
      <TrendingUp size={10} />+{delta}
    </span>
  )
  return (
    <span className="flex items-center gap-0.5 text-[11px] font-bold" style={{ color: '#EF4444' }}>
      <TrendingDown size={10} />{delta}
    </span>
  )
}

// ─── 상품 행 ─────────────────────────────────────────────────────────────────

function EntryRow({ e, showChannel }: { e: OzEntry; showChannel: boolean }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors group border-b border-slate-50">
      {/* 순위 */}
      <div className="w-10 flex-shrink-0 flex flex-col items-center gap-0.5">
        <RankBadge rank={e.rank} />
        <DeltaPill delta={e.rankDelta} isNew={e.isNew} />
      </div>

      {/* 채널 */}
      {showChannel && (
        <div className="flex-shrink-0">
          <ChannelLogo channelId={e.channelId} size="sm" />
        </div>
      )}

      {/* 이미지 */}
      <div className="w-9 h-9 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0 border border-slate-200">
        {e.imageUrl
          ? <img src={e.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy"
              onError={ev => { (ev.target as HTMLImageElement).style.display = 'none' }} />
          : <div className="w-full h-full flex items-center justify-center text-slate-300 text-[8px]">no img</div>}
      </div>

      {/* 이름 + 가격 */}
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold text-slate-800 truncate">{e.productName}</p>
        <p className="text-[11px] font-medium mt-0.5" style={{ color: CHANNEL_META[e.channelId].color }}>
          {e.price > 0 ? `${e.price.toLocaleString()}원` : ''}
        </p>
      </div>

      {/* 링크 */}
      {e.productUrl && (
        <a href={e.productUrl} target="_blank" rel="noopener noreferrer"
          className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={ev => ev.stopPropagation()}>
          <ExternalLink size={12} className="text-slate-400 hover:text-slate-600" />
        </a>
      )}
    </div>
  )
}

// ─── 패널 카드 ────────────────────────────────────────────────────────────────

function SectionCard({
  title, icon, accent, count, children,
}: {
  title: string; icon: React.ReactNode; accent: string
  count?: number; children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl overflow-hidden flex flex-col"
      style={{ border: '1px solid #E2E8F0', borderTopWidth: 3, borderTopColor: accent }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #F1F5F9' }}>
        <div className="flex items-center gap-2">
          <span style={{ color: accent }}>{icon}</span>
          <span className="text-[13px] font-bold text-slate-800">{title}</span>
        </div>
        {count !== undefined && (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: accent + '15', color: accent }}>{count}개</span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto" style={{ maxHeight: 340 }}>
        {children}
      </div>
    </div>
  )
}

// ─── 채널 상태 카드 ───────────────────────────────────────────────────────────

function ChannelStatusCard({
  channelId, snap, isScrapin, onScrape,
}: {
  channelId: ChannelId
  snap: RankingSnapshot | null
  isScrapin: boolean
  onScrape: () => void
}) {
  const meta = CHANNEL_META[channelId]
  const count = snap?.ozKidsEntries.length ?? 0
  const err = snap?.error
  const best = snap?.ozKidsEntries.reduce((b, e) => e.rank < b ? e.rank : b, Infinity) ?? Infinity

  return (
    <div className="bg-white rounded-xl p-4 flex flex-col gap-3"
      style={{ border: '1px solid #E2E8F0' }}>
      <div className="flex items-center justify-between">
        <ChannelLogo channelId={channelId} size="md" />
        <button
          onClick={onScrape}
          disabled={isScrapin}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-slate-100"
          style={{ border: '1px solid #E2E8F0' }}>
          {isScrapin
            ? <Loader2 size={12} className="animate-spin text-slate-400" />
            : <RefreshCw size={12} className="text-slate-400" />}
        </button>
      </div>

      {err ? (
        <div className="text-[10px] font-medium px-2 py-1 rounded-lg" style={{ background: '#FEF2F2', color: '#DC2626' }}>
          {err.slice(0, 40)}
        </div>
      ) : (
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[22px] font-black text-slate-800 leading-none">{count}</p>
            <p className="text-[10px] text-slate-400 mt-0.5 font-medium">OZ 상품</p>
          </div>
          {isFinite(best) && (
            <div className="text-right">
              <p className="text-[13px] font-black leading-none" style={{ color: meta.color }}>
                #{best}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5 font-medium">최고</p>
            </div>
          )}
        </div>
      )}

      {/* 상단 3개 미니 리스트 */}
      {!err && snap && snap.ozKidsEntries.length > 0 && (
        <div className="space-y-1 pt-1" style={{ borderTop: '1px solid #F1F5F9' }}>
          {snap.ozKidsEntries.slice(0, 3).map((e, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[10px] font-black tabular-nums" style={{ color: meta.color, minWidth: 20 }}>
                #{e.rank}
              </span>
              <span className="text-[10px] text-slate-600 truncate flex-1">{e.productName}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── 메인 ─────────────────────────────────────────────────────────────────────

export function Dashboard() {
  useRankingData()

  const {
    data, isLoading, isScraping, scrapingChannels, status,
    triggerScrape, triggerChannelScrape,
  } = useRankingStore()

  const [selectedChannel, setSelectedChannel] = useState<ChannelFilter>('all')
  const [selectedPeriod,  setSelectedPeriod]  = useState<PeriodKey>('realtime')

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

  const newEntries   = useMemo(() => allOzEntries.filter(e => e.isNew), [allOzEntries])
  const risingEntries = useMemo(() =>
    [...allOzEntries].filter(e => (e.rankDelta ?? 0) > 0)
      .sort((a, b) => (b.rankDelta ?? 0) - (a.rankDelta ?? 0)).slice(0, 10),
    [allOzEntries]
  )

  const chanSnap = useMemo(() =>
    selectedChannel !== 'all' && data
      ? data.snapshots.find(s => s.channelId === selectedChannel && s.period === selectedPeriod) ?? null
      : null,
    [data, selectedChannel, selectedPeriod]
  )

  const supportedPeriods = useMemo(() =>
    selectedChannel === 'all'
      ? new Set(PERIOD_TABS.map(t => t.key))
      : new Set(CHANNEL_META[selectedChannel as ChannelId]?.supportedPeriods ?? []),
    [selectedChannel]
  )

  // KPI
  const totalOzProducts = useMemo(() => new Set(allOzEntries.map(e => e.productName)).size, [allOzEntries])
  const activeChannels  = useMemo(() =>
    CHANNELS.filter(ch => (data?.snapshots.find(s => s.channelId === ch && s.period === selectedPeriod)?.ozKidsEntries.length ?? 0) > 0).length,
    [data, selectedPeriod]
  )
  const bestRankOverall = useMemo(() => {
    const ranks = allOzEntries.map(e => e.rank)
    return ranks.length ? Math.min(...ranks) : null
  }, [allOzEntries])

  const ageText = status?.ageMinutes != null
    ? status.ageMinutes < 1 ? '방금 전'
      : status.ageMinutes < 60 ? `${status.ageMinutes}분 전`
      : `${Math.floor(status.ageMinutes / 60)}시간 전`
    : '—'

  const todayStr = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="flex flex-col min-h-screen" style={{ background: '#F1F5F9' }}>

      {/* ── 페이지 헤더 ──────────────────────────────────────────── */}
      <div className="bg-white px-8 py-5 flex items-center justify-between"
        style={{ borderBottom: '1px solid #E2E8F0' }}>
        <div>
          <h1 className="text-[20px] font-bold text-slate-900 leading-tight">랭킹 대시보드</h1>
          <p className="text-[12px] text-slate-400 mt-0.5">{todayStr}</p>
        </div>
        <button
          onClick={triggerScrape}
          disabled={isScraping}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition-all"
          style={isScraping
            ? { background: '#F1F5F9', color: '#94A3B8', border: '1px solid #E2E8F0' }
            : { background: '#0F172A', color: '#fff', border: '1px solid #0F172A' }}>
          {isScraping
            ? <><Loader2 size={14} className="animate-spin" /> 수집 중...</>
            : <><RefreshCw size={14} /> 전체 수집</>}
        </button>
      </div>

      <div className="flex-1 p-6 space-y-5">

        {/* ── KPI 카드 ────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-4">
          {[
            {
              label: 'OZ 상품 등장',
              value: isLoading ? '—' : totalOzProducts.toString(),
              sub: '현재 기간 기준',
              icon: <Package />,
              accent: '#6366F1',
            },
            {
              label: '활성 채널',
              value: isLoading ? '—' : `${activeChannels} / 6`,
              sub: 'OZ 상품 발견',
              icon: <Award />,
              accent: '#10B981',
            },
            {
              label: '최고 순위',
              value: isLoading ? '—' : bestRankOverall ? `#${bestRankOverall}` : '—',
              sub: '전체 채널 통합',
              icon: <Zap />,
              accent: '#F59E0B',
            },
            {
              label: '마지막 수집',
              value: ageText,
              sub: status?.lastScrapedAt ? new Date(status.lastScrapedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '',
              icon: <RefreshCw />,
              accent: '#3B82F6',
            },
          ].map(({ label, value, sub, accent }) => (
            <div key={label} className="bg-white rounded-2xl px-5 py-4"
              style={{ border: '1px solid #E2E8F0' }}>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
              <p className="text-[28px] font-black text-slate-900 mt-1 leading-none"
                style={{ color: accent }}>{value}</p>
              <p className="text-[11px] text-slate-400 mt-1.5">{sub}</p>
            </div>
          ))}
        </div>

        {/* ── 채널 탭 ──────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
          <div className="flex items-center px-4 gap-1 overflow-x-auto"
            style={{ borderBottom: '1px solid #F1F5F9' }}>
            {/* 전체 탭 */}
            <button
              onClick={() => setSelectedChannel('all')}
              className="flex items-center gap-2 px-4 py-3.5 text-[13px] font-semibold transition-all flex-shrink-0 border-b-2"
              style={selectedChannel === 'all'
                ? { color: '#FF5043', borderBottomColor: '#FF5043' }
                : { color: '#94A3B8', borderBottomColor: 'transparent' }}>
              전체
            </button>
            {CHANNELS.map(ch => {
              const isActive = selectedChannel === ch
              const isScrapingThis = !!(scrapingChannels[ch])
              return (
                <button key={ch}
                  onClick={() => setSelectedChannel(ch)}
                  className="flex items-center gap-2 px-4 py-3 flex-shrink-0 border-b-2 transition-all"
                  style={isActive
                    ? { borderBottomColor: CHANNEL_META[ch].color }
                    : { borderBottomColor: 'transparent', opacity: 0.6 }}>
                  <ChannelLogo channelId={ch} size="sm" />
                  {isScrapingThis && <Loader2 size={10} className="animate-spin text-slate-300" />}
                </button>
              )
            })}

            {/* 기간 탭 (오른쪽) */}
            <div className="flex items-center gap-0.5 ml-auto bg-slate-100 rounded-xl p-1 flex-shrink-0 my-2">
              {PERIOD_TABS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setSelectedPeriod(key)}
                  disabled={!supportedPeriods.has(key)}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all disabled:opacity-30"
                  style={selectedPeriod === key
                    ? { background: '#fff', color: '#0F172A', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
                    : { color: '#64748B' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* ── 콘텐츠 ─────────────────────────────────────────── */}
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 size={24} className="animate-spin text-slate-300" />
            </div>
          ) : !data ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
              <RefreshCw size={32} className="mb-2 text-slate-200" />
              <p className="text-[13px]">데이터가 없습니다. 전체 수집을 실행하세요.</p>
            </div>
          ) : selectedChannel === 'all' ? (
            /* ── 전체 뷰: 4 패널 ── */
            <div className="p-5">
              {/* 채널 상태 그리드 */}
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">채널 현황</p>
              <div className="grid grid-cols-6 gap-3 mb-5">
                {CHANNELS.map(ch => (
                  <ChannelStatusCard
                    key={ch}
                    channelId={ch}
                    snap={data.snapshots.find(s => s.channelId === ch && s.period === selectedPeriod) ?? null}
                    isScrapin={!!(scrapingChannels[ch])}
                    onScrape={() => triggerChannelScrape(ch)}
                  />
                ))}
              </div>

              {/* 3 섹션 */}
              <div className="grid grid-cols-3 gap-4">
                <SectionCard title="OZ 등장 TOP" icon={<Award size={14} />} accent="#F59E0B" count={allOzEntries.length}>
                  {allOzEntries.length === 0
                    ? <div className="flex items-center justify-center h-20 text-[12px] text-slate-400">데이터 없음</div>
                    : allOzEntries.slice(0, 15).map((e, i) => <EntryRow key={i} e={e} showChannel />)
                  }
                </SectionCard>
                <SectionCard title="신규 진입" icon={<Zap size={14} />} accent="#8B5CF6" count={newEntries.length}>
                  {newEntries.length === 0
                    ? <div className="flex items-center justify-center h-20 text-[12px] text-slate-400">신규 진입 없음</div>
                    : newEntries.map((e, i) => <EntryRow key={i} e={e} showChannel />)
                  }
                </SectionCard>
                <SectionCard title="순위 상승 TOP" icon={<TrendingUp size={14} />} accent="#10B981" count={risingEntries.length}>
                  {risingEntries.length === 0
                    ? <div className="flex items-center justify-center h-20 text-[12px] text-slate-400">변동 없음</div>
                    : risingEntries.map((e, i) => <EntryRow key={i} e={e} showChannel />)
                  }
                </SectionCard>
              </div>
            </div>
          ) : (
            /* ── 채널 뷰 ── */
            <div className="p-5">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                  <SectionCard title="OZ 등장" icon={<Award size={14} />}
                    accent={CHANNEL_META[selectedChannel as ChannelId].color}
                    count={allOzEntries.length}>
                    {allOzEntries.length === 0
                      ? <div className="flex items-center justify-center h-20 text-[12px] text-slate-400">미발견</div>
                      : allOzEntries.map((e, i) => <EntryRow key={i} e={e} showChannel={false} />)
                    }
                  </SectionCard>
                </div>
                <div className="col-span-2">
                  <SectionCard title={`전체 랭킹 — ${CHANNEL_META[selectedChannel as ChannelId]?.label}`}
                    icon={<TrendingUp size={14} />}
                    accent="#64748B"
                    count={chanSnap?.products.length}>
                    {(chanSnap?.products ?? []).slice(0, 30).map((p, i) => (
                      <div key={i}
                        className={`flex items-center gap-3 px-4 py-2 border-b border-slate-50 ${p.isOzKids ? 'bg-amber-50' : 'hover:bg-slate-50'}`}>
                        <span className="text-[11px] font-black tabular-nums w-7 text-slate-400">#{p.rank}</span>
                        <div className="w-8 h-8 rounded-md bg-slate-100 overflow-hidden flex-shrink-0">
                          {p.imageUrl
                            ? <img src={p.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                            : null}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[12px] truncate ${p.isOzKids ? 'font-bold text-amber-800' : 'text-slate-700'}`}>
                            {p.productName}
                          </p>
                          <p className="text-[10px] text-slate-400">{p.brandName}</p>
                        </div>
                        {p.isOzKids && (
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded flex-shrink-0"
                            style={{ background: '#FEF3C7', color: '#92400E' }}>OZ</span>
                        )}
                      </div>
                    ))}
                  </SectionCard>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
