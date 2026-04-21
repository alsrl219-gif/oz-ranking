/**
 * 쿠팡 스크래퍼 — 키워드 검색 기반
 *
 * 카테고리 베스트 페이지는 봇 차단이 심해 실용적이지 않음.
 * 등록된 키워드로 쿠팡 검색 → OZ 키즈 상품 순위 수집.
 */

import { log } from './base'
import { computeDeltas } from '../data-store'
import { loadKeywords } from '../keywords-store'
import { searchKeywordInChannel } from './keyword-search'
import type { RankingSnapshot, PeriodKey, OzKidsEntry } from '../types'

const CHANNEL = 'coupang' as const

export async function scrapeCoupang(periods: PeriodKey[]): Promise<RankingSnapshot[]> {
  const keywords = loadKeywords().filter(kw => kw.channels.includes(CHANNEL))

  if (keywords.length === 0) {
    log(CHANNEL, '등록된 키워드 없음 — 키워드 랭킹 페이지에서 키워드를 추가하세요')
    return periods.map(period => ({
      channelId: CHANNEL, period,
      scrapedAt: new Date().toISOString(),
      products: [], ozKidsEntries: [],
      error: '키워드 미등록. 키워드 랭킹 → 쿠팡 채널 포함 키워드 추가 필요',
    }))
  }

  log(CHANNEL, `키워드 ${keywords.length}개로 검색 시작`)

  // 키워드별로 검색 → OZ 키즈 상품 수집 (상품명 기준 최고 순위 유지)
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

  // 키워드 검색은 현재 시점 기준 → realtime 스냅샷만 저장
  // 다른 기간은 같은 데이터를 복사 (의미 동일)
  return periods.map(period => ({
    channelId: CHANNEL, period,
    scrapedAt: new Date().toISOString(),
    products: [],
    ozKidsEntries: computeDeltas(ozRaw, CHANNEL, period),
  }))
}
