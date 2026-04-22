import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  TrendingUp, TrendingDown, Minus,
  ChevronDown, ChevronUp, Package, RefreshCw, AlertCircle, Search,
} from 'lucide-react'
import { useRankingStore } from '../store/useRankingStore'
import { useRankingData } from '../hooks/useRankingData'
import { CHANNEL_META } from '../types'
import type { ChannelId, PeriodKey, RankingSnapshot, KeywordRankEntry } from '../types'
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

const KEYWORD_CHANNELS: ChannelId[] = ['coupang', 'smartstore']

function buildChannelRanks(
  product: CatalogProduct,
  snapshots: RankingSnapshot[],
  period: PeriodKey,
  kwRanks: KeywordRankEntry[],
): Partial<Record<ChannelId, ChannelRankInfo>> {
  const ranks: Partial<Record<ChannelId, ChannelRankInfo>> = {}
  const relevant = snapshots.filter(s => s.period === period && !KEYWORD_CHANNELS.includes(s.channelId))
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
  for (const ch of KEYWORD_CHANNELS) {
    if (ranks[ch]) continue
    const matched = kwRanks
      .filter(e => e.channelId === ch && e.rank !== null && e.productName)
      .filter(e => isProductMatch(product.productName, e.productName!))
      .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))[0]
    if (matched && matched.rank !== null) {
      ranks[ch] = {
        rank: matched.rank,
        delta: matched.rankDelta,
        isNew: matched.previousRank === null,
        productUrl: undefined,
      }
    }
  }
  return ranks
}

// ─── 순위 배지 ────────────────────────────────────────────────────────────────

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
    <span className="inline-flex items-center justify-center rounded-lg text-[11px] font-black tabular-nums"
      style={{ background: bg, color: text, minWidth: 34, height: 22, padding: '0 5px' }}>
      #{rank}
    </span>
  )
}

function DeltaBadge({ delta, isNew }: { delta: number | null; isNew: boolean }) {
  if (isNew) return (
    <span className="text-[9px] font-black px-1.5 py-0.5 rounded"
      style={{ background: '#EDE9FE', color: '#7C3AED' }}>NEW</span>
  )
  if (!delta) return <Minus size={9} className="text-slate-200" />
  if (delta > 0) return (
    <span className="flex items-center gap-0.5 text-[10px] font-bold" style={{ color: '#10B981' }}>
      <TrendingUp size={9} />+{delta}
    </span>
  )
  return (
    <span className="flex items-center gap-0.5 text-[10px] font-bold" style={{ color: '#EF4444' }}>
      <TrendingDown size={9} />{Math.abs(delta)}
    </span>
  )
}

