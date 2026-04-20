import { log } from './base'
import { computeDeltas } from '../data-store'
import type { RankingSnapshot, PeriodKey } from '../types'

const CHANNEL = 'smartstore'

// 스마트스토어 Best 100: 아동/유아의류 카테고리 (catId=50000167)
// periodType 파라미터 매핑
const PERIOD_MAP: Partial<Record<PeriodKey, string>> = {
  daily:  'DAILY',
  weekly: 'WEEKLY',
}

const BASE_API =
  'https://snxbest.naver.com/api/v1/snxbest/product/rank' +
  '?ageType=ALL&categoryId=50000167&sortType=PRODUCT_BUY&showAd=false'

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Referer': 'https://snxbest.naver.com/',
  'Origin': 'https://snxbest.naver.com',
}

export async function scrapeSmartstore(periods: PeriodKey[]): Promise<RankingSnapshot[]> {
  const results: RankingSnapshot[] = []

  for (const period of periods) {
    const periodType = PERIOD_MAP[period]
    if (!periodType) {
      results.push({
        channelId: CHANNEL, period,
        scrapedAt: new Date().toISOString(),
        products: [], ozKidsEntries: [],
        error: '이 채널은 해당 기간을 지원하지 않습니다',
      })
      continue
    }

    log(CHANNEL, `${period} (periodType=${periodType}) 수집 시작`)

    try {
      const url = `${BASE_API}&periodType=${periodType}`
      const res = await fetch(url, { headers: HEADERS })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const json = await res.json() as any
      const items: any[] = json?.products ?? []

      log(CHANNEL, `${period}: 원시 ${items.length}개`)

      const products = items
        .filter(item => !item.isAd)          // 광고 제외
        .map((item, idx) => mapProduct(item, idx))
        .filter(p => p.productName.length > 1)
        .slice(0, 100)

      const ozRaw = products.filter(p => p.isOzKids)
      log(CHANNEL, `${period}: ${products.length}개, 오즈키즈 ${ozRaw.length}개`)

      results.push({
        channelId: CHANNEL, period,
        scrapedAt: new Date().toISOString(),
        products,
        ozKidsEntries: computeDeltas(ozRaw, CHANNEL, period),
      })
    } catch (e) {
      log(CHANNEL, `${period} 오류: ${e}`)
      results.push({
        channelId: CHANNEL, period,
        scrapedAt: new Date().toISOString(),
        products: [], ozKidsEntries: [],
        error: String(e),
      })
    }
  }

  return results
}

function mapProduct(item: any, idx: number) {
  const name  = String(item.title ?? item.productName ?? item.name ?? '')
  // mallNm = 스토어명 (브랜드명과 다를 수 있으나 최선의 근사값)
  const brand = String(item.mallNm ?? item.brandNm ?? item.brand ?? '')
  const price = Number(item.priceValue ?? item.discountPriceValue ?? item.price ?? 0)
  const imageUrl  = String(item.imageUrl ?? item.imgUrl ?? '')
  const productUrl = String(item.linkUrl ?? item.productUrl ?? item.url ?? '')
  const rank = Number(item.rank ?? idx + 1)

  return {
    rank,
    productName: name.trim(),
    brandName:   brand.trim(),
    price,
    imageUrl,
    productUrl,
    isOzKids: /오즈키즈|OZKIZ|ozkiz/i.test((brand + ' ' + name).replace(/\s/g, '')),
  }
}
