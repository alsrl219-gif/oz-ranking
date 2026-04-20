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

// ─── 키워드 랭킹 시스템 ───────────────────────────────────────────

export type KeywordCategory =
  | '아우터'
  | '원피스'
  | '세트'
  | '장화'
  | '구두'
  | '실내화'
  | '기타'

export interface Keyword {
  id: string
  keyword: string
  category: KeywordCategory
  channels: ChannelId[]
  createdAt: string
}

export interface KeywordRankEntry {
  keywordId: string
  keyword: string
  category: string
  channelId: ChannelId
  rank: number | null
  previousRank: number | null
  rankDelta: number | null
  productName: string | null
  productImage: string | null
  price: number | null
  date: string       // YYYY-MM-DD
  scrapedAt: string
}

// ─── 파일 업로드 ──────────────────────────────────────────────────

export type UploadFileType = 'easyAdmin' | 'coupangSales' | 'coupangOrder'

export interface UploadedFile {
  id: string
  originalName: string
  storedName: string
  fileType: UploadFileType
  uploadedAt: string
  size: number
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
