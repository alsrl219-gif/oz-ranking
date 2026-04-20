import { log } from './base'
import { computeDeltas } from '../data-store'
import type { RankingSnapshot, PeriodKey } from '../types'

const CHANNEL = 'musinsa'

const PERIOD_PARAM: Record<PeriodKey, string> = {
  realtime: 'REALTIME',
  daily:    'DAILY',
  weekly:   'WEEKLY',
  monthly:  'MONTHLY',
}

const BASE_API =
  'https://api.musinsa.com/api2/hm/web/v5/pans/ranking' +
  '?storeCode=kids&sectionId=234&gf=A&categoryCode=106000&ageBand=AGE_BAND_ALL'

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Referer': 'https://www.musinsa.com/',
  'Origin': 'https://www.musinsa.com',
}

export async function scrapeMusinsa(periods: PeriodKey[]): Promise<RankingSnapshot[]> {
  const results: RankingSnapshot[] = []

  for (const period of periods) {
    log(CHANNEL, `${period} 랭킹 수집 시작`)
    try {
      const url = `${BASE_API}&rankingType=${PERIOD_PARAM[period]}`
      const res = await fetch(url, { headers: HEADERS })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      const json = await res.json() as any

      // modules 배열에서 MULTICOLUMN 타입 전부 수집 (각 6개씩 → 전체 100개)
      const modules: any[] = Array.isArray(json?.data?.modules)
        ? json.data.modules
        : Array.isArray(json?.modules) ? json.modules : []

      const allItems: any[] = modules
        .filter((m: any) => m?.type === 'MULTICOLUMN' || m?.moduleType === 'MULTICOLUMN')
        .flatMap((m: any) => m?.items ?? m?.data?.items ?? [])

      const products = allItems.map((item: any, idx: number) => {
        const rank  = item?.image?.rank ?? item?.rank ?? idx + 1
        const brand = item?.info?.brandName ?? item?.brandName ?? ''
        const name  = item?.info?.productName ?? item?.goodsName ?? item?.name ?? ''
        const price = item?.info?.finalPrice ?? item?.price ?? 0
        const imgUrl= item?.image?.url ?? item?.imageUrl ?? ''
        const linkUrl = item?.onClick?.url ?? item?.link ?? item?.goodsLinkUrl ?? ''

        return {
          rank: typeof rank === 'number' ? rank : idx + 1,
          productName: String(name),
          brandName: String(brand),
          price: typeof price === 'number' ? price : parseInt(String(price).replace(/\D/g, '') || '0', 10),
          imageUrl: imgUrl ? String(imgUrl) : '',
          productUrl: linkUrl ? String(linkUrl) : '',
          isOzKids: /오즈키즈|OZKIZ|ozkiz/i.test((String(brand) + ' ' + String(name)).replace(/\s/g, '')),
        }
      }).filter(p => p.productName)

      log(CHANNEL, `${period}: ${products.length}개 상품, 오즈키즈 ${products.filter(p => p.isOzKids).length}개`)

      const ozRaw = products.filter(p => p.isOzKids)
      const ozKidsEntries = computeDeltas(ozRaw, CHANNEL, period)

      results.push({
        channelId: CHANNEL,
        period,
        scrapedAt: new Date().toISOString(),
        products,
        ozKidsEntries,
      })
    } catch (err) {
      log(CHANNEL, `${period} 오류: ${err}`)
      results.push({
        channelId: CHANNEL,
        period,
        scrapedAt: new Date().toISOString(),
        products: [],
        ozKidsEntries: [],
        error: String(err),
      })
    }
  }

  return results
}
