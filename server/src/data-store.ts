import fs from 'fs'
import path from 'path'
import { config } from './config'
import type {
  RankingData,
  RankingSnapshot,
  HistoryEntry,
  OzKidsEntry,
  ChannelId,
  PeriodKey,
  RankingSummary,
} from './types'

const LATEST_FILE = path.join(config.dataDir, 'latest.json')

function ensureDirs() {
  ;[config.dataDir, config.historyDir, config.errorsDir].forEach((d) => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true })
  })
}

// ─── 저장 ─────────────────────────────────────────────────────────
export function saveLatest(data: RankingData): void {
  ensureDirs()
  fs.writeFileSync(LATEST_FILE, JSON.stringify(data, null, 2), 'utf8')
}

// ─── 불러오기 ──────────────────────────────────────────────────────
export function loadLatest(): RankingData | null {
  try {
    if (!fs.existsSync(LATEST_FILE)) return null
    return JSON.parse(fs.readFileSync(LATEST_FILE, 'utf8')) as RankingData
  } catch {
    return null
  }
}

// ─── 데이터 나이 ───────────────────────────────────────────────────
export function getDataAge(): { ageMinutes: number; scrapedAt: string } | null {
  const data = loadLatest()
  if (!data) return null
  const ageMs = Date.now() - new Date(data.scrapedAt).getTime()
  return { ageMinutes: Math.floor(ageMs / 60000), scrapedAt: data.scrapedAt }
}

// ─── 히스토리 추가 ─────────────────────────────────────────────────
export function appendHistory(entry: HistoryEntry): void {
  ensureDirs()
  const file = path.join(config.historyDir, `${entry.channelId}.jsonl`)
  fs.appendFileSync(file, JSON.stringify(entry) + '\n', 'utf8')
}

// ─── 히스토리 불러오기 ─────────────────────────────────────────────
export function loadHistory(
  channelId: ChannelId,
  limit = 60,
  period?: PeriodKey
): HistoryEntry[] {
  const file = path.join(config.historyDir, `${channelId}.jsonl`)
  if (!fs.existsSync(file)) return []
  const lines = fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean)
  const entries: HistoryEntry[] = lines
    .map((l) => {
      try { return JSON.parse(l) as HistoryEntry } catch { return null }
    })
    .filter((e): e is HistoryEntry => e !== null)
    .filter((e) => !period || e.period === period)

  return entries.slice(-limit)
}

// ─── 순위 델타 계산 ────────────────────────────────────────────────
export function computeDeltas(
  newEntries: Array<{ rank: number; productName: string; price: number; imageUrl?: string; productUrl?: string }>,
  channelId: ChannelId,
  period: PeriodKey
): OzKidsEntry[] {
  const history = loadHistory(channelId, 1, period)
  const prevEntries = history.length > 0 ? history[history.length - 1].ozKidsEntries : []

  return newEntries.map((e) => {
    const prev = prevEntries.find((p) => p.productName === e.productName)
    return {
      rank: e.rank,
      productName: e.productName,
      price: e.price,
      imageUrl: e.imageUrl,
      productUrl: e.productUrl,
      previousRank: prev?.rank ?? null,
      rankDelta: prev ? prev.rank - e.rank : null,
      isNew: !prev,
    }
  })
}

// ─── 요약 계산 ─────────────────────────────────────────────────────
export function computeSummary(snapshots: RankingSnapshot[]): RankingSummary {
  const ozSnapshots = snapshots.filter((s) => s.ozKidsEntries.length > 0)
  const totalAppearances = snapshots.reduce((sum, s) => sum + s.ozKidsEntries.length, 0)
  const channelIds = [...new Set(ozSnapshots.map((s) => s.channelId))]

  let bestRank: number | null = null
  let bestChannel: ChannelId | null = null
  for (const s of snapshots) {
    for (const e of s.ozKidsEntries) {
      if (bestRank === null || e.rank < bestRank) {
        bestRank = e.rank
        bestChannel = s.channelId
      }
    }
  }

  return {
    totalOzKidsAppearances: totalAppearances,
    channelsWithOzKids: channelIds.length,
    bestRankOverall: bestRank,
    bestRankChannel: bestChannel,
    lastUpdatedAt: new Date().toISOString(),
  }
}
