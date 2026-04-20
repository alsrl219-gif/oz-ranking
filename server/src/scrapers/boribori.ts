import { getBrowser, MODERN_UA, log, makeErrorPath, withRetry } from './base'
import { computeDeltas } from '../data-store'
import type { RankingSnapshot, PeriodKey } from '../types'

const CHANNEL = 'boribori'

// 보리보리 모바일 베스트 - interval: 1=실시간, 24=일간, 168=주간, 720=월간
const INTERVAL_MAP: Record<PeriodKey, number> = {
  realtime: 1,
  daily: 24,
  weekly: 168,
  monthly: 720,
}

// 전체패션 / 키즈 / 신발 카테고리
const CATEGORIES = [
  { label: '전체패션', url: (interval: number) => `https://m.boribori.co.kr/home/best/product?interval=${interval}&dealYn=N` },
  { label: '키즈',    url: (interval: number) => `https://m.boribori.co.kr/home/best/product?interval=${interval}&dealYn=N&ageGroupCode=KD` },
  { label: '신발',    url: (interval: number) => `https://m.boribori.co.kr/home/best/product?interval=${interval}&dealYn=N&ctgrCode=SH` },
]

export async function scrapeBoribori(periods: PeriodKey[]): Promise<RankingSnapshot[]> {
  return withRetry(async () => {
    const browser = await getBrowser()
    const context = await browser.newContext({ userAgent: MODERN_UA })
    const page = await context.newPage()
    const results: RankingSnapshot[] = []

    try {
      for (const period of periods) {
        log(CHANNEL, `${period} 랭킹 수집 시작`)
        const interval = INTERVAL_MAP[period]

        // 여러 카테고리에서 수집 후 합산 (중복 제거)
        const allProducts: Array<{
          rank: number; productName: string; brandName: string
          price: number; imageUrl: string; productUrl: string; isOzKids: boolean
        }> = []

        for (const cat of CATEGORIES) {
          const url = cat.url(interval)
          try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })
            await page.waitForTimeout(1000)

            const items = await page.evaluate(() => {
              // 보리보리 모바일 상품 목록 셀렉터
              const cards = document.querySelectorAll(
                '[class*="ProductItem"], [class*="product-item"], [class*="GoodsItem"], [class*="goods-item"], ' +
                'ul[class*="ProductList"] > li, ul[class*="product-list"] > li, ' +
                'ul[class*="List"] > li[class*="item"], .product_list > li, ' +
                '[class*="BestProduct"] li, [class*="best-product"] li, ' +
                'li[class*="Product"], div[class*="ProductCard"]'
              )

              const result: Array<{
                rank: number; productName: string; brandName: string
                price: number; imageUrl: string; productUrl: string; isOzKids: boolean
              }> = []

              cards.forEach((card, idx) => {
                const rankEl = card.querySelector('[class*="rank"], [class*="Rank"], [class*="num"], [class*="Num"]')
                const nameEl = card.querySelector('[class*="name"], [class*="Name"], [class*="title"], [class*="Title"]')
                const brandEl = card.querySelector('[class*="brand"], [class*="Brand"], [class*="maker"]')
                const priceEl = card.querySelector('[class*="price"], [class*="Price"], [class*="salePrice"]')
                const imgEl = card.querySelector('img') as HTMLImageElement | null
                const linkEl = card.querySelector('a') as HTMLAnchorElement | null

                const name = nameEl?.textContent?.trim() ?? ''
                const brand = brandEl?.textContent?.trim() ?? ''
                const priceText = priceEl?.textContent?.trim().replace(/[^0-9]/g, '') ?? '0'
                if (!name && !brand) return

                result.push({
                  rank: parseInt(rankEl?.textContent?.trim().replace(/\D/g, '') || '0', 10) || idx + 1,
                  productName: name,
                  brandName: brand,
                  price: parseInt(priceText, 10) || 0,
                  imageUrl: imgEl?.src ?? '',
                  productUrl: linkEl?.href ?? '',
                  isOzKids: /오즈키즈|OZKIZ|ozkiz/i.test((brand + ' ' + name).replace(/\s/g, '')),
                })
              })
              return result
            })

            log(CHANNEL, `${period} [${cat.label}]: ${items.length}개 상품`)
            allProducts.push(...items)
          } catch (e) {
            log(CHANNEL, `${period} [${cat.label}] 오류: ${e}`)
          }
        }

        // 중복 제거 (productName 기준)
        const seen = new Set<string>()
        const unique = allProducts.filter(p => {
          if (seen.has(p.productName)) return false
          seen.add(p.productName)
          return true
        })

        log(CHANNEL, `${period}: 총 ${unique.length}개 상품, 오즈키즈 ${unique.filter(p => p.isOzKids).length}개`)

        const ozRaw = unique.filter(p => p.isOzKids)
        const ozKidsEntries = computeDeltas(ozRaw, CHANNEL, period)

        results.push({
          channelId: CHANNEL,
          period,
          scrapedAt: new Date().toISOString(),
          products: unique,
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
  }, 1, CHANNEL)
}
