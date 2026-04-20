import { getBrowser, MODERN_UA, log, withRetry, findProductsInJson, normalizeApiProduct } from './base'
import { computeDeltas } from '../data-store'
import type { RankingSnapshot, PeriodKey } from '../types'

const CHANNEL = 'lotteon'
const BASE_URL = 'https://www.lotteon.com/p/display/shop/seltDpShop/13979?callType=menu'

const supportedSet = new Set<PeriodKey>(['realtime', 'weekly', 'monthly'])

export async function scrapeLotteon(periods: PeriodKey[]): Promise<RankingSnapshot[]> {
  return withRetry(async () => {
    const browser = await getBrowser()
    const context = await browser.newContext({ userAgent: MODERN_UA })
    const page = await context.newPage()
    const results: RankingSnapshot[] = []

    const supported = periods.filter(p => supportedSet.has(p))
    const unsupported = periods.filter(p => !supportedSet.has(p))

    try {
      const allCaptured: any[][] = []
      page.on('response', async (res) => {
        const ct = res.headers()['content-type'] ?? ''
        if (!ct.includes('json')) return
        if (/log\.|analytics|gtm|beacon/i.test(res.url())) return
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

      // 베스트 탭 클릭
      try {
        const tab = page.locator('a:has-text("베스트"), button:has-text("베스트")').first()
        if (await tab.isVisible({ timeout: 2000 }).catch(() => false)) {
          await tab.click(); await page.waitForTimeout(1500)
        }
      } catch {}

      for (const period of supported) {
        try {
          const tabMap: Record<PeriodKey, string> = {
            realtime: '실시간', daily: '일간', weekly: '주간', monthly: '월간',
          }
          const tabBtn = page.locator(`button:has-text("${tabMap[period]}"), a:has-text("${tabMap[period]}")`).first()
          if (await tabBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await tabBtn.click(); await page.waitForTimeout(1500)
          }
        } catch {}

        let items: any[] = allCaptured.flat()

        if (items.length === 0) {
          items = await page.evaluate(() => {
            const results: any[] = []
            const cards = document.querySelectorAll(
              '.prd_info, [class*="prd_info"], [class*="product-item"], ' +
              '[class*="ProductItem"], li[class*="product"], [class*="goods-item"]'
            )
            cards.forEach((card, idx) => {
              const nameEl = card.querySelector('.prd_name, [class*="name"], [class*="Name"]')
              const priceEl = card.querySelector('.price, em[class*="price"], [class*="price"]')
              const brandEl = card.querySelector('.brand, [class*="brand"]')
              const imgEl = card.querySelector('img') as HTMLImageElement | null
              const linkEl = card.querySelector('a') as HTMLAnchorElement | null
              const name = nameEl?.textContent?.trim() ?? ''
              if (!name) return
              results.push({
                rank: idx + 1, name,
                brandNm: brandEl?.textContent?.trim() ?? '',
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

      for (const period of unsupported) {
        results.push({
          channelId: CHANNEL, period,
          scrapedAt: new Date().toISOString(),
          products: [], ozKidsEntries: [],
          error: '이 채널은 해당 기간을 지원하지 않습니다',
        })
      }
    } catch (err) {
      log(CHANNEL, `오류: ${err}`)
    } finally {
      await context.close()
    }
    return results
  }, 1, CHANNEL)
}
