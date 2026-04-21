import { useEffect, useState, useMemo } from 'react'
import { Plus, RefreshCw, Loader2, Pencil, Trash2, TrendingUp, TrendingDown, Search } from 'lucide-react'
import { useKeywordStore } from '../store/useKeywordStore'
import { AddKeywordModal } from '../components/AddKeywordModal'
import { ChannelLogo } from '../components/ChannelLogo'
import { CHANNEL_META, KEYWORD_CATEGORIES } from '../types'
import type { Keyword, KeywordRankEntry, ChannelId, KeywordCategory } from '../types'

const ALL_CHANNELS: ChannelId[] = ['coupang', 'smartstore', 'musinsa', 'boribori', 'lotteon', 'kakao']

// ─── 순위 스타일 헬퍼 ──────────────────────────────────────────────
function RankCell({ rank }: { rank: number | null }) {
  if (rank === null) return <span className="text-gray-300 text-xs">—</span>

  const style =
    rank === 1 ? 'bg-amber-400 text-white' :
    rank === 2 ? 'bg-gray-300 text-white' :
    rank === 3 ? 'bg-orange-400 text-white' :
    rank <= 10 ? 'bg-blue-500 text-white' :
    rank <= 30 ? 'bg-blue-100 text-blue-700' :
    'bg-gray-100 text-gray-500'

  return (
    <span className={`inline-flex items-center justify-center w-9 h-7 rounded-lg text-[12px] font-bold ${style}`}>
      {rank}
    </span>
  )
}

