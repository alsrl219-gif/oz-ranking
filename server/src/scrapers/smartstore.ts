/**
 * 스마트스토어(네이버쇼핑) 스크래퍼 — 키워드 검색 기반
 *
 * 네이버 쇼핑 Best API는 스토어명이 브랜드명과 달라서
 * OZ 키즈 탐지 신뢰도가 낮음.
 * 등록된 키워드로 네이버쇼핑 검색 → OZ 키즈 상품 순위 수집.
 */

import { log } from './base'
import { computeDeltas } from '../data-store'
import { loadKeywords } from '../keywords-store'
import { searchKeywordInChannel } from './keyword-search'
import type { RankingSnapshot, PeriodKey, OzKidsEntry } from '../types'

const CHANNEL = 'smartstore' as const

export async function scrapeSmartstore(periods: PeriodKey[]): Promise<RankingSnapshot[]> {
  const keywords = loadKeywords().filter(kw => kw.channels.includes(CHANNEL))

  if (keywords.length === 0) {
    log(CHANNEL, '등록된 키워드 없음 — 키워드 랭킹 페이지에서 키워드를 추가하세요')
    return periods.map(period => ({
      channelId: CHANNEL, period,
      scrapedAt: new Date().toISOString(),
      products: [], ozKidsEntries: [],
      error: '키워드 미등록. 키워드 랭킹 → 스마트스토어 채널 포함 키워드 추가 필요',
    }))
  }

  log(CHANNEL, `키워드 ${keywords.length}개로 검색 시작`)

  const bestByName = new Map<string, OzKidsEntry>()

  for (const kw of keywords) {
    try {
      const entry = await searchKeywordInChannel(kw.id, kw.keyword, kw.category, CHANNEL)
      if (entry.rank !== null && entry.productName) {
        const prev = bestByName.get(entry.productName)
        if (!prev || entry.rank < prev.rank) {
          bestByName.set(entry.productName, {
            rank: entry.rank,
            productName: entry.productName,
            price: entry.price ?? 0,
            imageUrl: entry.productImage ?? undefined,
            productUrl: undefined,
            previousRank: entry.previousRank,
            rankDelta: entry.rankDelta,
            isNew: entry.previousRank === null,
          })
        }
      }
      log(CHANNEL, `"${kw.keyword}": ${entry.rank !== null ? `${entry.rank}위 (${entry.productName})` : '미발견'}`)
    } catch (e) {
      log(CHANNEL, `"${kw.keyword}" 검색 오류: ${e}`)
    }
  }

  const ozRaw = [...bestByName.values()]
  log(CHANNEL, `수집 완료 — 오즈키즈 ${ozRaw.length}개 상품`)

  return periods.map(period => ({
    channelId: CHANNEL, period,
    scrapedAt: new Date().toISOString(),
    products: [],
    ozKidsEntries: computeDeltas(ozRaw, CHANNEL, period),
  }))
}
