import { useEffect, useState, useMemo } from 'react'
import { Plus, RefreshCw, Loader2, Pencil, Trash2, TrendingUp, TrendingDown, Search, Tag } from 'lucide-react'
import { useKeywordStore } from '../store/useKeywordStore'
import { AddKeywordModal } from '../components/AddKeywordModal'
import { ChannelLogo } from '../components/ChannelLogo'
import { CHANNEL_META, KEYWORD_CATEGORIES } from '../types'
import type { Keyword, KeywordRankEntry, ChannelId, KeywordCategory } from '../types'

const ALL_CHANNELS: ChannelId[] = ['coupang', 'smartstore', 'musinsa', 'boribori', 'lotteon', 'kakao']

// ─── 순위 배지 ────────────────────────────────────────────────────────────────

function getRankStyle(rank: number): { bg: string; text: string } {
  if (rank <= 3)  return { bg: '#F59E0B', text: '#fff' }
  if (rank <= 10) return { bg: '#10B981', text: '#fff' }
  if (rank <= 30) return { bg: '#3B82F6', text: '#fff' }
  if (rank <= 50) return { bg: '#8B5CF6', text: '#fff' }
  return { bg: '#94A3B8', text: '#fff' }
}

function RankCell({ rank }: { rank: number | null }) {
  if (rank === null) return <span style={{ color: '#CBD5E1', fontSize: 12 }}>—</span>
  const { bg, text } = getRankStyle(rank)
  return (
    <span className="inline-flex items-center justify-center rounded-lg text-[12px] font-black tabular-nums"
      style={{ background: bg, color: text, minWidth: 36, height: 26, padding: '0 6px' }}>
      #{rank}
    </span>
  )
}

function DeltaCell({ delta }: { delta: number | null }) {
  if (delta === null || delta === 0) return <span style={{ color: '#CBD5E1', fontSize: 12 }}>—</span>
  if (delta > 0) return (
    <span className="inline-flex items-center gap-0.5 text-[11px] font-bold" style={{ color: '#10B981' }}>
      <TrendingUp size={10} />+{delta}
    </span>
  )
  return (
    <span className="inline-flex items-center gap-0.5 text-[11px] font-bold" style={{ color: '#EF4444' }}>
      <TrendingDown size={10} />{Math.abs(delta)}
    </span>
  )
}

function buildDateColumns(ranks: KeywordRankEntry[]) {
  return [...new Set(ranks.map(r => r.date))].sort().slice(-7)
}