function DeltaCell({ delta }: { delta: number | null }) {
  if (delta === null || delta === 0) return <span className="text-gray-300 text-xs">—</span>
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

function buildDateColumns(ranks: KeywordRankEntry[]) {
  return [...new Set(ranks.map(r => r.date))].sort().slice(-7)
}

// ─── 메인 컴포넌트 ──────────────────────────────────────────────────
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

  return (
    <div className="space-y-4">

      {/* ══════════════════════════════════════════════════════
          상단 헤더 카드
      ══════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl px-7 py-5" style={{ border: '1px solid #EAECF0' }}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-[22px] font-extrabold text-gray-900 tracking-tight">키워드 랭킹</h2>
            <p className="text-[13px] text-gray-400 mt-0.5">
              키워드별 채널 검색 결과에서 오즈키즈 제품 순위를 추적합니다
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={triggerScrape}
              disabled={isScraping}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold text-gray-600 transition-all disabled:opacity-60 hover:bg-gray-50"
              style={{ border: '1px solid #EAECF0' }}
            >
              {isScraping ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              수동 수집
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold text-white transition-all"
              style={{ background: 'linear-gradient(135deg, #FF5043 0%, #FF7A6D 100%)', boxShadow: '0 2px 8px rgba(255,80,67,0.3)' }}
            >
              <Plus size={13} />
              키워드 추가
            </button>
          </div>
        </div>

        {/* 검색 + 필터 */}
        <div className="flex items-center gap-3">
          {/* 키워드 검색 */}
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="키워드 검색..."
              className="w-full pl-9 pr-3 py-2 text-[13px] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
              style={{ border: '1px solid #EAECF0', background: '#FAFAFA' }}
            />
          </div>

          {/* 채널 필터 */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-gray-400 font-medium whitespace-nowrap">채널</span>
            <select
              value={filterChannel}
              onChange={e => setFilterChannel(e.target.value as ChannelId | 'all')}
              className="text-[12px] font-medium text-gray-700 px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
              style={{ border: '1px solid #EAECF0', background: '#FAFAFA' }}
            >
              <option value="all">전체</option>
              {ALL_CHANNELS.map(ch => (
                <option key={ch} value={ch}>{CHANNEL_META[ch].label}</option>
              ))}
            </select>
          </div>

          {/* 분류 필터 */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-gray-400 font-medium whitespace-nowrap">분류</span>
            <select
              value={filterCat}
              onChange={e => setFilterCat(e.target.value as KeywordCategory | 'all')}
              className="text-[12px] font-medium text-gray-700 px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
              style={{ border: '1px solid #EAECF0', background: '#FAFAFA' }}
            >
              <option value="all">전체</option>
              {KEYWORD_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <span className="ml-auto text-[11px] text-gray-400 whitespace-nowrap">
            {rows.length}개 행
          </span>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          테이블
      ══════════════════════════════════════════════════════ */}
      {isLoading ? (
        <div className="bg-white rounded-2xl flex items-center justify-center h-48"
          style={{ border: '1px solid #EAECF0' }}>
          <Loader2 size={20} className="animate-spin text-gray-400" />
        </div>

      ) : keywords.length === 0 ? (
        <div className="bg-white rounded-2xl flex flex-col items-center justify-center h-52 gap-3"
          style={{ border: '1px solid #EAECF0' }}>
          <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center">
            <Search size={20} className="text-gray-300" />
          </div>
          <p className="text-sm font-semibold text-gray-500">등록된 키워드가 없습니다.</p>
          <p className="text-xs text-gray-400">키워드를 추가하면 각 채널에서의 순위를 추적합니다</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-1 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, #FF5043 0%, #FF7A6D 100%)' }}
          >
            <Plus size={13} /> 첫 키워드 추가하기
          </button>
        </div>

      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl flex items-center justify-center h-32 text-gray-400"
          style={{ border: '1px solid #EAECF0' }}>
          <p className="text-sm">검색 결과가 없습니다</p>
        </div>

      ) : (
        <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #EAECF0' }}>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr style={{ background: '#F8F9FB', borderBottom: '1px solid #EAECF0' }}>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 whitespace-nowrap tracking-wide uppercase">
                    분류
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 whitespace-nowrap tracking-wide uppercase">
                    키워드
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 whitespace-nowrap tracking-wide uppercase">
                    채널
                  </th>
                  <th className="px-4 py-3 text-center text-[11px] font-semibold text-gray-500 whitespace-nowrap tracking-wide uppercase">
                    최신 순위
                  </th>
                  <th className="px-4 py-3 text-center text-[11px] font-semibold text-gray-500 whitespace-nowrap tracking-wide uppercase">
                    추이
                  </th>
                  {dateCols.map(d => (
                    <th key={d} className="px-3 py-3 text-center text-[11px] font-semibold text-gray-400 whitespace-nowrap">
                      {d.slice(5).replace('-', '/')}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center text-[11px] font-semibold text-gray-500 whitespace-nowrap tracking-wide uppercase">
                    관리
                  </th>
                </tr>
              </thead>

              <tbody>
                {rows.map(({ keyword: kw, channelId }, idx) => {
                  const byDate   = rankMap[kw.id]?.[channelId] ?? {}
                  const latest   = dateCols[dateCols.length - 1]
                  const entry    = latest ? byDate[latest] : undefined
                  const rank     = entry?.rank ?? null
                  const delta    = entry?.rankDelta ?? null

                  return (
                    <tr
                      key={`${kw.id}_${channelId}`}
                      className="group transition-colors"
                      style={{
                        borderBottom: idx < rows.length - 1 ? '1px solid #F4F6F8' : 'none',
                        background: 'white',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'white')}
                    >
                      {/* 분류 */}
                      <td className="px-5 py-3 whitespace-nowrap">
                        <span
                          className="inline-block text-[10px] font-semibold px-2 py-1 rounded-full"
                          style={{ background: '#F4F6F8', color: '#6B7280' }}
                        >
                          {kw.category}
                        </span>
                      </td>

                      {/* 키워드 */}
                      <td className="px-5 py-3 whitespace-nowrap">
                        <span className="text-[14px] font-semibold text-blue-600 cursor-default">
                          {kw.keyword}
                        </span>
                      </td>

                      {/* 채널 */}
                      <td className="px-5 py-3 whitespace-nowrap">
                        <ChannelLogo channelId={channelId} size="sm" />
                      </td>

                      {/* 최신 순위 */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <RankCell rank={rank} />
                      </td>

                      {/* 추이 */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <DeltaCell delta={delta} />
                      </td>

                      {/* 날짜별 순위 */}
                      {dateCols.map(d => {
                        const r = byDate[d]?.rank ?? null
                        return (
                          <td key={d} className="px-3 py-3 text-center whitespace-nowrap">
                            {r !== null ? (
                              <span className={`text-[12px] font-semibold tabular-nums ${
                                r <= 3   ? 'text-amber-500' :
                                r <= 10  ? 'text-blue-500'  :
                                r <= 30  ? 'text-gray-600'  :
                                           'text-gray-400'
                              }`}>
                                {r}
                              </span>
                            ) : (
                              <span className="text-gray-200 text-xs">—</span>
                            )}
                          </td>
                        )
                      })}

                      {/* 관리 */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEdit(kw)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                            title="수정"
                          >
                            <Pencil size={13} className="text-gray-400" />
                          </button>
                          <button
                            onClick={() => handleDelete(kw.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                            title="삭제"
                          >
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
        </div>
      )}

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
