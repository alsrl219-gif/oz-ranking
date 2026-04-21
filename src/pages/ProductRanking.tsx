import { useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { ExternalLink, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, Package } from 'lucide-react'
import { useRankingStore } from '../store/useRankingStore'
import { useRankingData } from '../hooks/useRankingData'
import { CHANNEL_META } from '../types'
import type { ChannelId, PeriodKey, RankingSnapshot } from '../types'
import { ChannelLogo } from '../components/ChannelLogo'

// ─── 상수 ─────────────────────────────────────────────────────────────────────

const CHANNELS: ChannelId[] = ['coupang', 'smartstore', 'musinsa', 'boribori', 'lotteon', 'kakao']

const PERIOD_TABS: { key: PeriodKey; label: string }[] = [
  { key: 'realtime', label: '실시간' },
  { key: 'daily',   label: '1일' },
  { key: 'weekly',  label: '1주' },
  { key: 'monthly', label: '1개월' },
]

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface ProductRow {
  productName: string
  imageUrl?: string
  price?: number
  channels: Partial<Record<ChannelId, { rank: number; delta: number | null; isNew: boolean; productUrl?: string }>>
  /** 채널 중 최저 순위(숫자가 작을수록 좋은 순위) */
  bestRank: number
}

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────────

function normalizeName(name: string): string {
  return name.replace(/\s+/g, '').toLowerCase()
}

function buildProductRows(
  snapshots: RankingSnapshot[],
  period: PeriodKey,
): ProductRow[] {
  const byName = new Map<string, ProductRow>()

  const relevant = snapshots.filter((s) => s.period === period)

  for (const snap of relevant) {
    for (const entry of snap.ozKidsEntries) {
      const key = normalizeName(entry.productName)
      if (!byName.has(key)) {
        byName.set(key, {
          productName: entry.productName,
          imageUrl: entry.imageUrl,
          price: entry.price || undefined,
          channels: {},
          bestRank: Infinity,
        })
      }
      const row = byName.get(key)!
      // 같은 채널이 이미 있으면 순위가 더 좋은 것 우선
      const existing = row.channels[snap.channelId]
      if (!existing || entry.rank < existing.rank) {
        row.channels[snap.channelId] = {
          rank: entry.rank,
          delta: entry.rankDelta,
          isNew: entry.isNew,
          productUrl: entry.productUrl,
        }
        if (entry.rank < row.bestRank) row.bestRank = entry.rank
      }
      if (!row.imageUrl && entry.imageUrl) row.imageUrl = entry.imageUrl
      if (!row.price && entry.price) row.price = entry.price
    }
  }

  return [...byName.values()].sort((a, b) => a.bestRank - b.bestRank)
}

// ─── 서브컴포넌트: 순위 뱃지 ──────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  const style: React.CSSProperties =
    rank === 1 ? { background: '#FFD700', color: '#7A5C00', border: '1px solid #F0C800' } :
    rank === 2 ? { background: '#E8E8E8', color: '#5A5A5A', border: '1px solid #D0D0D0' } :
    rank === 3 ? { background: '#F5CBA7', color: '#784212', border: '1px solid #E8A87C' } :
    rank <= 10  ? { background: '#EEF2FF', color: '#4338CA', border: '1px solid #C7D2FE' } :
    rank <= 30  ? { background: '#F0FDF4', color: '#166534', border: '1px solid #BBF7D0' } :
                  { background: '#F9FAFB', color: '#6B7280', border: '1px solid #E5E7EB' }

  return (
    <span
      className="inline-flex items-center justify-center rounded-lg text-[12px] font-bold tabular-nums"
      style={{ ...style, minWidth: 32, height: 24, padding: '0 6px' }}
    >
      {rank}
    </span>
  )
}

// ─── 서브컴포넌트: 변동 표시 ──────────────────────────────────────────────────

function DeltaBadge({ delta, isNew }: { delta: number | null; isNew: boolean }) {
  if (isNew) return (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
      style={{ background: '#EDE9FE', color: '#7C3AED' }}>NEW</span>
  )
  if (delta === null || delta === 0) return (
    <span className="text-gray-300 text-[11px]"><Minus size={10} className="inline" /></span>
  )
  if (delta > 0) return (
    <span className="flex items-center gap-0.5 text-[11px] font-semibold" style={{ color: '#16A34A' }}>
      <TrendingUp size={11} />+{delta}
    </span>
  )
  return (
    <span className="flex items-center gap-0.5 text-[11px] font-semibold" style={{ color: '#DC2626' }}>
      <TrendingDown size={11} />{delta}
    </span>
  )
}

// ─── 서브컴포넌트: 채널 셀 ────────────────────────────────────────────────────

