import { log } from './base'
import { computeDeltas } from '../data-store'
import type { RankingSnapshot, PeriodKey } from '../types'

const CHANNEL = 'lotteon'

// period 파라미터 매핑
const PERIOD_MAP: Partial<Record<PeriodKey, string>> = {
  realtime: 'hourly',
  weekly:   'weekly',
  monthly:  'monthly',
}

// 롯데온 유아동 카테고리 베스트 API
// dshopNo=59221 = 유아동 탭 (베스트 > 유아동)
// (모든 탭이 동일한 베스트 모듈을 공유하나, 유아동 탭 ID 사용)
const BASE_API =
  'https://pbf.lotteon.com/display/v2/async/best/bestProductTwo/products' +
  '?sort=ranking&size=100&collectionId=SELECT' +
  '&dshopNo=59221&mallNo=1&tmplNo=365&tmplSeq=16416' +
  '&dcornId=best_product_two&dcornNo=M001638&dcornLnkSeq=1113288' +
  '&dpInfwCd=CAT59221&areaId=cateBest&dcatNo=A'

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Referer': 'https://www.lotteon.com/',
  'Origin': 'https://www.lotteon.com',
}

export async function scrapeLotteon(periods: PeriodKey[]): Promise<RankingSnapshot[]> {
  const results: RankingSnapshot[] = []

  for (const period of periods) {
    const lotteoPeriod = PERIOD_MAP[period]
    if (!lotteoPeriod) {
      results.push({
        channelId: CHANNEL, period,
        scrapedAt: new Date().toISOString(),
        products: [], ozKidsEntries: [],
        error: '이 채널은 해당 기간을 지원하지 않습니다',
      })
      continue
    }

    log(CHANNEL, `${period} (period=${lotteoPeriod}) 수집 시작`)

    try {
      const url = `${BASE_API}&period=${lotteoPeriod}`
      const res = await fetch(url, { headers: HEADERS })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const json = await res.json() as any
      const items: any[] = json?.data?.productList ?? []

      log(CHANNEL, `${period}: 원시 ${items.length}개`)

      const products = items.map((item, idx) => mapProduct(item, idx))
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
  const name     = String(item.spdNm ?? item.goodsName ?? item.name ?? '')
  const brand    = String(item.brdNm ?? item.brandName ?? item.brand ?? '')
  const price    = Number(item.slPrc ?? item.salePrice ?? item.price ?? 0)
  const imageUrl = String(item.imgFullUrl ?? item.imageUrl ?? item.imgUrl ?? '')
  const spdNo    = item.spdNo ?? item.productNo ?? ''
  const productUrl = spdNo
    ? `https://www.lotteon.com/p/product/seltPdDtl/${spdNo}`
    : String(item.productUrl ?? item.url ?? '')
  const rank = Number(item.prirRnkg ?? item.rank ?? idx + 1)

  return {
    rank,
    productName: name.trim(),
    brandName: brand.trim(),
    price,
    imageUrl,
    productUrl,
    isOzKids: /오즈키즈|OZKIZ|ozkiz/i.test((brand + ' ' + name).replace(/\s/g, '')),
  }
}
