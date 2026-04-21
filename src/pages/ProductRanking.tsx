import { useState, useMemo, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  ExternalLink, TrendingUp, TrendingDown, Minus,
  ChevronDown, ChevronUp, Package, RefreshCw, AlertCircle,
} from 'lucide-react'
import { useRankingStore } from '../store/useRankingStore'
import { useRankingData } from '../hooks/useRankingData'
import { CHANNEL_META } from '../types'
import type { ChannelId, PeriodKey, RankingSnapshot } from '../types'
import { ChannelLogo } from '../components/ChannelLogo'
import { API_BASE } from '../config'

// ─── 상수 ─────────────────────────────────────────────────────────────────────

const CHANNELS: ChannelId[] = ['coupang', 'smartstore', 'musinsa', 'boribori', 'lotteon', 'kakao']

const PERIOD_TABS: { key: PeriodKey; label: string }[] = [
  { key: 'realtime', label: '실시간' },
  { key: 'daily',   label: '1일' },
  { key: 'weekly',  label: '1주' },
  { key: 'monthly', label: '1개월' },
]

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface CatalogProduct {
  sCode: string
  oCode: string
  productName: string
  season: string
  category: string
  price: number
  imageUrl: string
}

interface ChannelRankInfo {
  rank: number
  delta: number | null
  isNew: boolean
  productUrl?: string
}

interface ProductRow extends CatalogProduct {
  channelRanks: Partial<Record<ChannelId, ChannelRankInfo>>
  bestRank: number
  scraped: boolean
}

// ─── 매칭 헬퍼 ─────────────────────────────────────────────────────────────────

function normalizeForMatch(s: string): string {
  return s
    .replace(/[()（）\[\]【】]/g, ' ')  // 괄호 제거
    .replace(/\s+/g, '')
    .toLowerCase()
}

/**
 * 카탈로그 상품명이 채널 상품명에 포함되는지 (또는 핵심 키워드 매칭)
 */
function isProductMatch(catalogName: string, channelName: string): boolean {
  const cat = normalizeForMatch(catalogName)
  const ch  = normalizeForMatch(channelName)

  if (cat.length < 3) return false

  // 직접 포함 여부
  if (ch.includes(cat) || cat.includes(ch)) return true

  // 카탈로그명에서 주요 키워드 추출 (2글자 이상 토큰)
  const tokens = catalogName
    .replace(/[()（）\[\]【】-]/g, ' ')
    .split(/\s+/)
    .map(t => t.trim().toLowerCase())
    .filter(t => t.length >= 2)

  if (tokens.length === 0) return false

  const matchCount = tokens.filter(t => ch.includes(t)).length
  return matchCount >= Math.max(1, Math.floor(tokens.length * 0.6))
}

/**
 * 채널 스냅샷들에서 카탈로그 상품에 매칭되는 순위 데이터를 추출
 */
function buildChannelRanks(
  product: CatalogProduct,
  snapshots: RankingSnapshot[],
  period: PeriodKey,
): Partial<Record<ChannelId, ChannelRankInfo>> {
  const ranks: Partial<Record<ChannelId, ChannelRankInfo>> = {}

  const relevant = snapshots.filter(s => s.period === period)

  for (const snap of relevant) {
    // 이미 이 채널 데이터가 있으면 건너뜀
    if (ranks[snap.channelId]) continue

    // ozKidsEntries에서 매칭 검색
    const matched = snap.ozKidsEntries.find(e =>
      isProductMatch(product.productName, e.productName)
    )

    if (matched) {
      ranks[snap.channelId] = {
        rank: matched.rank,
        delta: matched.rankDelta,
        isNew: matched.isNew,
        productUrl: matched.productUrl,
      }
    }
  }

  return ranks
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
      {rank}위
    </span>
  )
}

function DeltaBadge({ delta, isNew }: { delta: number | null; isNew: boolean }) {
  if (isNew) return (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
      style={{ background: '#EDE9FE', color: '#7C3AED' }}>NEW</span>
  )
  if (delta === null || delta === 0) return (
    <Minus size={10} className="text-gray-300" />
  )
  if (delta > 0) return (
    <span className="flex items-center gap-0.5 text-[11px] font-semibold" style={{ color: '#16A34A' }}>
      <TrendingUp size={10} />+{delta}
    </span>
  )
  return (
    <span className="flex items-center gap-0.5 text-[11px] font-semibold" style={{ color: '#DC2626' }}>
      <TrendingDown size={10} />{Math.abs(delta)}↓
    </span>
  )
}

