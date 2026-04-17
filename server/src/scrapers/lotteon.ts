import { getBrowser, MODERN_UA, log, makeErrorPath, withRetry } from './base'
import { isOzKids } from '../types'
import { computeDeltas } from '../data-store'
import type { RankingSnapshot, PeriodKey } from '../types'

const CHANNEL = 'lotteon'

// 롯데온 아동/유아 패션 카테고리
const BASE_URL =
  'https://www.lotteon.com/p/display/shop/seltDpShop/17?mall_id=1&cate_no=LO01000&dpShopTypeNo=1&dpShopNo=17'

export async function scrapeLotteon(periods: PeriodKey[]): Promise<RankingSnapshot[]> {
  return withRetry(async () => {
    const browser = await getBrowser()
    const context = await browser.newContext({ userAgent: MODERN_UA })
    const page = await context.newPage()
    const results: RankingSnapshot[] = []

    // 롯데온은 realtime, daily만 지원
    const supportedPeriods = periods.filter((p) => p === 'realtime' || p === 'daily')

    try {
      await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 })
      await page.waitForTimeout(3000)

      // 인기순 정렬 클릭
      try {
        const sortBtn = page.locator('button:has-text("인기순"), a:has-text("인기순"), [data-sort="popular"]').first()
        if (await sortBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await sortBtn.click()
          await page.waitForTimeout(2000)
        }
      } catch {
        // 정렬 버튼 없어도 진행
      }

      for (const period of supportedPeriods) {
        log(CHANNEL, `${period} 랭킹 수집 시작`)

        const products = await page.evaluate((ozCheck: (t: string) => boolean) => {
          const cards = document.querySelectorAll(
            '.prd_info, [class*="product-item"], [class*="ProductItem"], .item_info, li[class*="product"]'
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
              card.querySelector('.prd_name, [class*="name"], [class*="Name"]')
            const brandEl =
              card.querySelector('.brand, [class*="brand"]')
            const priceEl =
              card.querySelector('.price, [class*="price"], em[class*="price"]')
            const imgEl = card.querySelector('img') as HTMLImageElement | null
            const linkEl = card.querySelector('a') as HTMLAnchorElement | null

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

      // 지원하지 않는 기간은 빈 스냅샷으로
      for (const period of periods.filter((p) => !(supportedPeriods as PeriodKey[]).includes(p))) {
        results.push({
          channelId: CHANNEL,
          period,
          scrapedAt: new Date().toISOString(),
          products: [],
          ozKidsEntries: [],
          error: '이 채널은 해당 기간을 지원하지 않습니다',
        })
      }
    } catch (err) {
      log(CHANNEL, `오류: ${err}`)
      await page.screenshot({ path: makeErrorPath(CHANNEL) }).catch(() => {})
      results.push({
        channelId: CHANNEL,
        period: supportedPeriods[results.length] ?? 'realtime',
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
