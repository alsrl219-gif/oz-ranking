import { getBrowser, MODERN_UA, log, makeErrorPath, withRetry } from './base'
import { isOzKids } from '../types'
import { computeDeltas } from '../data-store'
import type { RankingSnapshot, PeriodKey } from '../types'

const CHANNEL = 'smartstore'

// 네이버쇼핑 아동/유아의류 Best100
const BASE_URL = 'https://shopping.naver.com/best100v2/main.nhn?catId=50000167'

export async function scrapeSmartstore(periods: PeriodKey[]): Promise<RankingSnapshot[]> {
  return withRetry(async () => {
    const browser = await getBrowser()
    const context = await browser.newContext({ userAgent: MODERN_UA })
    const page = await context.newPage()
    const results: RankingSnapshot[] = []

    try {
      await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 })
      await page.waitForTimeout(2000)

      for (const period of periods) {
        log(CHANNEL, `${period} 랭킹 수집 시작`)

        try {
          const tabMap: Record<PeriodKey, string> = {
            realtime: '실시간',
            daily: '일별',
            weekly: '주간',
            monthly: '월간',
          }
          const tabText = tabMap[period]
          const tabBtn = page.locator(`button:has-text("${tabText}"), a:has-text("${tabText}"), li:has-text("${tabText}")`).first()
          if (await tabBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await tabBtn.click()
            await page.waitForTimeout(2000)
          }
        } catch {
          // 탭 없어도 진행
        }

        const products = await page.evaluate((ozCheck: (t: string) => boolean) => {
          const cards = document.querySelectorAll(
            '.best_list li, [class*="BestItem"], [class*="best-item"], .product_list li'
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
            const rankEl = card.querySelector('em.num, .num, [class*="rank"]')
            const nameEl =
              card.querySelector('a.tit, .tit, [class*="name"], [class*="Name"]')
            const brandEl =
              card.querySelector('.brand, [class*="brand"], .maker, [class*="maker"]')
            const priceEl =
              card.querySelector('.price strong, .price, [class*="price"]')
            const imgEl = card.querySelector('img') as HTMLImageElement | null
            const linkEl = card.querySelector('a') as HTMLAnchorElement | null

            const rankNum = rankEl
              ? parseInt(rankEl.textContent?.trim().replace(/\D/g, '') || '0', 10)
              : idx + 1
            const name = nameEl?.textContent?.trim() ?? ''
            const brand = brandEl?.textContent?.trim() ?? ''
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
          return items.slice(0, 100)
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
