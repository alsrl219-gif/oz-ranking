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
  rankDelta: number | null  // 양수=상승, 음수=하락
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

export interface ChannelMeta {
  id: ChannelId
  label: string
  color: string
  textColor: string
  bgLight: string
  supportedPeriods: PeriodKey[]
}

export const CHANNEL_META: Record<ChannelId, ChannelMeta> = {
  coupang: {
    id: 'coupang',
    label: '쿠팡',
    color: '#FE2E00',
    textColor: '#ffffff',
    bgLight: '#fff5f3',
    supportedPeriods: ['realtime', 'daily', 'weekly', 'monthly'],
  },
  smartstore: {
    id: 'smartstore',
    label: '스마트스토어',
    color: '#03C75A',
    textColor: '#ffffff',
    bgLight: '#f0fdf4',
    supportedPeriods: ['realtime', 'daily', 'weekly', 'monthly'],
  },
  musinsa: {
    id: 'musinsa',
    label: '무신사키즈',
    color: '#1A1A1A',
    textColor: '#ffffff',
    bgLight: '#f8f8f8',
    supportedPeriods: ['realtime', 'daily', 'weekly', 'monthly'],
  },
  boribori: {
    id: 'boribori',
    label: '보리보리',
    color: '#FF6B9D',
    textColor: '#ffffff',
    bgLight: '#fff0f6',
    supportedPeriods: ['realtime', 'daily', 'weekly', 'monthly'],
  },
  lotteon: {
    id: 'lotteon',
    label: '롯데온',
    color: '#E60012',
    textColor: '#ffffff',
    bgLight: '#fff5f5',
    supportedPeriods: ['realtime', 'weekly', 'monthly'],
  },
  kakao: {
    id: 'kakao',
    label: '카카오선물하기',
    color: '#FEE500',
    textColor: '#1A1A1A',
    bgLight: '#fffde7',
    supportedPeriods: ['realtime'],
  },
}

export const PERIOD_LABEL: Record<PeriodKey, string> = {
  realtime: '실시간',
  daily: '1일',
  weekly: '1주',
  monthly: '1개월',
}

// ─── 키워드 랭킹 ──────────────────────────────────────────────────

export type KeywordCategory =
  | '아우터'
  | '원피스'
  | '세트'
  | '장화'
  | '구두'
  | '실내화'
  | '기타'

export const KEYWORD_CATEGORIES: KeywordCategory[] = [
  '아우터', '원피스', '세트', '장화', '구두', '실내화', '기타',
]

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
  date: string
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
