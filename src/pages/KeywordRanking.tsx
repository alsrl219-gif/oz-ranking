import { useEffect, useState, useMemo } from 'react'
import { Plus, RefreshCw, Loader2, Pencil, Trash2 } from 'lucide-react'
import { useKeywordStore } from '../store/useKeywordStore'
import { AddKeywordModal } from '../components/AddKeywordModal'
import { CHANNEL_META, KEYWORD_CATEGORIES } from '../types'
import type { Keyword, KeywordRankEntry, ChannelId, KeywordCategory } from '../types'

// 순위 색상
function rankColor(rank: number | null): string {
  if (rank === null) return 'text-gray-400'
  if (rank === 1) return 'text-yellow-500 font-bold'
  if (rank === 2) return 'text-gray-400 font-bold'
  if (rank === 3) return 'text-orange-400 font-bold'
  if (rank <= 10) return 'text-blue-600'
  return 'text-gray-600'
}

function rankBg(rank: number | null): string {
  if (rank === null) return 'bg-gray-50'
  if (rank === 1) return 'bg-yellow-50'
  if (rank === 2) return 'bg-gray-100'
  if (rank === 3) return 'bg-orange-50'
  if (rank <= 10) return 'bg-blue-50'
  return ''
}

// 날짜별로 그룹화 된 랭킹 (키워드×채널 기준)
function buildDateColumns(ranks: KeywordRankEntry[]): string[] {
  const dates = [...new Set(ranks.map((r) => r.date))].sort()
  return dates.slice(-7) // 최근 7일
}

export function KeywordRanking() {
  const {
    keywords,
    ranks,
    isLoading,
    isScraping,
    fetchKeywords,
    fetchRanks,
    addKeyword,
    updateKeyword,
    deleteKeyword,
    triggerScrape,
  } = useKeywordStore()

  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Keyword | null>(null)
  const [filterChannel, setFilterChannel] = useState<ChannelId | 'all'>('all')
  const [filterCategory, setFilterCategory] = useState<KeywordCategory | 'all'>('all')

  useEffect(() => {
    fetchKeywords()
    fetchRanks()
  }, [fetchKeywords, fetchRanks])

  // 날짜 컬럼 목록 (최근 7일)
  const dateCols = useMemo(() => buildDateColumns(ranks), [ranks])

  // 랭킹 맵: keywordId → channelId → date → entry
  const rankMap = useMemo(() => {
    const map: Record<string, Record<string, Record<string, KeywordRankEntry>>> = {}
    for (const r of ranks) {
      if (!map[r.keywordId]) map[r.keywordId] = {}
      if (!map[r.keywordId][r.channelId]) map[r.keywordId][r.channelId] = {}
      map[r.keywordId][r.channelId][r.date] = r
    }
    return map
  }, [ranks])

  // 표시할 행: 키워드 × 채널
  const rows = useMemo(() => {
    const result: Array<{ keyword: Keyword; channelId: ChannelId }> = []
    for (const kw of keywords) {
      if (filterCategory !== 'all' && kw.category !== filterCategory) continue
      for (const ch of kw.channels) {
        if (filterChannel !== 'all' && ch !== filterChannel) continue
        result.push({ keyword: kw, channelId: ch })
      }
    }
    return result
  }, [keywords, filterChannel, filterCategory])

  async function handleDelete(id: string) {
    if (!confirm('이 키워드를 삭제하시겠습니까?')) return
    await deleteKeyword(id)
  }

  function openEdit(kw: Keyword) {
    setEditTarget(kw)
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditTarget(null)
  }

  async function handleSubmit(data: Parameters<typeof addKeyword>[0]) {
    if (editTarget) {
      await updateKeyword(editTarget.id, data)
    } else {
      await addKeyword(data)
    }
    await fetchRanks()
  }

  const ALL_CHANNELS: ChannelId[] = ['coupang', 'smartstore', 'musinsa', 'boribori', 'lotteon', 'kakao']

  return (
    <div className="space-y-5">
      {/* 페이지 타이틀 */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">키워드 검색 랭킹</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            키워드별 채널 검색 결과에서 오즈키즈 제품 순위를 추적합니다
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={triggerScrape}
            disabled={isScraping}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-60 transition-colors"
          >
            {isScraping ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {isScraping ? '수집 중' : '수동 수집'}
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 transition-colors"
          >
            <Plus size={14} />
            키워드 추가
          </button>
        </div>
      </div>

      {/* 필터 */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 font-medium">채널</span>
          <select
            value={filterChannel}
            onChange={(e) => setFilterChannel(e.target.value as ChannelId | 'all')}
            className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-400"
          >
            <option value="all">전체</option>
            {ALL_CHANNELS.map((ch) => (
              <option key={ch} value={ch}>{CHANNEL_META[ch].label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 font-medium">분류</span>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as KeywordCategory | 'all')}
            className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-400"
          >
            <option value="all">전체</option>
            {KEYWORD_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        <span className="text-xs text-gray-400 ml-auto">
          {rows.length}개 행
        </span>
      </div>

      {/* 테이블 */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 size={24} className="animate-spin text-brand-400" />
        </div>
      ) : keywords.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-10 text-center">
          <p className="text-gray-500 text-sm">등록된 키워드가 없습니다.</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-3 text-brand-500 text-sm font-medium hover:underline"
          >
            첫 키워드 추가하기
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap">분류</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap">키워드</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap">채널</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 whitespace-nowrap">최신 순위</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 whitespace-nowrap">추이</th>
                {dateCols.map((d) => (
                  <th key={d} className="px-3 py-3 text-center text-xs font-medium text-gray-500 whitespace-nowrap">
                    {d.slice(5)} {/* MM-DD */}
                  </th>
                ))}
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 whitespace-nowrap">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map(({ keyword: kw, channelId }) => {
                const chMeta = CHANNEL_META[channelId]
                const byDate = rankMap[kw.id]?.[channelId] ?? {}
                const latestDate = dateCols[dateCols.length - 1]
                const latestEntry = latestDate ? byDate[latestDate] : undefined
                const latestRank = latestEntry?.rank ?? null
                const delta = latestEntry?.rankDelta ?? null

                return (
                  <tr key={`${kw.id}_${channelId}`} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {kw.category}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-medium text-gray-900 whitespace-nowrap">
                      {kw.keyword}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: chMeta.bgLight, color: chMeta.color }}
                      >
                        {chMeta.label}
                      </span>
                    </td>
                    <td className={`px-4 py-2.5 text-center whitespace-nowrap ${rankBg(latestRank)}`}>
                      <span className={rankColor(latestRank)}>
                        {latestRank !== null ? `${latestRank}위` : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center whitespace-nowrap">
                      {delta === null ? (
                        <span className="text-gray-400">-</span>
                      ) : delta > 0 ? (
                        <span className="text-green-500 text-xs font-medium">▲{delta}</span>
                      ) : delta < 0 ? (
                        <span className="text-red-500 text-xs font-medium">▼{Math.abs(delta)}</span>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>
                    {dateCols.map((d) => {
                      const entry = byDate[d]
                      const r = entry?.rank ?? null
                      return (
                        <td key={d} className={`px-3 py-2.5 text-center whitespace-nowrap ${rankBg(r)}`}>
                          <span className={`text-xs ${rankColor(r)}`}>
                            {r !== null ? `${r}위` : '-'}
                          </span>
                        </td>
                      )
                    })}
                    <td className="px-4 py-2.5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEdit(kw)}
                          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                          title="수정"
                        >
                          <Pencil size={13} className="text-gray-400" />
                        </button>
                        <button
                          onClick={() => handleDelete(kw.id)}
                          className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
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
