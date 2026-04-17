import { useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { CHANNEL_META, PERIOD_LABEL, type ChannelId, type PeriodKey, type HistoryEntry } from '../types'
import { API_BASE } from '../config'

const CHANNELS: ChannelId[] = ['coupang', 'smartstore', 'musinsa', 'boribori', 'lotteon', 'kakao']
const PERIODS: PeriodKey[] = ['realtime', 'daily', 'weekly', 'monthly']

// 랭킹 차트는 낮을수록 좋으므로 Y축 반전
function formatRank(value: number) {
  return `#${value}`
}

export function History() {
  const [selectedChannel, setSelectedChannel] = useState<ChannelId>('musinsa')
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>('realtime')
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    setIsLoading(true)
    fetch(`${API_BASE}/api/history/${selectedChannel}?period=${selectedPeriod}&limit=30`)
      .then((r) => r.json())
      .then((data: HistoryEntry[]) => {
        setHistory(data)
        setIsLoading(false)
      })
      .catch(() => setIsLoading(false))
  }, [selectedChannel, selectedPeriod])

  // 차트 데이터 변환
  // 각 스냅샷 시점의 오즈키즈 제품별 순위를 표시
  const productNames = [...new Set(history.flatMap((h) => h.ozKidsEntries.map((e) => e.productName)))]
  const chartData = history.map((entry) => {
    const point: Record<string, string | number> = {
      date: new Date(entry.scrapedAt).toLocaleDateString('ko-KR', {
        month: 'short', day: 'numeric',
        hour: '2-digit',
      }),
    }
    for (const name of productNames) {
      const found = entry.ozKidsEntries.find((e) => e.productName === name)
      if (found) point[name] = found.rank
    }
    return point
  })

  const LINE_COLORS = ['#ff5043', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']
  const meta = CHANNEL_META[selectedChannel]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">순위 추이</h1>
        <p className="text-sm text-gray-500 mt-0.5">채널별 오즈키즈 제품 순위 변화를 확인하세요</p>
      </div>

      {/* 필터 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-card p-4 flex flex-wrap gap-3">
        <div>
          <p className="text-xs text-gray-500 mb-1.5 font-medium">채널</p>
          <div className="flex flex-wrap gap-1">
            {CHANNELS.map((ch) => {
              const m = CHANNEL_META[ch]
              return (
                <button
                  key={ch}
                  onClick={() => setSelectedChannel(ch)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    selectedChannel === ch
                      ? 'text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  style={selectedChannel === ch ? { backgroundColor: m.color, color: m.textColor } : {}}
                >
                  {m.label}
                </button>
              )
            })}
          </div>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1.5 font-medium">기간</p>
          <div className="flex gap-1">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setSelectedPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedPeriod === p
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {PERIOD_LABEL[p]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 차트 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-6 rounded-full" style={{ backgroundColor: meta.color }} />
          <h2 className="font-semibold text-gray-900">
            {meta.label} — {PERIOD_LABEL[selectedPeriod]} 순위 추이
          </h2>
        </div>

        {isLoading ? (
          <div className="h-64 flex items-center justify-center text-gray-400">
            <p className="text-sm">데이터 로딩 중...</p>
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-gray-400">
            <p className="text-sm">히스토리 데이터가 없습니다</p>
            <p className="text-xs mt-1">스크래핑을 실행하면 데이터가 쌓입니다</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                reversed  // 낮은 순위가 위에 표시
                tickFormatter={formatRank}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <Tooltip
                formatter={(value: number, name: string) => [`#${value}위`, name]}
                contentStyle={{
                  borderRadius: '8px',
                  border: '1px solid #f0f0f0',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '16px' }} />
              {productNames.slice(0, 6).map((name, i) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={LINE_COLORS[i % LINE_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
