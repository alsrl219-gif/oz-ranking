import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
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
const PAGE_SIZE = 50

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

// ─── 매칭 ─────────────────────────────────────────────────────────────────────

function normalizeForMatch(s: string): string {
  return s.replace(/[()（）\[\]【】\-_]/g, ' ').replace(/\s+/g, '').toLowerCase()
}

function isProductMatch(catalogName: string, channelName: string): boolean {
  const cat = normalizeForMatch(catalogName)
  const ch  = normalizeForMatch(channelName)
  if (cat.length < 3) return false
  if (ch.includes(cat) || cat.includes(ch)) return true

  const tokens = catalogName
    .replace(/[()（）\[\]【】-]/g, ' ')
    .split(/\s+/)
    .map(t => t.trim().toLowerCase())
    .filter(t => t.length >= 2)
  if (tokens.length === 0) return false
  const matchCount = tokens.filter(t => ch.includes(t)).length
  return matchCount >= Math.max(1, Math.floor(tokens.length * 0.6))
}

function buildChannelRanks(
  product: CatalogProduct,
  snapshots: RankingSnapshot[],
  period: PeriodKey,
): Partial<Record<ChannelId, ChannelRankInfo>> {
  const ranks: Partial<Record<ChannelId, ChannelRankInfo>> = {}
  const relevant = snapshots.filter(s => s.period === period)
  for (const snap of relevant) {
    if (ranks[snap.channelId]) continue
    const matched = snap.ozKidsEntries.find(e => isProductMatch(product.productName, e.productName))
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

// ─── 서브컴포넌트 ──────────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  const style: React.CSSProperties =
    rank === 1 ? { background: '#FFD700', color: '#7A5C00', border: '1px solid #F0C800' } :
    rank === 2 ? { background: '#E8E8E8', color: '#5A5A5A', border: '1px solid #D0D0D0' } :
    rank === 3 ? { background: '#F5CBA7', color: '#784212', border: '1px solid #E8A87C' } :
    rank <= 10  ? { background: '#EEF2FF', color: '#4338CA', border: '1px solid #C7D2FE' } :
    rank <= 30  ? { background: '#F0FDF4', color: '#166534', border: '1px solid #BBF7D0' } :
                  { background: '#F9FAFB', color: '#6B7280', border: '1px solid #E5E7EB' }
  return (
    <span className="inline-flex items-center justify-center rounded-lg text-[11px] font-bold tabular-nums"
      style={{ ...style, minWidth: 34, height: 22, padding: '0 5px' }}>
      {rank}위
    </span>
  )
}

function DeltaBadge({ delta, isNew }: { delta: number | null; isNew: boolean }) {
  if (isNew) return (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
      style={{ background: '#EDE9FE', color: '#7C3AED' }}>NEW</span>
  )
  if (!delta) return <Minus size={9} className="text-gray-200" />
  if (delta > 0) return (
    <span className="flex items-center gap-0.5 text-[10px] font-bold" style={{ color: '#16A34A' }}>
      <TrendingUp size={9} />+{delta}
    </span>
  )
  return (
    <span className="flex items-center gap-0.5 text-[10px] font-bold" style={{ color: '#DC2626' }}>
      <TrendingDown size={9} />{Math.abs(delta)}
    </span>
  )
}

function ChannelCell({ data }: { data?: ChannelRankInfo }) {
  if (!data) return (
    <td className="px-2 py-3 text-center align-middle w-16">
      <span className="text-gray-200 text-[12px]">—</span>
    </td>
  )
  return (
    <td className="px-2 py-3 text-center align-middle w-16">
      <div className="flex flex-col items-center gap-0.5">
        {data.productUrl
          ? <a href={data.productUrl} target="_blank" rel="noopener noreferrer"><RankBadge rank={data.rank} /></a>
          : <RankBadge rank={data.rank} />
        }
        <DeltaBadge delta={data.delta} isNew={data.isNew} />
      </div>
    </td>
  )
}

// 트렌드 차트 (확장 시에만 렌더)
function TrendChart({ product }: { product: CatalogProduct }) {
  const { data } = useRankingStore()

  const chartData = useMemo(() => {
    if (!data) return []
    const timeMap = new Map<string, Record<string, number | string>>()
    for (const snap of data.snapshots) {
      const matched = snap.ozKidsEntries.find(e => isProductMatch(product.productName, e.productName))
      if (!matched) continue
      const t = new Date(snap.scrapedAt).toLocaleString('ko-KR', {
        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
      })
      if (!timeMap.has(t)) timeMap.set(t, { time: t })
      timeMap.get(t)![snap.channelId] = matched.rank
    }
    return [...timeMap.values()]
  }, [data, product.productName])

  const activeChannels = CHANNELS.filter(ch => chartData.some(p => typeof p[ch] === 'number'))

  if (chartData.length < 2) return (
    <div className="flex items-center justify-center h-24 text-[12px] text-gray-400">
      수집 데이터가 아직 부족합니다.
    </div>
  )

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={chartData} margin={{ top: 6, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
        <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
        <YAxis reversed domain={['dataMin - 2', 'dataMax + 2']}
          tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false}
          tickFormatter={(v: number) => `#${v}`} />
        <Tooltip formatter={(v: number) => [`#${v}위`, '']}
          contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 11 }} />
        <Legend wrapperStyle={{ fontSize: 10 }} />
        {activeChannels.map(ch => (
          <Line key={ch} type="monotone" dataKey={ch} name={CHANNEL_META[ch].label}
            stroke={CHANNEL_META[ch].color === '#FEE500' ? '#D4B800' : CHANNEL_META[ch].color}
            strokeWidth={2} dot={{ r: 2.5 }} connectNulls />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

// 개별 상품 행 (memo로 불필요한 리렌더 방지)
const ProductRowItem = ({ row, isExpanded, onToggle }: {
  row: ProductRow
  isExpanded: boolean
  onToggle: () => void
}) => {
  const anyUrl = CHANNELS.map(ch => row.channelRanks[ch]?.productUrl).find(Boolean)
  const rankedCount = CHANNELS.filter(ch => row.channelRanks[ch]).length

  return (
    <>
      <tr
        className={`border-b border-gray-100 cursor-pointer transition-colors select-none ${
          rankedCount > 0 ? 'hover:bg-blue-50/30' : 'hover:bg-gray-50/50'
        }`}
        onClick={onToggle}
      >
        {/* 시즌 */}
        <td className="px-3 py-2.5 text-center align-middle w-16">
          {row.season
            ? <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap"
                style={{ background: '#F0F9FF', color: '#0369A1', border: '1px solid #BAE6FD' }}>{row.season}</span>
            : <span className="text-gray-200 text-[11px]">—</span>}
        </td>
        {/* 카테고리 */}
        <td className="px-3 py-2.5 text-center align-middle w-16">
          {row.category
            ? <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap"
                style={{ background: '#FDF4FF', color: '#7E22CE', border: '1px solid #E9D5FF' }}>{row.category}</span>
            : <span className="text-gray-200 text-[11px]">—</span>}
        </td>
        {/* 이미지 + 제품명 */}
        <td className="px-4 py-2.5 align-middle" style={{ minWidth: 200 }}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg flex-shrink-0 overflow-hidden bg-gray-100 border border-gray-200">
              {row.imageUrl
                ? <img src={row.imageUrl} alt="" className="w-full h-full object-cover"
                    loading="lazy"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                : <div className="w-full h-full flex items-center justify-center">
                    <Package size={12} className="text-gray-300" />
                  </div>}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-gray-800 leading-snug line-clamp-2">{row.productName}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {row.oCode && <span className="text-[10px] text-gray-400 font-mono">{row.oCode}</span>}
                {rankedCount > 0 && (
                  <span className="text-[9px] font-bold px-1 py-0.5 rounded"
                    style={{ background: '#DCFCE7', color: '#166534' }}>{rankedCount}채널</span>
                )}
              </div>
            </div>
            <span className="flex-shrink-0 text-gray-300 ml-1">
              {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </span>
          </div>
        </td>
        {/* 채널별 순위 */}
        {CHANNELS.map(ch => <ChannelCell key={ch} data={row.channelRanks[ch]} />)}
        {/* 가격 */}
        <td className="px-3 py-2.5 text-right align-middle w-20">
          {row.price > 0
            ? <span className="text-[12px] font-semibold text-gray-700">{row.price.toLocaleString()}<span className="text-[10px] font-normal text-gray-400 ml-0.5">원</span></span>
            : <span className="text-gray-200 text-[11px]">—</span>}
        </td>
        {/* 링크 */}
        <td className="px-3 py-2.5 text-center align-middle w-10">
          {anyUrl
            ? <a href={anyUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                className="inline-flex items-center justify-center w-6 h-6 rounded-md hover:bg-gray-100 transition-colors">
                <ExternalLink size={11} className="text-gray-400" />
              </a>
            : <span className="text-gray-200 text-[11px]">—</span>}
        </td>
      </tr>
      {/* 트렌드 차트 확장 */}
      {isExpanded && (
        <tr className="bg-gradient-to-b from-blue-50/40 to-white border-b border-gray-100">
          <td colSpan={CHANNELS.length + 4} className="px-6 py-4">
            <p className="text-[11px] font-semibold text-gray-400 mb-2">📈 순위 추이 — {row.productName}</p>
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

  const [period,         setPeriod]         = useState<PeriodKey>('realtime')
  const [expandedKey,    setExpandedKey]    = useState<string | null>(null)
  const [search,         setSearch]         = useState('')
  const [seasonFilter,   setSeasonFilter]   = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [visibleCount,   setVisibleCount]   = useState(PAGE_SIZE)

  const [catalog,        setCatalog]        = useState<CatalogProduct[] | null>(null)
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError,   setCatalogError]   = useState<string | null>(null)

  const sentinelRef = useRef<HTMLDivElement>(null)

  // 카탈로그 로드
  useEffect(() => {
    setCatalogLoading(true)
    fetch(`${API_BASE}/api/catalog`)
      .then(r => r.ok ? r.json() : r.json().then((e: { error?: string }) => Promise.reject(e.error ?? '오류')))
      .then((d: { products: CatalogProduct[] }) => { setCatalog(d.products); setCatalogLoading(false) })
      .catch((e: unknown) => { setCatalogError(String(e)); setCatalogLoading(false) })
  }, [])

  // 채널 순위 병합
  const productRows = useMemo<ProductRow[]>(() => {
    if (!catalog) return []
    const snapshots = data?.snapshots ?? []
    return catalog.map(p => {
      const channelRanks = buildChannelRanks(p, snapshots, period)
      const ranks = Object.values(channelRanks).map(r => r?.rank ?? Infinity)
      const bestRank = ranks.length ? Math.min(...ranks) : Infinity
      return { ...p, channelRanks, bestRank, scraped: ranks.length > 0 }
    }).sort((a, b) => {
      if (a.scraped && !b.scraped) return -1
      if (!a.scraped && b.scraped) return 1
      return (a.bestRank === Infinity ? 9999 : a.bestRank) - (b.bestRank === Infinity ? 9999 : b.bestRank)
    })
  }, [catalog, data, period])

  // 필터 (검색/시즌/카테고리)
  const filtered = useMemo(() => {
    let rows = productRows
    const q = search.trim().toLowerCase()
    if (q) rows = rows.filter(r =>
      r.productName.toLowerCase().includes(q) ||
      r.oCode.toLowerCase().includes(q) ||
      r.sCode.toLowerCase().includes(q)
    )
    if (seasonFilter)   rows = rows.filter(r => r.season === seasonFilter)
    if (categoryFilter) rows = rows.filter(r => r.category === categoryFilter)
    return rows
  }, [productRows, search, seasonFilter, categoryFilter])

  // 필터 변경 시 visible 리셋
  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [search, seasonFilter, categoryFilter, period])

  // IntersectionObserver — 스크롤 끝에 닿으면 더 로드
  const loadMore = useCallback(() => {
    setVisibleCount(prev => Math.min(prev + PAGE_SIZE, filtered.length))
  }, [filtered.length])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore() },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [loadMore])

  const visibleRows = filtered.slice(0, visibleCount)
  const seasons    = useMemo(() => [...new Set(productRows.map(r => r.season).filter(Boolean))].sort(), [productRows])
  const categories = useMemo(() => [...new Set(productRows.map(r => r.category).filter(Boolean))].sort(), [productRows])
  const rankedCount = productRows.filter(r => r.scraped).length
  const lastUpdated = data?.scrapedAt
    ? new Date(data.scrapedAt).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
    : null

  // ── 에러/로딩 화면 ──

  if (catalogLoading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#F8F9FB' }}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-7 h-7 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-[13px] text-gray-400">상품 카탈로그 불러오는 중...</p>
      </div>
    </div>
  )

  if (catalogError || !catalog) return (
    <div className="min-h-screen flex items-center justify-center p-8" style={{ background: '#F8F9FB' }}>
      <div className="bg-white rounded-2xl shadow-sm p-8 max-w-md w-full text-center"
        style={{ border: '1px solid #EAECF0' }}>
        <AlertCircle size={36} className="mx-auto mb-4 text-amber-400" />
        <h2 className="text-[15px] font-bold text-gray-800 mb-2">전체상품목록 파일 없음</h2>
        <p className="text-[12px] text-gray-500 mb-5 leading-relaxed">
          데이터 관리 페이지에서<br />
          <strong>전체상품목록 XLS 또는 CSV 파일</strong>을 업로드하면<br />
          전체 상품이 표시됩니다.
        </p>
        <a href="/data"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-[13px] font-semibold"
          style={{ background: 'linear-gradient(135deg, #FF5043, #FF7A6D)' }}>
          <RefreshCw size={13} />데이터 관리로 이동
        </a>
        {catalogError && <p className="text-[11px] text-red-400 mt-3">{catalogError}</p>}
      </div>
    </div>
  )

  // ── 메인 렌더 ──

  return (
    <div className="min-h-screen" style={{ background: '#F8F9FB' }}>

      {/* ── 헤더 ──────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-[17px] font-extrabold text-gray-900">상품 랭킹</h1>
              <p className="text-[11px] text-gray-400 mt-0.5">
                전체 <strong className="text-gray-600">{catalog.length.toLocaleString()}</strong>개
                {rankedCount > 0 && <> · 랭킹 <strong className="text-green-600">{rankedCount}</strong>개</>}
                {lastUpdated && <> · 수집 {lastUpdated}</>}
              </p>
            </div>
            {/* 기간 탭 */}
            <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-0.5">
              {PERIOD_TABS.map(({ key, label }) => (
                <button key={key} onClick={() => setPeriod(key)}
                  className="px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
                  style={period === key
                    ? { background: '#fff', color: '#1A1D2E', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }
                    : { color: '#9CA3AF' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 필터 바 */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <input type="text" placeholder="상품명 / O코드 검색..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="px-3 py-1.5 text-[12px] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
              style={{ border: '1px solid #E5E7EB', background: '#FAFAFA', width: 190 }} />
            <select value={seasonFilter} onChange={e => setSeasonFilter(e.target.value)}
              className="px-3 py-1.5 text-[12px] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
              style={{ border: '1px solid #E5E7EB', background: '#FAFAFA' }}>
              <option value="">시즌 전체</option>
              {seasons.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
              className="px-3 py-1.5 text-[12px] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
              style={{ border: '1px solid #E5E7EB', background: '#FAFAFA' }}>
              <option value="">카테고리 전체</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {(search || seasonFilter || categoryFilter) && (
              <button onClick={() => { setSearch(''); setSeasonFilter(''); setCategoryFilter('') }}
                className="px-3 py-1.5 text-[12px] rounded-lg text-gray-500 hover:bg-gray-100"
                style={{ border: '1px solid #E5E7EB' }}>초기화</button>
            )}
            <span className="text-[11px] text-gray-400 ml-auto">
              {visibleCount < filtered.length
                ? `${visibleCount} / ${filtered.length.toLocaleString()}개`
                : `${filtered.length.toLocaleString()}개`}
            </span>
          </div>
        </div>
      </div>

      {/* ── 테이블 ─────────────────────────────────────────────── */}
      <div className="p-6">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid #EAECF0' }}>
          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: 1000 }}>
              <thead>
                <tr style={{ background: '#FAFAFA', borderBottom: '2px solid #F0F0F0' }}>
                  <th className="px-3 py-2.5 text-center w-16"><span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">시즌</span></th>
                  <th className="px-3 py-2.5 text-center w-16"><span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">카테고리</span></th>
                  <th className="px-4 py-2.5 text-left"><span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">상품명</span></th>
                  {CHANNELS.map(ch => (
                    <th key={ch} className="px-2 py-2.5 text-center w-16">
                      <div className="flex justify-center"><ChannelLogo channelId={ch} size="sm" /></div>
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-right w-20"><span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">가격</span></th>
                  <th className="px-3 py-2.5 text-center w-10"><span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">링크</span></th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={CHANNELS.length + 4} className="py-14 text-center">
                      <Package size={28} className="mx-auto mb-2 text-gray-200" />
                      <p className="text-[12px] text-gray-400">검색 결과가 없습니다.</p>
                    </td>
                  </tr>
                ) : (
                  visibleRows.map(row => {
                    const key = row.oCode || row.sCode
                    return (
                      <ProductRowItem key={key} row={row}
                        isExpanded={expandedKey === key}
                        onToggle={() => setExpandedKey(expandedKey === key ? null : key)} />
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* 무한 스크롤 sentinel */}
          {visibleCount < filtered.length && (
            <div ref={sentinelRef} className="flex items-center justify-center py-6">
              <div className="flex items-center gap-2 text-[12px] text-gray-400">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                더 불러오는 중... ({visibleCount}/{filtered.length.toLocaleString()})
              </div>
            </div>
          )}
        </div>

        {/* 수집 안내 */}
        {rankedCount === 0 && (
          <div className="mt-4 px-4 py-3 rounded-xl flex items-start gap-3"
            style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}>
            <span className="text-amber-400 flex-shrink-0">⚠️</span>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              아직 채널 랭킹 수집 데이터가 없습니다. 대시보드에서 수동 수집을 실행하면 채널별 순위가 자동 연결됩니다.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
