import fs from 'fs'
import path from 'path'
import { config } from './config'
import type { Keyword, KeywordRankEntry, ChannelId, KeywordCategory } from './types'

const KEYWORDS_FILE = path.join(config.dataDir, 'keywords.json')
const KEYWORD_HISTORY_DIR = path.join(config.dataDir, 'keyword-history')

function ensureDirs() {
  ;[config.dataDir, KEYWORD_HISTORY_DIR].forEach((d) => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true })
  })
}

// ─── 키워드 CRUD ──────────────────────────────────────────────────

export function loadKeywords(): Keyword[] {
  try {
    ensureDirs()
    if (!fs.existsSync(KEYWORDS_FILE)) return []
    return JSON.parse(fs.readFileSync(KEYWORDS_FILE, 'utf8')) as Keyword[]
  } catch {
    return []
  }
}

export function saveKeywords(keywords: Keyword[]): void {
  ensureDirs()
  fs.writeFileSync(KEYWORDS_FILE, JSON.stringify(keywords, null, 2), 'utf8')
}

export function addKeyword(data: {
  keyword: string
  category: KeywordCategory
  channels: ChannelId[]
}): Keyword {
  const keywords = loadKeywords()
  const newKeyword: Keyword = {
    id: `kw_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    keyword: data.keyword.trim(),
    category: data.category,
    channels: data.channels,
    createdAt: new Date().toISOString(),
  }
  keywords.push(newKeyword)
  saveKeywords(keywords)
  return newKeyword
}

export function updateKeyword(
  id: string,
  data: Partial<Pick<Keyword, 'keyword' | 'category' | 'channels'>>
): Keyword | null {
  const keywords = loadKeywords()
  const idx = keywords.findIndex((k) => k.id === id)
  if (idx === -1) return null
  keywords[idx] = { ...keywords[idx], ...data }
  saveKeywords(keywords)
  return keywords[idx]
}

export function deleteKeyword(id: string): boolean {
  const keywords = loadKeywords()
  const filtered = keywords.filter((k) => k.id !== id)
  if (filtered.length === keywords.length) return false
  saveKeywords(filtered)
  return true
}

// ─── 키워드 랭킹 히스토리 ─────────────────────────────────────────

export function appendKeywordRank(entry: KeywordRankEntry): void {
  ensureDirs()
  const file = path.join(KEYWORD_HISTORY_DIR, `${entry.keywordId}.jsonl`)
  fs.appendFileSync(file, JSON.stringify(entry) + '\n', 'utf8')
}

export function loadKeywordHistory(keywordId: string, days = 7): KeywordRankEntry[] {
  const file = path.join(KEYWORD_HISTORY_DIR, `${keywordId}.jsonl`)
  if (!fs.existsSync(file)) return []

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)

  const lines = fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean)
  return lines
    .map((l) => {
      try { return JSON.parse(l) as KeywordRankEntry } catch { return null }
    })
    .filter((e): e is KeywordRankEntry => e !== null)
    .filter((e) => new Date(e.scrapedAt) >= cutoff)
}

// ─── 최신 키워드 랭킹 ─────────────────────────────────────────────

export function loadLatestKeywordRanks(): KeywordRankEntry[] {
  const keywords = loadKeywords()
  const results: KeywordRankEntry[] = []

  for (const kw of keywords) {
    const file = path.join(KEYWORD_HISTORY_DIR, `${kw.id}.jsonl`)
    if (!fs.existsSync(file)) continue

    const lines = fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean)
    const entries: KeywordRankEntry[] = lines
      .map((l) => {
        try { return JSON.parse(l) as KeywordRankEntry } catch { return null }
      })
      .filter((e): e is KeywordRankEntry => e !== null)

    // 채널별로 최신 항목 1개씩 추출
    const byChannel: Record<string, KeywordRankEntry> = {}
    for (const e of entries) {
      const key = `${e.keywordId}_${e.channelId}`
      if (!byChannel[key] || e.scrapedAt > byChannel[key].scrapedAt) {
        byChannel[key] = e
      }
    }
    results.push(...Object.values(byChannel))
  }

  return results
}