function ChannelCell({ data }: { data?: ChannelRankInfo }) {
  if (!data) return (
    <td className="px-2 py-3 text-center align-middle" style={{ width: 64 }}>
      <span className="text-slate-200 text-[12px]">—</span>
    </td>
  )
  return (
    <td className="px-2 py-3 text-center align-middle" style={{ width: 64 }}>
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

// ─── 트렌드 차트 ──────────────────────────────────────────────────────────────

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
    <div className="flex items-center justify-center h-20 text-[12px] text-slate-400">
      수집 데이터가 부족합니다.
    </div>
  )

  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={chartData} margin={{ top: 6, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
        <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
        <YAxis reversed domain={['dataMin - 2', 'dataMax + 2']}
          tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false}
          tickFormatter={(v: number) => `#${v}`} />
        <Tooltip formatter={(v: number) => [`#${v}위`, '']}
          contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 11 }} />
        {activeChannels.map(ch => (
          <Line key={ch} type="monotone" dataKey={ch} name={CHANNEL_META[ch].label}
            stroke={CHANNEL_META[ch].color === '#FEE500' ? '#D4B800' : CHANNEL_META[ch].color}
            strokeWidth={2} dot={{ r: 2.5 }} connectNulls />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

// ─── 상품 행 ──────────────────────────────────────────────────────────────────

const ProductRowItem = ({ row, isExpanded, onToggle }: {
  row: ProductRow
  isExpanded: boolean
  onToggle: () => void
}) => {
  const rankedCount = CHANNELS.filter(ch => row.channelRanks[ch]).length

  return (
    <>
      <tr
        className={`border-b cursor-pointer transition-colors select-none ${
          rankedCount > 0 ? 'hover:bg-blue-50/20' : 'hover:bg-slate-50/50'
        }`}
        style={{ borderBottomColor: '#F1F5F9' }}
        onClick={onToggle}
      >
        {/* 시즌 */}
        <td className="px-3 py-2.5 text-center align-middle" style={{ width: 64 }}>
          {row.season
            ? <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                style={{ background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' }}>{row.season}</span>
            : <span className="text-slate-200 text-[11px]">—</span>}
        </td>
        {/* 카테고리 */}
        <td className="px-3 py-2.5 text-center align-middle" style={{ width: 72 }}>
          {row.category
            ? <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                style={{ background: '#FAF5FF', color: '#7E22CE', border: '1px solid #E9D5FF' }}>{row.category}</span>
            : <span className="text-slate-200 text-[11px]">—</span>}
        </td>
        {/* 이미지 + 제품명 */}
        <td className="px-4 py-2.5 align-middle" style={{ minWidth: 220 }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex-shrink-0 overflow-hidden bg-slate-100"
              style={{ border: '1px solid #E2E8F0' }}>
              {row.imageUrl
                ? <img src={row.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                : <div className="w-full h-full flex items-center justify-center">
                    <Package size={12} className="text-slate-300" />
                  </div>}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-slate-800 leading-snug line-clamp-2">{row.productName}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {row.oCode && <span className="text-[10px] text-slate-400 font-mono">{row.oCode}</span>}
                {rankedCount > 0 && (
                  <span className="text-[9px] font-bold px-1 py-0.5 rounded"
                    style={{ background: '#DCFCE7', color: '#166534' }}>{rankedCount}채널</span>
                )}
              </div>
            </div>
            <span className="flex-shrink-0 text-slate-300 ml-1">
              {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </span>
          </div>
        </td>
        {/* 채널별 순위 */}
        {CHANNELS.map(ch => <ChannelCell key={ch} data={row.channelRanks[ch]} />)}
        {/* 가격 */}
        <td className="px-3 py-2.5 text-right align-middle" style={{ width: 80 }}>
          {row.price > 0
            ? <span className="text-[12px] font-semibold text-slate-700">
                {row.price.toLocaleString()}<span className="text-[10px] font-normal text-slate-400 ml-0.5">원</span>
              </span>
            : <span className="text-slate-200 text-[11px]">—</span>}
        </td>
      </tr>
      {/* 트렌드 확장 */}
      {isExpanded && (
        <tr className="border-b" style={{ borderBottomColor: '#F1F5F9', background: '#F8FAFC' }}>
          <td colSpan={CHANNELS.length + 3} className="px-6 py-4">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">
              순위 추이 — {row.productName}
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

  const [period,         setPeriod]         = useState<PeriodKey>('realtime')
  const [expandedKey,    setExpandedKey]    = useState<string | null>(null)
  const [search,         setSearch]         = useState('')
  const [seasonFilter,   setSeasonFilter]   = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [visibleCount,   setVisibleCount]   = useState(PAGE_SIZE)

  const [catalog,        setCatalog]        = useState<CatalogProduct[] | null>(null)
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError,   setCatalogError]   = useState<string | null>(null)
  const [kwRanks,        setKwRanks]        = useState<KeywordRankEntry[]>([])

  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setCatalogLoading(true)
    Promise.all([
      fetch(`${API_BASE}/api/catalog`)
        .then(r => r.ok ? r.json() : r.json().then((e: { error?: string }) => Promise.reject(e.error ?? '오류'))),
      fetch(`${API_BASE}/api/keywords/ranks`)
        .then(r => r.ok ? r.json() : []).catch(() => []),
    ])
      .then(([cd, kd]: [{ products: CatalogProduct[] }, KeywordRankEntry[]]) => {
        setCatalog(cd.products)
        setKwRanks(Array.isArray(kd) ? kd : [])
        setCatalogLoading(false)
      })
      .catch((e: unknown) => { setCatalogError(String(e)); setCatalogLoading(false) })
  }, [])

  const productRows = useMemo<ProductRow[]>(() => {
    if (!catalog) return []
    const snapshots = data?.snapshots ?? []
    return catalog.map(p => {
      const channelRanks = buildChannelRanks(p, snapshots, period, kwRanks)
      const ranks = Object.values(channelRanks).map(r => r?.rank ?? Infinity)
      const bestRank = ranks.length ? Math.min(...ranks) : Infinity
      return { ...p, channelRanks, bestRank, scraped: ranks.length > 0 }
    }).sort((a, b) => {
      if (a.scraped && !b.scraped) return -1
      if (!a.scraped && b.scraped) return 1
      return (a.bestRank === Infinity ? 9999 : a.bestRank) - (b.bestRank === Infinity ? 9999 : b.bestRank)
    })
  }, [catalog, data, period, kwRanks])

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

  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [search, seasonFilter, categoryFilter, period])

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

  const visibleRows   = filtered.slice(0, visibleCount)
  const seasons       = useMemo(() => [...new Set(productRows.map(r => r.season).filter(Boolean))].sort(), [productRows])
  const categories    = useMemo(() => [...new Set(productRows.map(r => r.category).filter(Boolean))].sort(), [productRows])
  const rankedCount   = productRows.filter(r => r.scraped).length
  const lastUpdated   = data?.scrapedAt
    ? new Date(data.scrapedAt).toLocaleString('ko-KR', {
        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
      })
    : null

  // ── 로딩/에러 화면 ──

  if (catalogLoading) return (
    <div className="flex-1 flex items-center justify-center" style={{ background: '#F8FAFC' }}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-7 h-7 rounded-full animate-spin"
          style={{ border: '2px solid #E2E8F0', borderTopColor: '#6366F1' }} />
        <p className="text-[13px] text-slate-400">상품 카탈로그 불러오는 중...</p>
      </div>
    </div>
  )

  if (catalogError || !catalog) return (
    <div className="flex-1 flex items-center justify-center p-8" style={{ background: '#F8FAFC' }}>
      <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center"
        style={{ border: '1px solid #E2E8F0' }}>
        <AlertCircle size={36} className="mx-auto mb-4 text-amber-400" />
        <h2 className="text-[15px] font-bold text-slate-800 mb-2">전체상품목록 파일 없음</h2>
        <p className="text-[12px] text-slate-500 mb-5 leading-relaxed">
          데이터 관리 페이지에서<br />
          <strong>전체상품목록 XLS 또는 CSV 파일</strong>을 업로드하면<br />
          전체 상품이 표시됩니다.
        </p>
        <a href="/data"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-[13px] font-semibold"
          style={{ background: '#FF5043' }}>
          <RefreshCw size={13} />데이터 관리로 이동
        </a>
        {catalogError && <p className="text-[11px] text-red-400 mt-3">{catalogError}</p>}
      </div>
    </div>
  )

  // ── 메인 렌더 ──

  return (
    <div className="flex flex-col min-h-screen" style={{ background: '#F8FAFC' }}>

      {/* ── 페이지 헤더 ────────────────────────────────────────── */}
      <div className="bg-white px-8 py-5 flex items-center justify-between flex-shrink-0"
        style={{ borderBottom: '1px solid #E2E8F0' }}>
        <div>
          <h1 className="text-[20px] font-bold text-slate-900 leading-tight">상품 랭킹</h1>
          <p className="text-[12px] text-slate-400 mt-0.5">
            전체 <strong className="text-slate-600 font-semibold">{catalog.length.toLocaleString()}</strong>개
            {rankedCount > 0 && <> · 랭킹 수집 <strong className="font-semibold" style={{ color: '#10B981' }}>{rankedCount}</strong>개</>}
            {lastUpdated && <> · 마지막 수집 {lastUpdated}</>}
          </p>
        </div>
        {/* 기간 탭 */}
        <div className="flex items-center rounded-xl p-1 gap-0.5"
          style={{ background: '#F1F5F9', border: '1px solid #E2E8F0' }}>
          {PERIOD_TABS.map(({ key, label }) => (
            <button key={key} onClick={() => setPeriod(key)}
              className="px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
              style={period === key
                ? { background: '#fff', color: '#0F172A', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
                : { color: '#64748B' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 필터 바 ─────────────────────────────────────────────── */}
      <div className="bg-white px-8 py-3 flex items-center gap-3 flex-wrap flex-shrink-0"
        style={{ borderBottom: '1px solid #E2E8F0' }}>
        {/* 검색 */}
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="상품명 / O코드 검색..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-[12px] rounded-lg focus:outline-none"
            style={{
              border: '1px solid #E2E8F0', background: '#F8FAFC', width: 200,
              color: '#0F172A',
            }} />
        </div>
        {/* 시즌 */}
        <select value={seasonFilter} onChange={e => setSeasonFilter(e.target.value)}
          className="px-3 py-1.5 text-[12px] rounded-lg focus:outline-none"
          style={{ border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#475569' }}>
          <option value="">시즌 전체</option>
          {seasons.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {/* 카테고리 */}
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
          className="px-3 py-1.5 text-[12px] rounded-lg focus:outline-none"
          style={{ border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#475569' }}>
          <option value="">카테고리 전체</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {(search || seasonFilter || categoryFilter) && (
          <button onClick={() => { setSearch(''); setSeasonFilter(''); setCategoryFilter('') }}
            className="px-3 py-1.5 text-[12px] rounded-lg text-slate-500 hover:bg-slate-50 transition-colors"
            style={{ border: '1px solid #E2E8F0' }}>초기화</button>
        )}
        <span className="text-[11px] text-slate-400 ml-auto">
          {visibleCount < filtered.length
            ? `${visibleCount.toLocaleString()} / ${filtered.length.toLocaleString()}개`
            : `${filtered.length.toLocaleString()}개`}
        </span>
      </div>

      {/* ── 테이블 ──────────────────────────────────────────────── */}
      <div className="flex-1 p-6">
        <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: 1020 }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                  <th className="px-3 py-3 text-center" style={{ width: 64 }}>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">시즌</span>
                  </th>
                  <th className="px-3 py-3 text-center" style={{ width: 72 }}>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">카테고리</span>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">상품명</span>
                  </th>
                  {CHANNELS.map(ch => (
                    <th key={ch} className="px-2 py-3 text-center" style={{ width: 64 }}>
                      <div className="flex justify-center"><ChannelLogo channelId={ch} size="sm" /></div>
                    </th>
                  ))}
                  <th className="px-3 py-3 text-right" style={{ width: 80 }}>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">가격</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={CHANNELS.length + 3} className="py-16 text-center">
                      <Package size={28} className="mx-auto mb-2 text-slate-200" />
                      <p className="text-[12px] text-slate-400">검색 결과가 없습니다.</p>
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
              <div className="flex items-center gap-2 text-[12px] text-slate-400">
                <div className="w-4 h-4 rounded-full animate-spin"
                  style={{ border: '2px solid #E2E8F0', borderTopColor: '#94A3B8' }} />
                더 불러오는 중... ({visibleCount.toLocaleString()}/{filtered.length.toLocaleString()})
              </div>
            </div>
          )}
        </div>

        {/* 수집 안내 */}
        {rankedCount === 0 && (
          <div className="mt-4 px-4 py-3 rounded-xl flex items-start gap-3"
            style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
            <AlertCircle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-800 leading-relaxed">
              아직 채널 랭킹 수집 데이터가 없습니다. 대시보드에서 전체 수집을 실행하면 채널별 순위가 연결됩니다.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
