import { getBrowser, MODERN_UA, log, makeErrorPath, withRetry } from './base'
import { isOzKids } from '../types'
import { computeDeltas } from '../data-store'
import type { RankingSnapshot, PeriodKey } from '../types'

const CHANNEL = 'musinsa'

const PERIOD_PARAM: Record<PeriodKey, string> = {
  realtime: 'REALTIME',
  daily: 'DAILY',
  weekly: 'WEEKLY',
  monthly: 'MONTHLY',
}

const BASE_URL =
  'https://www.musinsa.com/main/kids/ranking?gf=A&storeCode=kids&sectionId=234&contentsId=&categoryCode=106000&ageBand=AGE_BAND_ALL'

export async function scrapeMusinsa(periods: PeriodKey[]): Promise<RankingSnapshot[]> {
  return withRetry(async () => {
    const browser = await getBrowser()
    const context = await browser.newContext({ userAgent: MODERN_UA })
    const page = await context.newPage()
    const results: RankingSnapshot[] = []

    try {
      for (const period of periods) {
        log(CHANNEL, `${period} 랭킹 수집 시작`)
        const url = `${BASE_URL}&rankingType=${PERIOD_PARAM[period]}`
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
        await page.waitForTimeout(2000)

        const products = await page.evaluate((ozCheck: (t: string) => boolean) => {
          // 무신사 랭킹 카드 선택자 (실제 DOM 구조에 맞게 조정)
          const cards = document.querySelectorAll(
            '[class*="RankingCard"], [class*="ranking-card"], .ranking-product, [data-item-type="ranking"]'
          )
          const items: Array<{
            rank: number
            productName: string
            brandName: string
            price: number
            imageUrl: string
            productUrl: string
            isOzKids: boolean
          }> = []

          cards.forEach((card, idx) => {
            const rankEl =
              card.querySelector('[class*="rank"]') ||
              card.querySelector('.num') ||
              card.querySelector('[class*="Rank"]')
            const brandEl =
              card.querySelector('[class*="brand"]') ||
              card.querySelector('[class*="Brand"]') ||
              card.querySelector('.brand')
            const nameEl =
              card.querySelector('[class*="name"]') ||
              card.querySelector('[class*="Name"]') ||
              card.querySelector('.name')
            const priceEl =
              card.querySelector('[class*="price"]') ||
              card.querySelector('[class*="Price"]') ||
              card.querySelector('.price')
            const imgEl = card.querySelector('img') as HTMLImageElement | null
            const linkEl = card.querySelector('a') as HTMLAnchorElement | null

            const rankNum = rankEl
              ? parseInt(rankEl.textContent?.trim().replace(/\D/g, '') || '0', 10)
              : idx + 1
            const brand = brandEl?.textContent?.trim() ?? ''
            const name = nameEl?.textContent?.trim() ?? ''
            const priceText = priceEl?.textContent?.trim().replace(/[^0-9]/g, '') ?? '0'

            if (!name) return

            items.push({
              rank: rankNum || idx + 1,
              productName: name,
              brandName: brand,
              price: parseInt(priceText, 10) || 0,
              imageUrl: imgEl?.src ?? '',
              productUrl: linkEl?.href ?? '',
              isOzKids: ozCheck(brand) || ozCheck(name),
            })
          })
          return items
        }, isOzKids)

        log(CHANNEL, `${period}: ${products.length}개 상품, 오즈키즈 ${products.filter((p) => p.isOzKids).length}개`)

        const ozRaw = products.filter((p) => p.isOzKids)
        const ozKidsEntries = computeDeltas(ozRaw, CHANNEL, period)

        results.push({
          channelId: CHANNEL,
          period,
          scrapedAt: new Date().toISOString(),
          products,
          ozKidsEntries,
        })
      }
    } catch (err) {
      log(CHANNEL, `오류: ${err}`)
      await page.screenshot({ path: makeErrorPath(CHANNEL) }).catch(() => {})
      results.push({
        channelId: CHANNEL,
        period: periods[results.length] ?? 'realtime',
        scrapedAt: new Date().toISOString(),
        products: [],
        ozKidsEntries: [],
        error: String(err),
      })
    } finally {
      await context.close()
    }
    return results
  }, 2, CHANNEL)
}
