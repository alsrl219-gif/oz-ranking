import { getBrowser, MODERN_UA, log, withRetry, findProductsInJson, normalizeApiProduct } from './base'
import { computeDeltas } from '../data-store'
import type { RankingSnapshot, PeriodKey } from '../types'

const CHANNEL = 'smartstore'
const BASE_URL = 'https://shopping.naver.com/best100v2/main.nhn?catId=50000167'

const TAB_TEXT: Record<PeriodKey, string> = {
  realtime: '실시간',
  daily:    '일별',
  weekly:   '주간',
  monthly:  '월간',
}

export async function scrapeSmartstore(periods: PeriodKey[]): Promise<RankingSnapshot[]> {
  return withRetry(async () => {
    const browser = await getBrowser()
    const context = await browser.newContext({ userAgent: MODERN_UA })
    const page = await context.newPage()
    const results: RankingSnapshot[] = []

    try {
      const allCaptured: Map<string, any[]> = new Map()
      page.on('response', async (res) => {
        const url = res.url()
        const ct = res.headers()['content-type'] ?? ''
        if (!ct.includes('json')) return
        if (/log\.|analytics|gtm|wcs|naver\.com\/v1\/nlog/i.test(url)) return
        try {
          const json = await res.json()
          const products = findProductsInJson(json)
          if (products.length >= 5) {
            log(CHANNEL, `API 캡처: ${url.slice(0, 80)} (${products.length}개)`)
            allCaptured.set(url, products)
          }
        } catch {}
      })

      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 20000 })
      await page.waitForTimeout(3000)

      for (const period of periods) {
        try {
          const tabText = TAB_TEXT[period]
          const tabBtn = page.locator(`button:has-text("${tabText}"), a:has-text("${tabText}"), li:has-text("${tabText}")`).first()
          if (await tabBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await tabBtn.click()
            await page.waitForTimeout(2000)
          }
        } catch {}

        let items: any[] = [...allCaptured.values()].flat()

        if (items.length === 0) {
          items = await page.evaluate(() => {
            const results: any[] = []
            const cards = document.querySelectorAll(
              '.best_list li, [class*="BestItem"], [class*="best-item"], ' +
              '[class*="ProductCard"], .product_list li'
            )
            cards.forEach((card, idx) => {
              const nameEl = card.querySelector('a.tit, .tit, [class*="name"], [class*="Name"]')
              const priceEl = card.querySelector('.price strong, [class*="price"]')
              const brandEl = card.querySelector('.brand, [class*="brand"], .maker')
              const rankEl = card.querySelector('em.num, .num, [class*="rank"]')
              const imgEl = card.querySelector('img') as HTMLImageElement | null
              const linkEl = card.querySelector('a') as HTMLAnchorElement | null
              const name = nameEl?.textContent?.trim() ?? ''
              if (!name) return
              results.push({
                rank: rankEl ? parseInt(rankEl.textContent?.trim() ?? '', 10) || idx + 1 : idx + 1,
                name,
                brandNm: brandEl?.textContent?.trim() ?? '',
                price: parseInt((priceEl?.textContent ?? '').replace(/[^0-9]/g, '') || '0', 10),
                imageUrl: imgEl?.src ?? '',
                productUrl: linkEl?.href ?? '',
              })
            })
            return results
          })
        }

        const products = items.map((item, i) => normalizeApiProduct(item, i))
          .filter(p => p.productName.length > 1).slice(0, 100)

        log(CHANNEL, `${period}: ${products.length}개, 오즈키즈 ${products.filter(p => p.isOzKids).length}개`)
        const ozRaw = products.filter(p => p.isOzKids)
        results.push({
          channelId: CHANNEL, period,
          scrapedAt: new Date().toISOString(),
          products, ozKidsEntries: computeDeltas(ozRaw, CHANNEL, period),
        })
      }
    } catch (err) {
      log(CHANNEL, `오류: ${err}`)
      for (const period of periods.slice(results.length)) {
        results.push({
          channelId: CHANNEL, period,
          scrapedAt: new Date().toISOString(),
          products: [], ozKidsEntries: [], error: String(err),
        })
      }
    } finally {
      await context.close()
    }
    return results
  }, 1, CHANNEL)
}