function ChannelCell({ data }: {
  data?: { rank: number; delta: number | null; isNew: boolean; productUrl?: string }
  channelId: ChannelId
}) {
  if (!data) {
    return <td className="px-3 py-3 text-center"><span className="text-gray-200 text-[12px]">—</span></td>
  }
  return (
    <td className="px-3 py-3">
      <div className="flex flex-col items-center gap-1">
        {data.productUrl ? (
          <a href={data.productUrl} target="_blank" rel="noopener noreferrer">
            <RankBadge rank={data.rank} />
          </a>
        ) : (
          <RankBadge rank={data.rank} />
        )}
        <DeltaBadge delta={data.delta} isNew={data.isNew} />
      </div>
    </td>
  )
}

// ─── 서브컴포넌트: 트렌드 차트 ────────────────────────────────────────────────

interface TrendPoint {
  time: string
  [channelId: string]: number | string | null
}

function TrendChart({ productName }: { productName: string }) {
  const { data } = useRankingStore()

  // data.snapshots 에서 해당 제품의 채널별 히스토리 추출 (현재 데이터만, 추후 API로 확장 가능)
  const chartData = useMemo<TrendPoint[]>(() => {
    if (!data) return []
    const key = normalizeName(productName)

    // 시간 순으로 스냅샷 정렬
    const sorted = [...data.snapshots].sort(
      (a, b) => new Date(a.scrapedAt).getTime() - new Date(b.scrapedAt).getTime()
    )

    // scrapedAt 기준으로 포인트 집계
    const byTime = new Map<string, TrendPoint>()
    for (const snap of sorted) {
      const t = new Date(snap.scrapedAt).toLocaleString('ko-KR', {
        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
      })
      const entry = snap.ozKidsEntries.find(e => normalizeName(e.productName) === key)
      if (!entry) continue
      if (!byTime.has(t)) byTime.set(t, { time: t })
      const point = byTime.get(t)!
      point[snap.channelId] = entry.rank
    }

    return [...byTime.values()]
  }, [data, productName])

  const activeChannels = CHANNELS.filter(ch =>
    chartData.some(p => typeof p[ch] === 'number')
  )

  if (chartData.length < 2) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-gray-400">
        아직 추이 데이터가 없습니다. 수집을 더 진행하면 그래프가 표시됩니다.
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
        <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
        <YAxis
          reversed
          domain={['dataMin - 2', 'dataMax + 2']}
          tick={{ fontSize: 10, fill: '#9CA3AF' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => `#${v}`}
        />
        <Tooltip
          formatter={(v: number) => [`#${v} 위`, '']}
          labelStyle={{ fontSize: 11, color: '#6B7280' }}
          contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {activeChannels.map(ch => (
          <Line
            key={ch}
            type="monotone"
            dataKey={ch}
            name={CHANNEL_META[ch].label}
            stroke={CHANNEL_META[ch].color === '#FEE500' ? '#D4B800' : CHANNEL_META[ch].color}
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 1.5 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

// ─── 서브컴포넌트: 제품 행 ────────────────────────────────────────────────────

function ProductRowItem({
  row,
  isExpanded,
  onToggle,
}: {
  row: ProductRow
  isExpanded: boolean
  onToggle: () => void
}) {
  // 어떤 채널에라도 productUrl 존재 여부
  const anyUrl = CHANNELS.map(ch => row.channels[ch]?.productUrl).find(Boolean)

  return (
    <>
      <tr
        className="border-b border-gray-100 hover:bg-blue-50/40 cursor-pointer transition-colors"
        onClick={onToggle}
      >
        {/* 이미지 + 제품명 */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex-shrink-0 overflow-hidden bg-gray-100 border border-gray-200"
            >
              {row.imageUrl ? (
                <img src={row.imageUrl} alt={row.productName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package size={16} className="text-gray-300" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-gray-800 leading-tight line-clamp-2">{row.productName}</p>
              {row.price && (
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {row.price.toLocaleString()}원
                </p>
              )}
            </div>
            <button
              className="ml-auto flex-shrink-0 text-gray-300 hover:text-gray-500 transition-colors"
              onClick={(e) => { e.stopPropagation(); onToggle() }}
            >
              {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
          </div>
        </td>

        {/* 채널별 순위 */}
        {CHANNELS.map(ch => (
          <ChannelCell key={ch} data={row.channels[ch]} channelId={ch} />
        ))}

        {/* 링크 */}
        <td className="px-3 py-3 text-center">
          {anyUrl ? (
            <a
              href={anyUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="inline-flex items-center justify-center w-7 h-7 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ExternalLink size={13} className="text-gray-400 hover:text-blue-500" />
            </a>
          ) : (
            <span className="text-gray-200 text-[12px]">—</span>
          )}
        </td>
      </tr>

      {/* 트렌드 차트 확장 행 */}
      {isExpanded && (
        <tr className="bg-gradient-to-b from-blue-50/60 to-white border-b border-gray-100">
          <td colSpan={CHANNELS.length + 2} className="px-6 py-4">
            <p className="text-[12px] font-semibold text-gray-500 mb-3">
              📈 순위 추이 — {row.productName}
            </p>
            <TrendChart productName={row.productName} />
          </td>
        </tr>
      )}
    </>
  )
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────

export function ProductRanking() {
  useRankingData()

  const { data, isLoading } = useRankingStore()

  const [period,      setPeriod]      = useState<PeriodKey>('realtime')
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [search,      setSearch]      = useState('')

  const products = useMemo(() => {
    if (!data) return []
    return buildProductRows(data.snapshots, period)
  }, [data, period])

  const filtered = useMemo(() => {
    if (!search.trim()) return products
    const q = search.trim().toLowerCase()
    return products.filter(p => p.productName.toLowerCase().includes(q))
  }, [products, search])

  const lastUpdated = data?.scrapedAt
    ? new Date(data.scrapedAt).toLocaleString('ko-KR', {
        month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
      })
    : null

  return (
    <div className="min-h-screen" style={{ background: '#F8F9FB' }}>

      {/* ── 헤더 ──────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-6 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">

          {/* 타이틀 */}
          <div>
            <h1 className="text-[18px] font-extrabold text-gray-900 leading-tight">상품 랭킹</h1>
            {lastUpdated && (
              <p className="text-[11px] text-gray-400 mt-0.5">마지막 업데이트 {lastUpdated}</p>
            )}
          </div>

          {/* 기간 탭 */}
          <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-0.5">
            {PERIOD_TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setPeriod(key)}
                className="px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
                style={
                  period === key
                    ? { background: '#fff', color: '#1A1D2E', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }
                    : { color: '#9CA3AF' }
                }
              >
                {label}
              </button>
            ))}
          </div>

          {/* 검색 */}
          <input
            type="text"
            placeholder="제품명 검색..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-4 py-2 text-[13px] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300"
            style={{ border: '1px solid #E5E7EB', background: '#FAFAFA', width: 220 }}
          />
        </div>
      </div>

      {/* ── 바디 ──────────────────────────────────────────────────────── */}
      <div className="p-6">

        {/* 로딩 */}
        {isLoading && !data && (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-3 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* 데이터 없음 */}
        {!isLoading && (!data || products.length === 0) && (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <Package size={40} className="mb-3 text-gray-200" />
            <p className="text-[14px] font-medium">수집된 OZ 키즈 상품이 없습니다</p>
            <p className="text-[12px] mt-1">백엔드에서 데이터를 먼저 수집해 주세요.</p>
          </div>
        )}

        {/* 테이블 */}
        {data && filtered.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid #EAECF0' }}>

            {/* 상단 카운트 */}
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
              <span className="text-[13px] font-bold text-gray-700">
                총 {filtered.length}개 상품
              </span>
              {search && (
                <span className="text-[11px] text-gray-400">
                  "{search}" 검색 결과
                </span>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr style={{ background: '#FAFAFA', borderBottom: '2px solid #F0F0F0' }}>
                    {/* 제품명 */}
                    <th className="px-4 py-3 text-left">
                      <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">제품명</span>
                    </th>

                    {/* 채널별 순위 헤더 */}
                    {CHANNELS.map(ch => (
                      <th key={ch} className="px-3 py-3 text-center">
                        <div className="flex justify-center">
                          <ChannelLogo channelId={ch} size="sm" />
                        </div>
                      </th>
                    ))}

                    {/* 링크 */}
                    <th className="px-3 py-3 text-center">
                      <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">링크</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => {
                    const key = normalizeName(row.productName)
                    return (
                      <ProductRowItem
                        key={key}
                        row={row}
                        isExpanded={expandedKey === key}
                        onToggle={() => setExpandedKey(expandedKey === key ? null : key)}
                      />
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 안내 배너: 시즌/카테고리 */}
        <div className="mt-4 px-4 py-3 rounded-xl flex items-start gap-3"
          style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
          <span className="text-blue-400 mt-0.5">ℹ️</span>
          <p className="text-[12px] text-blue-700 leading-relaxed">
            <strong>시즌 · 카테고리</strong> 정보는 상품 카탈로그 연동 후 표시됩니다.
            현재는 스크래핑된 채널 데이터에서 OZ 키즈 상품을 자동으로 식별해 표시합니다.
            리뷰수 · 평점은 스크래퍼 업데이트 예정입니다.
          </p>
        </div>
      </div>
    </div>
  )
}
