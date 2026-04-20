import { getBrowser, MODERN_UA, log, makeErrorPath, withRetry } from './base'
import { computeDeltas } from '../data-store'
import type { RankingSnapshot, PeriodKey } from '../types'

const CHANNEL = 'coupang'

// 쿠팡 아동의류 카테고리 랭킹 페이지
// 카테고리: 유아동패션 > 아동의류
const BASE_URL = 'https://www.coupang.com/np/categories/487148'


export async function scrapeCoupang(periods: PeriodKey[]): Promise<RankingSnapshot[]> {
  return withRetry(async () => {
    const browser = await getBrowser()
    const context = await browser.newContext({ userAgent: MODERN_UA })
    const page = await context.newPage()
    const results: RankingSnapshot[] = []

    try {
      // 쿠팡은 기간별 탭을 클릭하는 방식
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await page.waitForTimeout(3000)

      for (const period of periods) {
        log(CHANNEL, `${period} 랭킹 수집 시작`)

        try {
          // 기간 탭 클릭 시도
          const tabMap: Record<PeriodKey, string> = {
            realtime: '실시간',
            daily: '일간',
            weekly: '주간',
            monthly: '월간',
          }
          const tabText = tabMap[period]
          const tabBtn = page.locator(`button:has-text("${tabText}"), a:has-text("${tabText}")`).first()
          if (await tabBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await tabBtn.click()
            await page.waitForTimeout(2000)
          }
        } catch {
          // 탭 없어도 진행
        }

        const products = await page.evaluate(() => {
          const cards = document.querySelectorAll(
            'li.baby-product, [class*="ProductCard"], [class*="product-list"] li, .search-product'
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
            const nameEl =
              card.querySelector('.name') ||
              card.querySelector('[class*="product-name"]') ||
              card.querySelector('[class*="ProductName"]') ||
              card.querySelector('dt.name')
            const priceEl =
              card.querySelector('.price-value') ||
              card.querySelector('[class*="price"]') ||
              card.querySelector('em.price-value')
            const imgEl = card.querySelector('img') as HTMLImageElement | null
            const linkEl = card.querySelector('a') as HTMLAnchorElement | null
            const brandEl = card.querySelector('[class*="brand"]') || card.querySelector('.brand')

            const name = nameEl?.textContent?.trim() ?? ''
            const brand = brandEl?.textContent?.trim() ?? ''
            const priceText = priceEl?.textContent?.trim().replace(/[^0-9]/g, '') ?? '0'
            if (!name) return

            items.push({
              rank: idx + 1,
              productName: name,
              brandName: brand,
              price: parseInt(priceText, 10) || 0,
              imageUrl: imgEl?.src ?? '',
              productUrl: linkEl?.href ?? '',
              isOzKids: /오즈키즈|OZKIZ|ozkiz/i.test((brand + ' ' + name).replace(/\s/g, '')),
            })
          })
          return items.slice(0, 100)
        })

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
