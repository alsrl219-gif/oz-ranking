import { getBrowser, MODERN_UA, log, withRetry, findProductsInJson, normalizeApiProduct } from './base'
import { computeDeltas } from '../data-store'
import type { RankingSnapshot, PeriodKey } from '../types'

const CHANNEL = 'coupang'
const BASE_URL = 'https://www.coupang.com/np/categories/487148'

const TAB_TEXT: Record<PeriodKey, string> = {
  realtime: '실시간',
  daily:    '오늘',
  weekly:   '이번주',
  monthly:  '이번달',
}

export async function scrapeCoupang(periods: PeriodKey[]): Promise<RankingSnapshot[]> {
  return withRetry(async () => {
    const browser = await getBrowser()
    const context = await browser.newContext({ userAgent: MODERN_UA })
    const page = await context.newPage()
    const results: RankingSnapshot[] = []

    try {
      const allCaptured: any[][] = []
      page.on('response', async (res) => {
        const ct = res.headers()['content-type'] ?? ''
        if (!ct.includes('json')) return
        if (/log\.|analytics|gtm|clog/i.test(res.url())) return
        try {
          const json = await res.json()
          const products = findProductsInJson(json)
          if (products.length >= 5) {
            log(CHANNEL, `API 캡처: ${res.url().slice(0, 80)} (${products.length}개)`)
            allCaptured.push(products)
          }
        } catch {}
      })

      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 20000 })
      await page.waitForTimeout(3000)

      for (const period of periods) {
        try {
          const tabBtn = page.locator(`button:has-text("${TAB_TEXT[period]}"), a:has-text("${TAB_TEXT[period]}")`).first()
          if (await tabBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await tabBtn.click()
            await page.waitForTimeout(2000)
          }
        } catch {}

        let items: any[] = allCaptured.flat()

        if (items.length === 0) {
          items = await page.evaluate(() => {
            const results: any[] = []
            const cards = document.querySelectorAll(
              '.baby-product, [class*="baby-product"], ul.baby-product-list > li, ' +
              '[class*="ProductCard"], [class*="product-item"]'
            )
            cards.forEach((card, idx) => {
              const nameEl = card.querySelector('[class*="name"], [class*="Name"]')
              const priceEl = card.querySelector('[class*="price"], [class*="Price"]')
              const imgEl = card.querySelector('img') as HTMLImageElement | null
              const linkEl = card.querySelector('a') as HTMLAnchorElement | null
              const name = nameEl?.textContent?.trim() ?? ''
              if (!name) return
              results.push({
                rank: idx + 1, name,
                price: parseInt((priceEl?.textContent ?? '').replace(/[^0-9]/g, '') || '0', 10),
                imageUrl: imgEl?.src ?? '', productUrl: linkEl?.href ?? '',
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
