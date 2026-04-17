import { getBrowser, MODERN_UA, log, makeErrorPath, withRetry } from './base'
import { isOzKids } from '../types'
import { computeDeltas } from '../data-store'
import type { RankingSnapshot, PeriodKey } from '../types'

const CHANNEL = 'kakao'

// 카카오선물하기 베스트 - 키즈/아동 카테고리
const BASE_URL = 'https://gift.kakao.com/best'

export async function scrapeKakao(periods: PeriodKey[]): Promise<RankingSnapshot[]> {
  return withRetry(async () => {
    const browser = await getBrowser()
    const context = await browser.newContext({ userAgent: MODERN_UA })
    const page = await context.newPage()
    const results: RankingSnapshot[] = []

    // 카카오는 realtime, weekly만 지원
    const supportedPeriods = periods.filter((p) => p === 'realtime' || p === 'weekly')

    try {
      await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 })
      await page.waitForTimeout(3000)

      // 키즈/아동 카테고리 탭 클릭 시도
      try {
        const kidTab = page.locator('button:has-text("키즈"), a:has-text("키즈"), button:has-text("아동"), [data-category*="kid"]').first()
        if (await kidTab.isVisible({ timeout: 3000 }).catch(() => false)) {
          await kidTab.click()
          await page.waitForTimeout(2000)
        }
      } catch {
        // 탭 없어도 진행
      }

      for (const period of supportedPeriods) {
        log(CHANNEL, `${period} 랭킹 수집 시작`)

        try {
          const tabMap: Record<PeriodKey, string> = {
            realtime: '실시간',
            daily: '일간',
            weekly: '주간',
            monthly: '월간',
          }
          const tabBtn = page.locator(`button:has-text("${tabMap[period]}"), a:has-text("${tabMap[period]}")`).first()
          if (await tabBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await tabBtn.click()
            await page.waitForTimeout(2000)
          }
        } catch {
          // 탭 없어도 진행
        }

        const products = await page.evaluate((ozCheck: (t: string) => boolean) => {
          const cards = document.querySelectorAll(
            '[class*="ProductItem"], [class*="product-item"], [class*="GiftItem"], [class*="gift-item"], ul[class*="list"] li'
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
            const rankEl = card.querySelector('[class*="rank"], [class*="Rank"], .num')
            const nameEl = card.querySelector('[class*="name"], [class*="Name"], [class*="title"]')
            const brandEl = card.querySelector('[class*="brand"], [class*="Brand"]')
            const priceEl = card.querySelector('[class*="price"], [class*="Price"]')
            const imgEl = card.querySelector('img') as HTMLImageElement | null
            const linkEl = card.querySelector('a') as HTMLAnchorElement | null

            const name = nameEl?.textContent?.trim() ?? ''
            const brand = brandEl?.textContent?.trim() ?? ''
            const priceText = priceEl?.textContent?.trim().replace(/[^0-9]/g, '') ?? '0'
            if (!name) return

            items.push({
              rank: parseInt(rankEl?.textContent?.trim().replace(/\D/g, '') || '0', 10) || idx + 1,
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
