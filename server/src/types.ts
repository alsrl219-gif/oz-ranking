export type ChannelId =
  | 'coupang'
  | 'smartstore'
  | 'musinsa'
  | 'boribori'
  | 'lotteon'
  | 'kakao'

export type PeriodKey = 'realtime' | 'daily' | 'weekly' | 'monthly'

export interface RankedProduct {
  rank: number
  productName: string
  brandName: string
  price: number
  imageUrl?: string
  productUrl?: string
  isOzKids: boolean
}

export interface OzKidsEntry {
  rank: number
  productName: string
  price: number
  imageUrl?: string
  productUrl?: string
  previousRank: number | null
  rankDelta: number | null
  isNew: boolean
}

export interface RankingSnapshot {
  channelId: ChannelId
  period: PeriodKey
  scrapedAt: string
  products: RankedProduct[]
  ozKidsEntries: OzKidsEntry[]
  error?: string
}

export interface RankingSummary {
  totalOzKidsAppearances: number
  channelsWithOzKids: number
  bestRankOverall: number | null
  bestRankChannel: ChannelId | null
  lastUpdatedAt: string
}

export interface RankingData {
  snapshots: RankingSnapshot[]
  scrapedAt: string
  summary: RankingSummary
}

export interface ScrapeStatus {
  hasData: boolean
  isRunning: boolean
  lastScrapedAt: string | null
  ageMinutes: number | null
  nextSchedule: string
  channelErrors: Record<ChannelId, string | null>
}

export interface HistoryEntry {
  scrapedAt: string
  channelId: ChannelId
  period: PeriodKey
  ozKidsEntries: OzKidsEntry[]
}

export function isOzKids(text: string): boolean {
  const normalized = text.trim().replace(/\s+/g, '')
  return (
    normalized === '오즈키즈' ||
    normalized.toUpperCase() === 'OZKIZ' ||
    normalized.includes('오즈키즈') ||
    normalized.toUpperCase().includes('OZKIZ') ||
    normalized.toUpperCase().includes('OZ KIDS') ||
    normalized.includes('오즈 키즈')
  )
}
