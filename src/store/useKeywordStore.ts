import { create } from 'zustand'
import { API_BASE } from '../config'
import type { Keyword, KeywordRankEntry, KeywordCategory, ChannelId } from '../types'

interface KeywordState {
  keywords: Keyword[]
  ranks: KeywordRankEntry[]
  isLoading: boolean
  isScraping: boolean
  error: string | null

  fetchKeywords: () => Promise<void>
  fetchRanks: () => Promise<void>
  addKeyword: (data: { keyword: string; category: KeywordCategory; channels: ChannelId[] }) => Promise<void>
  updateKeyword: (id: string, data: Partial<Pick<Keyword, 'keyword' | 'category' | 'channels'>>) => Promise<void>
  deleteKeyword: (id: string) => Promise<void>
  triggerScrape: () => Promise<void>
  fetchHistory: (keywordId: string, days?: number) => Promise<KeywordRankEntry[]>
}

export const useKeywordStore = create<KeywordState>((set, get) => ({
  keywords: [],
  ranks: [],
  isLoading: false,
  isScraping: false,
  error: null,

  fetchKeywords: async () => {
    set({ isLoading: true, error: null })
    try {
      const res = await fetch(`${API_BASE}/api/keywords`)
      if (!res.ok) throw new Error('키워드 목록 로드 실패')
      const data: Keyword[] = await res.json()
      set({ keywords: data, isLoading: false })
    } catch (e) {
      set({ error: String(e), isLoading: false })
    }
  },

  fetchRanks: async () => {
    try {
      const res = await fetch(`${API_BASE}/api/keywords/ranks`)
      if (!res.ok) return
      const data: KeywordRankEntry[] = await res.json()
      set({ ranks: data })
    } catch {
      // 무시
    }
  },

  addKeyword: async (data) => {
    const res = await fetch(`${API_BASE}/api/keywords`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: '추가 실패' }))
      throw new Error(err.error ?? '키워드 추가 실패')
    }
    await get().fetchKeywords()
  },

  updateKeyword: async (id, data) => {
    const res = await fetch(`${API_BASE}/api/keywords/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: '수정 실패' }))
      throw new Error(err.error ?? '키워드 수정 실패')
    }
    await get().fetchKeywords()
  },

  deleteKeyword: async (id) => {
    const res = await fetch(`${API_BASE}/api/keywords/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: '삭제 실패' }))
      throw new Error(err.error ?? '키워드 삭제 실패')
    }
    set((state) => ({ keywords: state.keywords.filter((k) => k.id !== id) }))
  },

  triggerScrape: async () => {
    set({ isScraping: true })
    try {
      const res = await fetch(`${API_BASE}/api/keywords/scrape`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '스크래핑 실패' }))
        throw new Error(err.error ?? '스크래핑 실패')
      }
      // 30초 후 결과 새로고침
      setTimeout(() => {
        get().fetchRanks()
      }, 30000)
    } catch (e) {
      set({ error: String(e) })
    } finally {
      set({ isScraping: false })
    }
  },

  fetchHistory: async (keywordId, days = 7) => {
    const res = await fetch(`${API_BASE}/api/keywords/history/${keywordId}?days=${days}`)
    if (!res.ok) return []
    return res.json() as Promise<KeywordRankEntry[]>
  },
}))
