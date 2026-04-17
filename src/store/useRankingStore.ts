import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { API_BASE } from '../config'
import type {
  RankingData,
  ScrapeStatus,
  ChannelId,
  PeriodKey,
  RankingSnapshot,
} from '../types'

interface RankingState {
  data: RankingData | null
  status: ScrapeStatus | null
  isLoading: boolean
  isScraping: boolean
  error: string | null
  selectedPeriods: Record<ChannelId, PeriodKey>

  fetchData: () => Promise<void>
  fetchStatus: () => Promise<void>
  triggerScrape: () => Promise<void>
  setChannelPeriod: (channelId: ChannelId, period: PeriodKey) => void
  getSnapshot: (channelId: ChannelId, period: PeriodKey) => RankingSnapshot | null
}

const DEFAULT_PERIODS: Record<ChannelId, PeriodKey> = {
  coupang: 'realtime',
  smartstore: 'realtime',
  musinsa: 'realtime',
  boribori: 'realtime',
  lotteon: 'realtime',
  kakao: 'realtime',
}

export const useRankingStore = create<RankingState>()(
  persist(
    (set, get) => ({
      data: null,
      status: null,
      isLoading: false,
      isScraping: false,
      error: null,
      selectedPeriods: { ...DEFAULT_PERIODS },

      fetchData: async () => {
        set({ isLoading: true, error: null })
        try {
          const res = await fetch(`${API_BASE}/api/data`)
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: '데이터 없음' }))
            set({ error: err.error ?? '데이터를 불러올 수 없습니다.', isLoading: false })
            return
          }
          const data: RankingData = await res.json()
          set({ data, isLoading: false })
        } catch (e) {
          set({ error: String(e), isLoading: false })
        }
      },

      fetchStatus: async () => {
        try {
          const res = await fetch(`${API_BASE}/api/status`)
          if (res.ok) {
            const status: ScrapeStatus = await res.json()
            set({ status, isScraping: status.isRunning })
          }
        } catch {
          // 상태 조회 실패는 무시
        }
      },

      triggerScrape: async () => {
        set({ isScraping: true })
        try {
          await fetch(`${API_BASE}/api/scrape`, { method: 'POST' })
          // 5초 후 데이터 새로고침 시도 (스크래핑은 비동기)
          setTimeout(() => get().fetchData(), 5000)
          setTimeout(() => get().fetchData(), 15000)
          setTimeout(() => get().fetchData(), 30000)
        } catch (e) {
          set({ error: String(e), isScraping: false })
        }
      },

      setChannelPeriod: (channelId, period) =>
        set((state) => ({
          selectedPeriods: { ...state.selectedPeriods, [channelId]: period },
        })),

      getSnapshot: (channelId, period) => {
        const { data } = get()
        if (!data) return null
        return data.snapshots.find((s) => s.channelId === channelId && s.period === period) ?? null
      },
    }),
    {
      name: 'oz-ranking-ui',
      partialize: (state) => ({ selectedPeriods: state.selectedPeriods }),
    }
  )
)