// ─── 서브컴포넌트: 채널 셀 ────────────────────────────────────────────────────

function ChannelCell({ data }: { data?: ChannelRankInfo }) {
  if (!data) {
    return (
      <td className="px-2 py-3 text-center align-middle">
        <span className="text-gray-200 text-[13px]">—</span>
      </td>
    )
  }
  return (
    <td className="px-2 py-3 text-center align-middle">
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

function TrendChart({ product }: { product: CatalogProduct }) {
  const { data } = useRankingStore()

  const chartData = useMemo(() => {
    if (!data) return []

    const timeMap = new Map<string, Record<string, number | string>>()

    for (const snap of data.snapshots) {
      const matched = snap.ozKidsEntries.find(e =>
        isProductMatch(product.productName, e.productName)
      )
      if (!matched) continue

      const t = new Date(snap.scrapedAt).toLocaleString('ko-KR', {
        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
      })
      if (!timeMap.has(t)) timeMap.set(t, { time: t })
      const point = timeMap.get(t)!
      point[snap.channelId] = matched.rank
    }

    return [...timeMap.values()]
  }, [data, product.productName])

  const activeChannels = CHANNELS.filter(ch =>
    chartData.some(p => typeof p[ch] === 'number')
  )

  if (chartData.length < 2) {
    return (
      <div className="flex items-center justify-center h-28 text-sm text-gray-400">
        아직 추이 데이터가 부족합니다. 수집 횟수가 늘어나면 그래프가 표시됩니다.
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={chartData} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
        <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
        <YAxis
          reversed
          domain={['dataMin - 2', 'dataMax + 2']}
          tick={{ fontSize: 10, fill: '#9CA3AF' }}
          tickLine={false} axisLine={false}
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
            dot={{ r: 3 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

// ─── 서브컴포넌트: 제품 행 ────────────────────────────────────────────────────

function ProductRowItem({
  row, isExpanded, onToggle,
}: {
  row: ProductRow
  isExpanded: boolean
  onToggle: () => void
}) {
  const anyUrl = CHANNELS.map(ch => row.channelRanks[ch]?.productUrl).find(Boolean)
  const rankedCount = CHANNELS.filter(ch => row.channelRanks[ch]).length

  return (
    <>
      <tr
        className={`border-b border-gray-100 cursor-pointer transition-colors ${
          rankedCount > 0 ? 'hover:bg-blue-50/40' : 'hover:bg-gray-50/60'
        }`}
        onClick={onToggle}
      >
        {/* 시즌 */}
        <td className="px-3 py-3 text-center align-middle">
          {row.season ? (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full"
              style={{ background: '#F0F9FF', color: '#0369A1', border: '1px solid #BAE6FD' }}>
              {row.season}
            </span>
          ) : <span className="text-gray-200 text-[12px]">—</span>}
        </td>

        {/* 카테고리 */}
        <td className="px-3 py-3 text-center align-middle">
          {row.category ? (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full"
              style={{ background: '#FDF4FF', color: '#7E22CE', border: '1px solid #E9D5FF' }}>
              {row.category}
            </span>
          ) : <span className="text-gray-200 text-[12px]">—</span>}
        </td>

        {/* 이미지 + 제품명 */}
        <td className="px-4 py-3 align-middle" style={{ minWidth: 220 }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex-shrink-0 overflow-hidden bg-gray-100 border border-gray-200">
              {row.imageUrl ? (
                <img src={row.imageUrl} alt={row.productName}
                  className="w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package size={14} className="text-gray-300" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-gray-800 leading-tight line-clamp-2">
                {row.productName}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                {row.oCode && (
                  <span className="text-[10px] text-gray-400 font-mono">{row.oCode}</span>
                )}
                {rankedCount > 0 && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                    style={{ background: '#DCFCE7', color: '#166534' }}>
                    {rankedCount}채널 랭킹
                  </span>
                )}
              </div>
            </div>
            <button
              className="flex-shrink-0 text-gray-300 hover:text-gray-500 transition-colors ml-2"
              onClick={e => { e.stopPropagation(); onToggle() }}
            >
              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </td>

        {/* 채널별 순위 */}
        {CHANNELS.map(ch => (
          <ChannelCell key={ch} data={row.channelRanks[ch]} />
        ))}

        {/* 가격 */}
        <td className="px-3 py-3 text-right align-middle">
          {row.price > 0 ? (
            <span className="text-[13px] font-semibold text-gray-700">
              {row.price.toLocaleString()}
              <span className="text-[11px] font-normal text-gray-400 ml-0.5">원</span>
            </span>
          ) : <span className="text-gray-200 text-[12px]">—</span>}
        </td>

        {/* 링크 */}
        <td className="px-3 py-3 text-center align-middle">
          {anyUrl ? (
            <a href={anyUrl} target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="inline-flex items-center justify-center w-7 h-7 rounded-lg hover:bg-gray-100 transition-colors">
              <ExternalLink size={13} className="text-gray-400 hover:text-blue-500" />
            </a>
          ) : <span className="text-gray-200 text-[12px]">—</span>}
        </td>
      </tr>

      {/* 트렌드 차트 확장 */}
      {isExpanded && (
        <tr className="bg-gradient-to-b from-blue-50/50 to-white border-b border-gray-100">
          <td colSpan={CHANNELS.length + 4} className="px-6 py-4">
            <p className="text-[12px] font-semibold text-gray-500 mb-3">
              📈 순위 추이 — {row.productName}
            </p>
            <TrendChart product={row} />
          </td>
        </tr>
      )}
    </>
  )
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────

export function ProductRanking() {
  useRankingData()

  const { data } = useRankingStore()

  const [period,      setPeriod]      = useState<PeriodKey>('realtime')
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [search,      setSearch]      = useState('')
  const [seasonFilter,   setSeasonFilter]   = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  // 카탈로그 API 상태
  const [catalog,        setCatalog]        = useState<CatalogProduct[] | null>(null)
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError,   setCatalogError]   = useState<string | null>(null)

  // 카탈로그 로드
  useEffect(() => {
    setCatalogLoading(true)
    fetch(`${API_BASE}/api/catalog`)
      .then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(e.error ?? '카탈로그 오류')))
      .then(d => { setCatalog(d.products); setCatalogLoading(false) })
      .catch(e => { setCatalogError(String(e)); setCatalogLoading(false) })
  }, [])

  // 채널 순위 데이터 병합
  const productRows = useMemo<ProductRow[]>(() => {
    if (!catalog) return []

    const snapshots: RankingSnapshot[] = data?.snapshots ?? []

    return catalog.map(p => {
      const channelRanks = buildChannelRanks(p, snapshots, period)
      const bestRank = Math.min(
        ...Object.values(channelRanks).map(r => r?.rank ?? Infinity)
      )
      return {
        ...p,
        channelRanks,
        bestRank: isFinite(bestRank) ? bestRank : Infinity,
        scraped: Object.keys(channelRanks).length > 0,
      }
    }).sort((a, b) => {
      // 랭킹 있는 상품 먼저, 그다음 최고 순위 순
      if (a.scraped && !b.scraped) return -1
      if (!a.scraped && b.scraped) return 1
      return (a.bestRank === Infinity ? 9999 : a.bestRank) - (b.bestRank === Infinity ? 9999 : b.bestRank)
    })
  }, [catalog, data, period])

  // 필터
  const filtered = useMemo(() => {
    let rows = productRows
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(r =>
        r.productName.toLowerCase().includes(q) ||
        r.oCode.toLowerCase().includes(q) ||
        r.sCode.toLowerCase().includes(q)
      )
    }
    if (seasonFilter)   rows = rows.filter(r => r.season === seasonFilter)
    if (categoryFilter) rows = rows.filter(r => r.category === categoryFilter)
    return rows
  }, [productRows, search, seasonFilter, categoryFilter])

  // 필터 옵션 추출
  const seasons    = useMemo(() => [...new Set(productRows.map(r => r.season).filter(Boolean))].sort(), [productRows])
  const categories = useMemo(() => [...new Set(productRows.map(r => r.category).filter(Boolean))].sort(), [productRows])

  const rankedCount = productRows.filter(r => r.scraped).length
  const lastUpdated = data?.scrapedAt
    ? new Date(data.scrapedAt).toLocaleString('ko-KR', {
        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
      })
    : null

  // ── 렌더 ──

  if (catalogLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F8F9FB' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">상품 카탈로그 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (catalogError || !catalog) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8" style={{ background: '#F8F9FB' }}>
        <div className="bg-white rounded-2xl shadow-sm p-8 max-w-md w-full text-center"
          style={{ border: '1px solid #EAECF0' }}>
          <AlertCircle size={40} className="mx-auto mb-4 text-amber-400" />
          <h2 className="text-[16px] font-bold text-gray-800 mb-2">전체상품목록 파일 없음</h2>
          <p className="text-[13px] text-gray-500 mb-5 leading-relaxed">
            데이터 관리 페이지에서<br />
            <strong>전체상품목록 XLS 파일</strong>을 업로드해야<br />
            상품 랭킹이 표시됩니다.
          </p>
          <a
            href="/data"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-[13px] font-semibold"
            style={{ background: 'linear-gradient(135deg, #FF5043, #FF7A6D)' }}
          >
            <RefreshCw size={14} />
            데이터 관리로 이동
          </a>
          {catalogError && (
            <p className="text-[11px] text-red-400 mt-3">{catalogError}</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: '#F8F9FB' }}>

      {/* ── 헤더 ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* 타이틀 */}
            <div>
              <h1 className="text-[18px] font-extrabold text-gray-900 leading-tight">상품 랭킹</h1>
              <div className="flex items-center gap-3 mt-0.5">
                <p className="text-[11px] text-gray-400">
                  전체 <strong className="text-gray-600">{catalog.length}</strong>개 상품
                  {rankedCount > 0 && (
                    <> · 랭킹 확인 <strong className="text-green-600">{rankedCount}</strong>개</>
                  )}
                </p>
                {lastUpdated && (
                  <p className="text-[11px] text-gray-400">수집 {lastUpdated}</p>
                )}
              </div>
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
          </div>

          {/* 필터 바 */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <input
              type="text"
              placeholder="상품명 / O코드 검색..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="px-3 py-1.5 text-[12px] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
              style={{ border: '1px solid #E5E7EB', background: '#FAFAFA', width: 200 }}
            />
            <select
              value={seasonFilter}
              onChange={e => setSeasonFilter(e.target.value)}
              className="px-3 py-1.5 text-[12px] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
              style={{ border: '1px solid #E5E7EB', background: '#FAFAFA' }}
            >
              <option value="">시즌 전체</option>
              {seasons.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="px-3 py-1.5 text-[12px] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
              style={{ border: '1px solid #E5E7EB', background: '#FAFAFA' }}
            >
              <option value="">카테고리 전체</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {(search || seasonFilter || categoryFilter) && (
              <button
                onClick={() => { setSearch(''); setSeasonFilter(''); setCategoryFilter('') }}
                className="px-3 py-1.5 text-[12px] rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
                style={{ border: '1px solid #E5E7EB' }}
              >
                초기화
              </button>
            )}
            <span className="text-[11px] text-gray-400 ml-auto">
              {filtered.length}개 표시
            </span>
          </div>
        </div>
      </div>

      {/* ── 테이블 ───────────────────────────────────────────────── */}
      <div className="p-6">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid #EAECF0' }}>
          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: 1100 }}>
              <thead>
                <tr style={{ background: '#FAFAFA', borderBottom: '2px solid #F0F0F0' }}>
                  <th className="px-3 py-3 text-center w-16">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">시즌</span>
                  </th>
                  <th className="px-3 py-3 text-center w-20">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">카테고리</span>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">상품명</span>
                  </th>
                  {CHANNELS.map(ch => (
                    <th key={ch} className="px-2 py-3 text-center w-20">
                      <div className="flex justify-center">
                        <ChannelLogo channelId={ch} size="sm" />
                      </div>
                    </th>
                  ))}
                  <th className="px-3 py-3 text-right w-24">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">가격</span>
                  </th>
                  <th className="px-3 py-3 text-center w-12">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">링크</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={CHANNELS.length + 4} className="py-16 text-center">
                      <Package size={32} className="mx-auto mb-2 text-gray-200" />
                      <p className="text-[13px] text-gray-400">검색 결과가 없습니다.</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map(row => {
                    const key = row.oCode || row.sCode
                    return (
                      <ProductRowItem
                        key={key}
                        row={row}
                        isExpanded={expandedKey === key}
                        onToggle={() => setExpandedKey(expandedKey === key ? null : key)}
                      />
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 안내 */}
        {rankedCount === 0 && (
          <div className="mt-4 px-4 py-3 rounded-xl flex items-start gap-3"
            style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}>
            <span className="text-amber-400 mt-0.5 flex-shrink-0">⚠️</span>
            <p className="text-[12px] text-amber-800 leading-relaxed">
              아직 채널 랭킹 데이터가 수집되지 않았습니다. 대시보드에서 수동 수집을 실행하거나 자동 수집 스케줄을 기다려 주세요.
              수집이 완료되면 채널별 순위가 자동으로 연결됩니다.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
