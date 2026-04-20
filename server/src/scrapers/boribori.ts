import { log } from './base'
import { computeDeltas } from '../data-store'
import type { RankingSnapshot, PeriodKey } from '../types'

const CHANNEL = 'boribori'

// 보리보리: 1일(24h) / 7일(168h)
const INTERVAL_MAP: Partial<Record<PeriodKey, number>> = {
  realtime: 24,
  daily:    24,
  weekly:   168,
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Referer': 'https://m.boribori.co.kr/',
  'Origin': 'https://m.boribori.co.kr',
}

// 패션 > 전체 / 키즈 / 신발
const CATEGORIES = [
  { label: '전체',  suffix: '' },
  { label: '키즈',  suffix: '&ageGroupCode=KD' },
  { label: '신발',  suffix: '&ctgrCode=SH' },
]

const BASE_API =
  'https://apix.boribori.co.kr/searches/best/' +
  '?dealYn=N&siteCd=2&limit=0,200&countryCd=001&langCd=001&deviceCd=001&mandM=b_boribori'

export async function scrapeBoribori(periods: PeriodKey[]): Promise<RankingSnapshot[]> {
  const results: RankingSnapshot[] = []

  for (const period of periods) {
    const interval = INTERVAL_MAP[period]
    if (!interval) {
      results.push({
        channelId: CHANNEL, period,
        scrapedAt: new Date().toISOString(),
        products: [], ozKidsEntries: [],
        error: '이 채널은 해당 기간을 지원하지 않습니다',
      })
      continue
    }

    log(CHANNEL, `${period} (interval=${interval}h) 수집 시작`)

    const seen = new Set<string>()
    const allProducts: ReturnType<typeof mapProduct>[] = []

    for (const cat of CATEGORIES) {
      try {
        const url = `${BASE_API}&interval=${interval}${cat.suffix}`
        const res = await fetch(url, { headers: HEADERS })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)

        const json = await res.json() as any
        const items: any[] = Array.isArray(json?.data) ? json.data
          : Array.isArray(json) ? json : []

        log(CHANNEL, `${period} [${cat.label}] ${items.length}개`)

        for (const [idx, item] of items.entries()) {
          const p = mapProduct(item, idx)
          if (p.productName && !seen.has(p.productName)) {
            seen.add(p.productName)
            allProducts.push(p)
          }
        }
      } catch (e) {
        log(CHANNEL, `${period} [${cat.label}] 오류: ${e}`)
      }
    }

    const products = allProducts.map((p, i) => ({ ...p, rank: i + 1 }))
    const ozRaw = products.filter(p => p.isOzKids)
    const ozKidsEntries = computeDeltas(ozRaw, CHANNEL, period)

    log(CHANNEL, `${period}: 총 ${products.length}개, 오즈키즈 ${ozRaw.length}개`)

    results.push({
      channelId: CHANNEL, period,
      scrapedAt: new Date().toISOString(),
      products, ozKidsEntries,
    })
  }

  return results
}

function mapProduct(item: any, idx: number) {
  const name  = String(item.prdNm ?? item.productName ?? item.goodsName ?? '')
  const brand = String(item.brandNm ?? item.brand ?? item.makerNm ?? '')
  const price = Number(item.selPrc ?? item.salePrice ?? item.price ?? 0)
  // 이미지 URL은 상대경로일 수 있으므로 보정
  const rawImg = String(item.prdImg ?? item.imgUrl ?? '')
  const imageUrl = rawImg.startsWith('http') ? rawImg
    : rawImg ? `https://cdn2.boribori.co.kr/${rawImg.replace(/^\//, '')}` : ''
  const productUrl = String(item.appPrdDtlUrl ?? item.productUrl ?? item.url ?? '')

  return {
    rank: idx + 1,
    productName: name.trim(),
    brandName: brand.trim(),
    price,
    imageUrl,
    productUrl,
    isOzKids: /오즈키즈|OZKIZ|ozkiz/i.test((brand + ' ' + name).replace(/\s/g, '')),
  }
}
