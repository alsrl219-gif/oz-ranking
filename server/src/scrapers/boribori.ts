import { getBrowser, MODERN_UA, log, makeErrorPath, withRetry } from './base'
import { isOzKids } from '../types'
import { computeDeltas } from '../data-store'
import type { RankingSnapshot, PeriodKey } from '../types'

const CHANNEL = 'boribori'

const PERIOD_URLS: Partial<Record<PeriodKey, string>> = {
  realtime: 'https://www.boribori.co.kr/best/bestItem.php?tab=realtime',
  daily:    'https://www.boribori.co.kr/best/bestItem.php?tab=daily',
  weekly:   'https://www.boribori.co.kr/best/bestItem.php?tab=weekly',
  monthly:  'https://www.boribori.co.kr/best/bestItem.php?tab=monthly',
}

const FALLBACK_URL = 'https://www.boribori.co.kr/best/bestItem.php'

export async function scrapeBoribori(periods: PeriodKey[]): Promise<RankingSnapshot[]> {
  return withRetry(async () => {
    const browser = await getBrowser()
    const context = await browser.newContext({ userAgent: MODERN_UA })
    const page = await context.newPage()
    const results: RankingSnapshot[] = []

    try {
      for (const period of periods) {
        log(CHANNEL, `${period} 랭킹 수집 시작`)

        const url = PERIOD_URLS[period] ?? FALLBACK_URL
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
        await page.waitForTimeout(2000)

        // 기간 탭 클릭 시도
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
            await page.waitForTimeout(1500)
          }
        } catch {
          // 탭 없어도 진행
        }

        const products = await page.evaluate(() => {
          const ozCheck = (t: string) => /오즈키즈|OZKIZ|ozkiz/i.test(t.replace(/\s/g, ''))
          const cards = document.querySelectorAll(
            '.prd_list li, .product_list li, [class*="product-item"], [class*="prd-item"], .item_list li'
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
            const rankEl = card.querySelector('.rank, .num, [class*="rank"]')
            const nameEl = card.querySelector('.name, .prd_name, [class*="name"]')
            const brandEl = card.querySelector('.brand, .maker, [class*="brand"]')
            const priceEl = card.querySelector('.price, .prc, [class*="price"]')
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
