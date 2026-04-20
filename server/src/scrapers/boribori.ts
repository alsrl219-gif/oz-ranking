import { getBrowser, MODERN_UA, log, withRetry, findProductsInJson, normalizeApiProduct } from './base'
import { computeDeltas } from '../data-store'
import type { RankingSnapshot, PeriodKey } from '../types'

const CHANNEL = 'boribori'

// 보리보리: 1일(24h) / 7일(168h)  ※3일은 PeriodKey에 없어 weekly로 7일 사용
const INTERVAL_MAP: Partial<Record<PeriodKey, number>> = {
  realtime: 24,
  daily:    24,
  weekly:   168,
}

// 패션 > 전체 / 키즈 / 신발
const CATEGORIES = [
  { label: '전체',  params: '' },
  { label: '키즈',  params: '&ageGroupCode=KD' },
  { label: '신발',  params: '&ctgrCode=SH' },
]

export async function scrapeBoribori(periods: PeriodKey[]): Promise<RankingSnapshot[]> {
  return withRetry(async () => {
    const browser = await getBrowser()
    const results: RankingSnapshot[] = []

    for (const period of periods) {
      const interval = INTERVAL_MAP[period]
      if (!interval) {
        results.push({
          channelId: CHANNEL, period,
          scrapedAt: new Date().toISOString(),
          products: [], ozKidsEntries: [],
          error: '이 채널은 해당 기간을 지원하지 않습니다',
        })
        continue
      }

      log(CHANNEL, `${period} (interval=${interval}h) 수집 시작`)

      const seen = new Set<string>()
      const allProducts: ReturnType<typeof normalizeApiProduct>[] = []

      for (const cat of CATEGORIES) {
        const url = `https://m.boribori.co.kr/home/best/product?interval=${interval}&dealYn=N${cat.params}`
        const context = await browser.newContext({ userAgent: MODERN_UA })
        const page = await context.newPage()

        try {
          // ── API 응답 인터셉트 ──────────────────────────────────
          const captured: any[][] = []
          page.on('response', async (res) => {
            const ct = res.headers()['content-type'] ?? ''
            if (!ct.includes('json')) return
            if (/log\.|analytics|braze|shoplive|amplitude/i.test(res.url())) return
            try {
              const json = await res.json()
              const products = findProductsInJson(json)
              if (products.length >= 3) captured.push(products)
            } catch {}
          })

          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })
          await page.waitForTimeout(4000) // API 호출 대기

          let items: any[] = captured.flat()

          // ── DOM 폴백: 인터셉트 실패 시 DOM에서 직접 추출 ──────
          if (items.length === 0) {
            items = await page.evaluate(() => {
              const results: any[] = []
              // 보리보리는 순위 숫자(1,2,3...)가 있는 요소를 기준으로 카드 탐색
              document.querySelectorAll('*').forEach((el) => {
                const txt = el.textContent?.trim()
                if (!txt || !/^\d{1,3}$/.test(txt)) return
                const rank = parseInt(txt, 10)
                if (rank < 1 || rank > 100) return
                // 조상 중 가격·상품명이 있는 컨테이너 찾기
                let container = el.parentElement
                for (let i = 0; i < 6 && container; i++) {
                  const text = container.textContent ?? ''
                  const hasPrice = /[\d,]+원/.test(text)
                  const hasName = text.length > 10 && text.length < 300
                  if (hasPrice && hasName) {
                    const nameEl = container.querySelector('p, h3, h4, [class*="name"], [class*="Name"], [class*="title"]')
                    const priceEl = container.querySelector('[class*="price"], [class*="Price"]')
                    const brandEl = container.querySelector('[class*="brand"], [class*="Brand"]')
                    const imgEl = container.querySelector('img') as HTMLImageElement | null
                    const linkEl = container.querySelector('a') as HTMLAnchorElement | null
                    const name = nameEl?.textContent?.trim() ?? ''
                    const priceText = priceEl?.textContent?.replace(/[^0-9]/g, '') ?? '0'
                    if (name && name.length > 2) {
                      results.push({
                        rank,
                        name,
                        brandNm: brandEl?.textContent?.trim() ?? '',
                        price: parseInt(priceText, 10) || 0,
                        imageUrl: imgEl?.src ?? '',
                        productUrl: linkEl?.href ?? '',
                      })
                    }
                    break
                  }
                  container = container.parentElement
                }
              })
              return results
            })
          }

          const normalized = items.map((item, i) => normalizeApiProduct(item, i))
            .filter(p => p.productName.length > 1)

          log(CHANNEL, `${period} [${cat.label}] API=${captured.flat().length}개, DOM=${items.length}개`)

          for (const p of normalized) {
            if (!seen.has(p.productName)) {
              seen.add(p.productName)
              allProducts.push(p)
            }
          }
        } catch (e) {
          log(CHANNEL, `${period} [${cat.label}] 오류: ${e}`)
        } finally {
          await context.close()
        }
      }

      // 순위 재정렬 (등장 순서 기준)
      const products = allProducts.map((p, i) => ({ ...p, rank: p.rank || i + 1 }))
      const ozRaw = products.filter(p => p.isOzKids)
      const ozKidsEntries = computeDeltas(ozRaw, CHANNEL, period)

      log(CHANNEL, `${period}: 총 ${products.length}개, 오즈키즈 ${ozRaw.length}개`)

      results.push({
        channelId: CHANNEL, period,
        scrapedAt: new Date().toISOString(),
        products, ozKidsEntries,
      })
    }

    return results
  }, 1, CHANNEL)
}
