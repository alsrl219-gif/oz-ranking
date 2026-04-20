import { getBrowser, MODERN_UA, log, withRetry, findProductsInJson, normalizeApiProduct } from './base'
import { computeDeltas } from '../data-store'
import type { RankingSnapshot, PeriodKey } from '../types'

const CHANNEL = 'kakao'
const BASE_URL = 'https://gift.kakao.com/ranking/category/3'

export async function scrapeKakao(periods: PeriodKey[]): Promise<RankingSnapshot[]> {
  return withRetry(async () => {
    const browser = await getBrowser()
    const context = await browser.newContext({ userAgent: MODERN_UA })
    const page = await context.newPage()
    const results: RankingSnapshot[] = []

    const supportedPeriods = periods.filter(p => p === 'realtime')

    try {
      // ── API 응답 인터셉트 ────────────────────────────────────────
      const captured: any[][] = []
      page.on('response', async (res) => {
        const ct = res.headers()['content-type'] ?? ''
        if (!ct.includes('json')) return
        if (/analytics|amplitude|log\.|gtm/i.test(res.url())) return
        try {
          const json = await res.json()
          const products = findProductsInJson(json)
          if (products.length >= 3) {
            log(CHANNEL, `API 캡처: ${res.url().slice(0, 80)} (${products.length}개)`)
            captured.push(products)
          }
        } catch {}
      })

      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 20000 })
      await page.waitForTimeout(4000)

      for (const period of supportedPeriods) {
        let items: any[] = captured.flat()

        // ── DOM 폴백 ─────────────────────────────────────────────
        if (items.length === 0) {
          items = await page.evaluate(() => {
            const results: any[] = []
            // 카카오선물하기 상품 카드: 순위 숫자 기준 탐색
            document.querySelectorAll('*').forEach((el) => {
              const txt = el.textContent?.trim()
              if (!txt || !/^\d{1,3}$/.test(txt)) return
              const rank = parseInt(txt, 10)
              if (rank < 1 || rank > 100) return

              let container = el.parentElement
              for (let i = 0; i < 7 && container; i++) {
                const text = container.textContent ?? ''
                if (text.length > 15 && text.length < 500 && /[\d,]+원/.test(text)) {
                  const nameEl = container.querySelector('[class*="name"], [class*="Name"], [class*="title"], p')
                  const priceEl = container.querySelector('[class*="price"], [class*="Price"]')
                  const brandEl = container.querySelector('[class*="brand"], [class*="Brand"]')
                  const imgEl = container.querySelector('img') as HTMLImageElement | null
                  const linkEl = container.querySelector('a') as HTMLAnchorElement | null
                  const name = nameEl?.textContent?.trim() ?? ''
                  if (name.length > 2) {
                    results.push({
                      rank,
                      name,
                      brandNm: brandEl?.textContent?.trim() ?? '',
                      price: parseInt((priceEl?.textContent ?? '').replace(/[^0-9]/g, '') || '0', 10),
                      imageUrl: imgEl?.src ?? '',
                      productUrl: linkEl?.href ?? '',
                    })
                    break
                  }
                }
                container = container.parentElement
              }
            })
            return results
          })
        }

        const products = items
          .map((item, i) => normalizeApiProduct(item, i))
          .filter(p => p.productName.length > 1)
          .slice(0, 100)

        log(CHANNEL, `${period}: ${products.length}개, 오즈키즈 ${products.filter(p => p.isOzKids).length}개`)

        const ozRaw = products.filter(p => p.isOzKids)
        results.push({
          channelId: CHANNEL, period,
          scrapedAt: new Date().toISOString(),
          products, ozKidsEntries: computeDeltas(ozRaw, CHANNEL, period),
        })
      }

      // 미지원 기간
      for (const period of periods.filter(p => !supportedPeriods.includes(p))) {
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
