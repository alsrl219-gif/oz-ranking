import { getBrowser, MODERN_UA, log, withRetry, findProductsInJson, normalizeApiProduct } from './base'
import { computeDeltas } from '../data-store'
import type { RankingSnapshot, PeriodKey } from '../types'

const CHANNEL = 'coupang'
// 아동의류 카테고리 - 봇 차단이 덜한 URL 우선 사용
const URLS = [
  'https://www.coupang.com/np/categories/487148',
  'https://m.coupang.com/nm/categories/487148',
]

const TAB_TEXT: Record<PeriodKey, string> = {
  realtime: '실시간',
  daily:    '오늘',
  weekly:   '이번주',
  monthly:  '이번달',
}

export async function scrapeCoupang(periods: PeriodKey[]): Promise<RankingSnapshot[]> {
  return withRetry(async () => {
    const browser = await getBrowser()
    const context = await browser.newContext({
      userAgent: MODERN_UA,
      extraHTTPHeaders: {
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      },
      viewport: { width: 1280, height: 800 },
    })
    const page = await context.newPage()

    // 봇 탐지 우회: webdriver 속성 제거
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
      ;(window as any).chrome = { runtime: {} }
    })

    const results: RankingSnapshot[] = []

    try {
      const allCaptured: any[][] = []
      page.on('response', async (res) => {
        const ct = res.headers()['content-type'] ?? ''
        if (!ct.includes('json')) return
        if (/log\.|analytics|gtm|clog|beacon/i.test(res.url())) return
        try {
          const json = await res.json()
          const products = findProductsInJson(json)
          if (products.length >= 5) {
            log(CHANNEL, `API 캡처: ${res.url().slice(0, 80)} (${products.length}개)`)
            allCaptured.push(products)
          }
        } catch {}
      })

      // 봇 차단 시 다음 URL 시도
      let loaded = false
      for (const url of URLS) {
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })
          await page.waitForTimeout(2000)
          const title = await page.title()
          if (!title.toLowerCase().includes('access denied') && !title.includes('403')) {
            log(CHANNEL, `페이지 로드 성공: ${title}`)
            loaded = true
            break
          }
          log(CHANNEL, `차단됨: ${title}, 다음 URL 시도`)
        } catch (e) {
          log(CHANNEL, `URL 오류: ${e}`)
        }
      }

      if (!loaded) {
        return periods.map(period => ({
          channelId: CHANNEL, period,
          scrapedAt: new Date().toISOString(),
          products: [], ozKidsEntries: [],
          error: '쿠팡 봇 차단 (Access Denied)',
        }))
      }

      for (const period of periods) {
        try {
          const tabBtn = page.locator(`button:has-text("${TAB_TEXT[period]}"), a:has-text("${TAB_TEXT[period]}")`).first()
          if (await tabBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await tabBtn.click()
            await page.waitForTimeout(1500)
          }
        } catch {}

        let items: any[] = allCaptured.flat()

        if (items.length === 0) {
          items = await page.evaluate(() => {
            const results: any[] = []
            const cards = document.querySelectorAll(
              '.baby-product, [class*="baby-product"], ' +
              'ul.baby-product-list > li, ' +
              '[class*="ProductCard"], [class*="product-item"], ' +
              'li[class*="product"]'
            )
            cards.forEach((card, idx) => {
              const nameEl = card.querySelector('[class*="name"], [class*="Name"], .name')
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