// ─── KPI 카드 ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <div className="bg-white rounded-2xl px-5 py-4" style={{ border: '1px solid #E2E8F0' }}>
      <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>{label}</p>
      <p className="text-[26px] font-black mt-1 leading-none" style={{ color: accent }}>{value}</p>
    </div>
  )
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export function KeywordRanking() {
  const {
    keywords, ranks, isLoading, isScraping,
    fetchKeywords, fetchRanks,
    addKeyword, updateKeyword, deleteKeyword,
    triggerScrape,
  } = useKeywordStore()

  const [showModal,     setShowModal]     = useState(false)
  const [editTarget,    setEditTarget]    = useState<Keyword | null>(null)
  const [filterChannel, setFilterChannel] = useState<ChannelId | 'all'>('all')
  const [filterCat,     setFilterCat]     = useState<KeywordCategory | 'all'>('all')
  const [search,        setSearch]        = useState('')

  useEffect(() => { fetchKeywords(); fetchRanks() }, [fetchKeywords, fetchRanks])

  const dateCols = useMemo(() => buildDateColumns(ranks), [ranks])

  const rankMap = useMemo(() => {
    const map: Record<string, Record<string, Record<string, KeywordRankEntry>>> = {}
    for (const r of ranks) {
      if (!map[r.keywordId]) map[r.keywordId] = {}
      if (!map[r.keywordId][r.channelId]) map[r.keywordId][r.channelId] = {}
      map[r.keywordId][r.channelId][r.date] = r
    }
    return map
  }, [ranks])

  const rows = useMemo(() => {
    const result: Array<{ keyword: Keyword; channelId: ChannelId }> = []
    for (const kw of keywords) {
      if (filterCat !== 'all' && kw.category !== filterCat) continue
      if (search && !kw.keyword.includes(search)) continue
      for (const ch of kw.channels) {
        if (filterChannel !== 'all' && ch !== filterChannel) continue
        result.push({ keyword: kw, channelId: ch })
      }
    }
    return result
  }, [keywords, filterChannel, filterCat, search])

  // KPI 계산
  const totalKeywords = keywords.length
  const activeRows = rows.filter(({ keyword: kw, channelId }) => {
    const byDate = rankMap[kw.id]?.[channelId] ?? {}
    const latest = dateCols[dateCols.length - 1]
    return latest ? (byDate[latest]?.rank ?? null) !== null : false
  }).length
  const bestRankRow = rows.reduce<number | null>((best, { keyword: kw, channelId }) => {
    const byDate = rankMap[kw.id]?.[channelId] ?? {}
    const latest = dateCols[dateCols.length - 1]
    const r = latest ? (byDate[latest]?.rank ?? null) : null
    if (r === null) return best
    return best === null ? r : Math.min(best, r)
  }, null)

  function openEdit(kw: Keyword) { setEditTarget(kw); setShowModal(true) }
  function closeModal() { setShowModal(false); setEditTarget(null) }

  async function handleDelete(id: string) {
    if (!confirm('이 키워드를 삭제하시겠습니까?')) return
    await deleteKeyword(id)
  }

  async function handleSubmit(data: Parameters<typeof addKeyword>[0]) {
    if (editTarget) await updateKeyword(editTarget.id, data)
    else await addKeyword(data)
    await fetchRanks()
  }

  const todayStr = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="flex flex-col min-h-screen" style={{ background: '#F8FAFC' }}>

      {/* ── 페이지 헤더 ────────────────────────────────────────── */}
      <div className="bg-white px-8 py-5 flex items-center justify-between flex-shrink-0"
        style={{ borderBottom: '1px solid #E2E8F0' }}>
        <div>
          <h1 className="text-[20px] font-bold text-slate-900 leading-tight">키워드 랭킹</h1>
          <p className="text-[12px] text-slate-400 mt-0.5">{todayStr}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={triggerScrape}
            disabled={isScraping}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition-all"
            style={isScraping
              ? { background: '#F1F5F9', color: '#94A3B8', border: '1px solid #E2E8F0' }
              : { background: '#fff', color: '#475569', border: '1px solid #E2E8F0' }}>
            {isScraping
              ? <><Loader2 size={13} className="animate-spin" /> 수집 중...</>
              : <><RefreshCw size={13} /> 수동 수집</>}
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold text-white transition-all"
            style={{ background: '#FF5043' }}>
            <Plus size={13} />
            키워드 추가
          </button>
        </div>
      </div>

      <div className="flex-1 p-6 space-y-5">

        {/* ── KPI 카드 ──────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4">
          <KpiCard label="등록 키워드" value={totalKeywords} accent="#6366F1" />
          <KpiCard label="랭킹 발견" value={activeRows} accent="#10B981" />
          <KpiCard label="최고 순위" value={bestRankRow !== null ? `#${bestRankRow}` : '—'} accent="#F59E0B" />
        </div>

        {/* ── 필터 + 테이블 ─────────────────────────────────────── */}
        <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>

          {/* 필터 바 */}
          <div className="px-5 py-3.5 flex items-center gap-3 flex-wrap"
            style={{ borderBottom: '1px solid #F1F5F9' }}>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="키워드 검색..."
                className="pl-8 pr-3 py-1.5 text-[12px] rounded-lg focus:outline-none"
                style={{ border: '1px solid #E2E8F0', background: '#F8FAFC', width: 180, color: '#0F172A' }}
              />
            </div>

            {/* 채널 필터 */}
            <select
              value={filterChannel}
              onChange={e => setFilterChannel(e.target.value as ChannelId | 'all')}
              className="px-3 py-1.5 text-[12px] rounded-lg focus:outline-none"
              style={{ border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#475569' }}
            >
              <option value="all">채널 전체</option>
              {ALL_CHANNELS.map(ch => (
                <option key={ch} value={ch}>{CHANNEL_META[ch].label}</option>
              ))}
            </select>

            {/* 분류 필터 */}
            <select
              value={filterCat}
              onChange={e => setFilterCat(e.target.value as KeywordCategory | 'all')}
              className="px-3 py-1.5 text-[12px] rounded-lg focus:outline-none"
              style={{ border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#475569' }}
            >
              <option value="all">분류 전체</option>
              {KEYWORD_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            <span className="ml-auto text-[11px] text-slate-400">{rows.length}개 행</span>
          </div>

          {/* 테이블 */}
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 size={20} className="animate-spin text-slate-300" />
            </div>
          ) : keywords.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-52 gap-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: '#F8FAFC' }}>
                <Tag size={20} className="text-slate-300" />
              </div>
              <p className="text-[14px] font-semibold text-slate-500">등록된 키워드가 없습니다</p>
              <p className="text-[12px] text-slate-400">키워드를 추가하면 각 채널에서의 순위를 추적합니다</p>
              <button
                onClick={() => setShowModal(true)}
                className="mt-1 flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-semibold text-white"
                style={{ background: '#FF5043' }}
              >
                <Plus size={13} /> 첫 키워드 추가하기
              </button>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-slate-400">
              <p className="text-[13px]">검색 결과가 없습니다</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                    <th className="px-5 py-3 text-left">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">분류</span>
                    </th>
                    <th className="px-5 py-3 text-left">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">키워드</span>
                    </th>
                    <th className="px-5 py-3 text-left">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">채널</span>
                    </th>
                    <th className="px-4 py-3 text-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">최신 순위</span>
                    </th>
                    <th className="px-4 py-3 text-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">변동</span>
                    </th>
                    {dateCols.map(d => (
                      <th key={d} className="px-3 py-3 text-center">
                        <span className="text-[10px] font-semibold text-slate-400">
                          {d.slice(5).replace('-', '/')}
                        </span>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">관리</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ keyword: kw, channelId }, idx) => {
                    const byDate = rankMap[kw.id]?.[channelId] ?? {}
                    const latest = dateCols[dateCols.length - 1]
                    const entry  = latest ? byDate[latest] : undefined
                    const rank   = entry?.rank ?? null
                    const delta  = entry?.rankDelta ?? null

                    return (
                      <tr
                        key={`${kw.id}_${channelId}`}
                        className="group transition-colors hover:bg-slate-50"
                        style={{ borderBottom: idx < rows.length - 1 ? '1px solid #F1F5F9' : 'none' }}
                      >
                        {/* 분류 */}
                        <td className="px-5 py-3 whitespace-nowrap">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0' }}>
                            {kw.category}
                          </span>
                        </td>

                        {/* 키워드 */}
                        <td className="px-5 py-3 whitespace-nowrap">
                          <span className="text-[14px] font-bold text-slate-800">{kw.keyword}</span>
                        </td>

                        {/* 채널 */}
                        <td className="px-5 py-3 whitespace-nowrap">
                          <ChannelLogo channelId={channelId} size="sm" />
                        </td>

                        {/* 최신 순위 */}
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <RankCell rank={rank} />
                        </td>

                        {/* 변동 */}
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <DeltaCell delta={delta} />
                        </td>

                        {/* 날짜별 순위 */}
                        {dateCols.map(d => {
                          const r = byDate[d]?.rank ?? null
                          return (
                            <td key={d} className="px-3 py-3 text-center whitespace-nowrap">
                              {r !== null ? (
                                <span className="text-[12px] font-semibold tabular-nums"
                                  style={{
                                    color: r <= 3 ? '#F59E0B' : r <= 10 ? '#10B981' : r <= 30 ? '#3B82F6' : '#94A3B8'
                                  }}>
                                  {r}
                                </span>
                              ) : (
                                <span style={{ color: '#E2E8F0', fontSize: 12 }}>—</span>
                              )}
                            </td>
                          )
                        })}

                        {/* 관리 */}
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => openEdit(kw)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                              title="수정">
                              <Pencil size={13} className="text-slate-400" />
                            </button>
                            <button
                              onClick={() => handleDelete(kw.id)}
                              className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                              title="삭제">
                              <Trash2 size={13} className="text-red-400" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 모달 */}
      {showModal && (
        <AddKeywordModal
          onClose={closeModal}
          onSubmit={handleSubmit}
          editTarget={editTarget}
        />
      )}
    </div>
  )
}
