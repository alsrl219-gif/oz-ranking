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
      // ── API 인터셉션 시도 ─────────────────────────────────────
      const captured: any[][] = []
      page.on('response', async (res) => {
        const url = res.url()
        const ct = res.headers()['content-type'] ?? ''
        if (!ct.includes('json')) return
        if (!/gift\.kakao\.com\/a\//i.test(url)) return
        if (/ads|lottie|lnb|header|meta/i.test(url)) return
        try {
          const json = await res.json()
          const products = findProductsInJson(json)
          if (products.length >= 3) {
            log(CHANNEL, `API 캡처: ${url.slice(0, 80)} (${products.length}개)`)
            captured.push(products)
          }
        } catch {}
      })

      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 20000 })
      await page.waitForTimeout(4000)

      for (const period of supportedPeriods) {
        // ── 인터셉션 성공 시 API 데이터 사용 ─────────────────────
        let items: any[] = captured.flat()

        // ── DOM 폴백: em.num_rank + a.link_thumb 구조 ─────────────
        if (items.length === 0) {
          items = await page.evaluate(() => {
            const results: any[] = []
            // link_thumb 기준으로 상품 카드 탐색
            document.querySelectorAll('a.link_thumb, [class*="link_thumb"]').forEach((linkEl) => {
              const rankEl = linkEl.querySelector('em.num_rank, [class*="num_rank"]')
              if (!rankEl) return
              const rank = parseInt(rankEl.textContent?.trim() ?? '0', 10)
              if (!rank || rank > 200) return

              const imgEl = linkEl.querySelector('img') as HTMLImageElement | null
              const href = (linkEl as HTMLAnchorElement).href

              // 부모 컨테이너에서 이름·가격·브랜드 찾기
              const container = linkEl.parentElement
              if (!container) return

              const nameEl = container.querySelector(
                '[class*="item_name"], [class*="name_item"], strong, [class*="tit"], [class*="subject"]'
              )
              const priceEl = container.querySelector(
                '[class*="num_price"], [class*="price"], [class*="cost"]'
              )
              const brandEl = container.querySelector(
                '[class*="brand"], [class*="maker"]'
              )

              const name = nameEl?.textContent?.trim() ?? ''
              if (!name || name.length < 2) return

              results.push({
                rank,
                name,
                brandNm: brandEl?.textContent?.trim() ?? '',
                price: parseInt((priceEl?.textContent ?? '').replace(/[^0-9]/g, '') || '0', 10),
                imageUrl: imgEl?.src ?? '',
                productUrl: href,
              })
            })

            // link_thumb로 못 찾은 경우: 일반 상품카드 폴백
            if (results.length === 0) {
              document.querySelectorAll('[class*="num_rank"]').forEach((rankEl) => {
                const rank = parseInt(rankEl.textContent?.trim() ?? '0', 10)
                if (!rank || rank > 200) return
                let container = rankEl.parentElement
                for (let i = 0; i < 5 && container; i++) {
                  const text = container.textContent ?? ''
                  if (text.length > 20 && text.length < 500) {
                    const nameEl = container.querySelector('strong, p, [class*="name"]')
                    const priceEl = container.querySelector('[class*="price"]')
                    const imgEl = container.querySelector('img') as HTMLImageElement | null
                    const linkEl = container.querySelector('a') as HTMLAnchorElement | null
                    const name = nameEl?.textContent?.trim() ?? ''
                    if (name.length > 2) {
                      results.push({
                        rank, name,
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
            }
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
