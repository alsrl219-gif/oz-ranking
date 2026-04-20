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
  scrapingChannels: Partial<Record<ChannelId, boolean>>
  error: string | null
  selectedPeriods: Record<ChannelId, PeriodKey>

  fetchData: () => Promise<void>
  fetchStatus: () => Promise<void>
  triggerScrape: () => Promise<void>
  triggerChannelScrape: (channelId: ChannelId) => Promise<void>
  setChannelPeriod: (channelId: ChannelId, period: PeriodKey) => void
  getSnapshot: (channelId: ChannelId, period: PeriodKey) => RankingSnapshot | null
}

const DEFAULT_PERIODS: Record<ChannelId, PeriodKey> = {
  coupang:    'realtime',
  smartstore: 'daily',    // realtime 미지원 → daily 기본
  musinsa:    'realtime',
  boribori:   'realtime',
  lotteon:    'realtime',
  kakao:      'realtime',
}

export const useRankingStore = create<RankingState>()(
  persist(
    (set, get) => ({
      data: null,
      status: null,
      isLoading: false,
      isScraping: false,
      scrapingChannels: {},
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
            // 서버 수집 완료 시 모든 로딩 상태 초기화
            set((s) => ({
              status,
              isScraping: status.isRunning,
              scrapingChannels: status.isRunning ? s.scrapingChannels : {},
            }))
          }
        } catch {
          // 상태 조회 실패는 무시
        }
      },

      triggerScrape: async () => {
        set({ isScraping: true })
        try {
          const res = await fetch(`${API_BASE}/api/scrape`, { method: 'POST' })
          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            set({ error: err.error ?? '수집 시작 실패', isScraping: false })
            return
          }
          // 주기적으로 상태 + 데이터 폴링
          const poll = (delay: number) => setTimeout(async () => {
            await get().fetchStatus()
            await get().fetchData()
          }, delay)
          poll(10000); poll(30000); poll(60000); poll(120000)
        } catch (e) {
          set({ error: String(e), isScraping: false })
        }
      },

      triggerChannelScrape: async (channelId: ChannelId) => {
        set((s) => ({ scrapingChannels: { ...s.scrapingChannels, [channelId]: true } }))
        try {
          const res = await fetch(`${API_BASE}/api/scrape/${channelId}`, { method: 'POST' })
          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            set((s) => ({
              error: err.error ?? `${channelId} 수집 실패`,
              scrapingChannels: { ...s.scrapingChannels, [channelId]: false },
            }))
            return
          }
          // 채널별 수집 완료 예상 시간에 맞춰 폴링
          const poll = (delay: number) => setTimeout(async () => {
            await get().fetchStatus()
            await get().fetchData()
          }, delay)
          poll(10000); poll(30000); poll(60000)
          // 2분 후 무조건 로딩 해제
          setTimeout(() => {
            set((s) => ({ scrapingChannels: { ...s.scrapingChannels, [channelId]: false } }))
          }, 120000)
        } catch (e) {
          set((s) => ({
            error: String(e),
            scrapingChannels: { ...s.scrapingChannels, [channelId]: false },
          }))
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
