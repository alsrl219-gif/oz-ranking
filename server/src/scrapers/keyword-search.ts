import { getBrowser, MODERN_UA, log } from './base'
import { isOzKids } from '../types'
import type { ChannelId, KeywordRankEntry } from '../types'

interface SearchResult {
  rank: number
  productName: string
  brandName: string
  price: number
  imageUrl: string
  productUrl: string
}

// ─── 채널별 검색 URL ──────────────────────────────────────────────

function getSearchUrl(channelId: ChannelId, keyword: string): string {
  const q = encodeURIComponent(keyword)
  switch (channelId) {
    case 'coupang':
      return `https://www.coupang.com/np/search?q=${q}&channel=user&component=&eventCategory=SRP&trcid=&traid=&sorter=scoreDesc&minPrice=&maxPrice=&priceRange=&filterType=&listSize=36&filter=&isPriceRange=false&brand=&offerCondition=&rating=0&page=1&rocketAll=false&searchIndexingToken=1=6`
    case 'smartstore':
      return `https://search.shopping.naver.com/search/all?query=${q}&cat_id=&frm=NVSHATC`
    case 'musinsa':
      return `https://www.musinsa.com/search/goods?q=${q}&storeCode=kids`
    case 'boribori':
      return `https://www.boribori.co.kr/itemsearch/itemSearch.php?search_word=${q}`
    case 'lotteon':
      return `https://www.lotteon.com/search/search.do?query=${q}`
    case 'kakao':
      return `https://gift.kakao.com/search?q=${q}`
  }
}

// ─── 채널별 결과 파싱 ─────────────────────────────────────────────

async function parseSearchResults(
  page: import('playwright').Page,
  channelId: ChannelId
): Promise<SearchResult[]> {
  await page.waitForTimeout(channelId === 'smartstore' ? 3000 : 2000)

  return page.evaluate(
    ({ channelId }: { channelId: ChannelId }) => {
      const results: Array<{
        rank: number; productName: string; brandName: string
        price: number; imageUrl: string; productUrl: string
      }> = []

      if (channelId === 'coupang') {
        // 쿠팡: search-product 리스트
        const cards = document.querySelectorAll(
          'li.search-product, [class*="search-product-list"] li, ' +
          '[data-search-id] li, ul[class*="products"] li'
        )
        cards.forEach((card, idx) => {
          if (idx >= 60) return
          const nameEl = card.querySelector(
            '[class*="name"], [class*="productName"], .name, ' +
            'dl dd:first-child, [class*="product-name"]'
          )
          const brandEl = card.querySelector('[class*="brand"], [class*="vendor"]')
          const priceEl = card.querySelector('[class*="price-value"], [class*="priceValue"], strong[class*="price"]')
          const imgEl   = card.querySelector('img') as HTMLImageElement | null
          const linkEl  = card.querySelector('a[href]') as HTMLAnchorElement | null
          const name    = nameEl?.textContent?.trim() ?? ''
          if (!name || name.length < 2) return
          results.push({
            rank: idx + 1,
            productName: name,
            brandName: brandEl?.textContent?.trim() ?? '',
            price: parseInt((priceEl?.textContent ?? '').replace(/[^0-9]/g, '') || '0', 10),
            imageUrl: imgEl?.src ?? '',
            productUrl: linkEl?.href ?? '',
          })
        })

      } else if (channelId === 'smartstore') {
        // 네이버쇼핑: 다양한 레이아웃 대응
        const cards = document.querySelectorAll(
          '[class*="basicList_item__"], [class*="product_item"], ' +
          '[class*="ProductItem"], [data-shp-contents-id]'
        )
        cards.forEach((card, idx) => {
          if (idx >= 60) return
          const nameEl = card.querySelector(
            '[class*="productName"], [class*="product_name"], ' +
            '[class*="title"], [class*="tit"]'
          )
          const brandEl = card.querySelector(
            '[class*="brandName"], [class*="brand_name"], ' +
            '[class*="mall"], [class*="store"]'
          )
          const priceEl = card.querySelector('[class*="price_num__"], [class*="priceValue"], strong')
          const imgEl   = card.querySelector('img') as HTMLImageElement | null
          const linkEl  = card.querySelector('a[href]') as HTMLAnchorElement | null
          const name    = nameEl?.textContent?.trim() ?? ''
          if (!name || name.length < 2) return
          results.push({
            rank: idx + 1,
            productName: name,
            brandName: brandEl?.textContent?.trim() ?? '',
            price: parseInt((priceEl?.textContent ?? '').replace(/[^0-9]/g, '') || '0', 10),
            imageUrl: imgEl?.src ?? '',
            productUrl: linkEl?.href ?? '',
          })
        })

      } else if (channelId === 'musinsa') {
        const cards = document.querySelectorAll('[class*="goods-list"] li, [class*="goodsList"] li')
        cards.forEach((card, idx) => {
          if (idx >= 50) return
          const nameEl  = card.querySelector('[class*="goods-name"], [class*="goodsName"], .name')
          const brandEl = card.querySelector('[class*="brand"], .brand')
          const priceEl = card.querySelector('[class*="price"]')
          const imgEl   = card.querySelector('img') as HTMLImageElement | null
          const linkEl  = card.querySelector('a') as HTMLAnchorElement | null
          const name    = nameEl?.textContent?.trim() ?? ''
          if (!name) return
          results.push({
            rank: idx + 1,
            productName: name,
            brandName: brandEl?.textContent?.trim() ?? '',
            price: parseInt((priceEl?.textContent ?? '').replace(/[^0-9]/g, '') || '0', 10),
            imageUrl: imgEl?.src ?? '',
            productUrl: linkEl?.href ?? '',
          })
        })

      } else if (channelId === 'boribori') {
        const cards = document.querySelectorAll('.prd_list li, .item_list li, [class*="prd-item"]')
        cards.forEach((card, idx) => {
          if (idx >= 50) return
          const nameEl  = card.querySelector('[class*="name"], .name, .tit')
          const brandEl = card.querySelector('[class*="brand"]')
          const priceEl = card.querySelector('[class*="price"]')
          const imgEl   = card.querySelector('img') as HTMLImageElement | null
          const linkEl  = card.querySelector('a') as HTMLAnchorElement | null
          const name    = nameEl?.textContent?.trim() ?? ''
          if (!name) return
          results.push({
            rank: idx + 1, productName: name,
            brandName: brandEl?.textContent?.trim() ?? '',
            price: parseInt((priceEl?.textContent ?? '').replace(/[^0-9]/g, '') || '0', 10),
            imageUrl: imgEl?.src ?? '', productUrl: linkEl?.href ?? '',
          })
        })

      } else if (channelId === 'lotteon') {
        const cards = document.querySelectorAll('[class*="ProductItem"], [class*="search-result"] li, ul li[class*="item"]')
        cards.forEach((card, idx) => {
          if (idx >= 50) return
          const nameEl  = card.querySelector('[class*="name"], [class*="Name"]')
          const brandEl = card.querySelector('[class*="brand"], [class*="Brand"]')
          const priceEl = card.querySelector('[class*="price"], [class*="Price"]')
          const imgEl   = card.querySelector('img') as HTMLImageElement | null
          const linkEl  = card.querySelector('a') as HTMLAnchorElement | null
          const name    = nameEl?.textContent?.trim() ?? ''
          if (!name) return
          results.push({
            rank: idx + 1, productName: name,
            brandName: brandEl?.textContent?.trim() ?? '',
            price: parseInt((priceEl?.textContent ?? '').replace(/[^0-9]/g, '') || '0', 10),
            imageUrl: imgEl?.src ?? '', productUrl: linkEl?.href ?? '',
          })
        })

      } else if (channelId === 'kakao') {
        const cards = document.querySelectorAll('[class*="SearchItem"], [class*="search-item"]')
        cards.forEach((card, idx) => {
          if (idx >= 50) return
          const nameEl  = card.querySelector('[class*="name"], [class*="Name"]')
          const brandEl = card.querySelector('[class*="brand"], [class*="Brand"]')
          const priceEl = card.querySelector('[class*="price"], [class*="Price"]')
          const imgEl   = card.querySelector('img') as HTMLImageElement | null
          const linkEl  = card.querySelector('a') as HTMLAnchorElement | null
          const name    = nameEl?.textContent?.trim() ?? ''
          if (!name) return
          results.push({
            rank: idx + 1, productName: name,
            brandName: brandEl?.textContent?.trim() ?? '',
            price: parseInt((priceEl?.textContent ?? '').replace(/[^0-9]/g, '') || '0', 10),
            imageUrl: imgEl?.src ?? '', productUrl: linkEl?.href ?? '',
          })
        })
      }

      return results
    },
    { channelId }
  )
}

// ─── 단일 키워드 × 채널 검색 ──────────────────────────────────────

export async function searchKeywordInChannel(
  keywordId: string,
  keyword: string,
  category: string,
  channelId: ChannelId
): Promise<KeywordRankEntry> {
  const today     = new Date().toISOString().slice(0, 10)
  const scrapedAt = new Date().toISOString()
  const base = { keywordId, keyword, category, channelId, date: today, scrapedAt }

  try {
    const browser = await getBrowser()
    const context = await browser.newContext({
      userAgent: MODERN_UA,
      extraHTTPHeaders: { 'Accept-Language': 'ko-KR,ko;q=0.9' },
    })
    const page = await context.newPage()

    // 봇 탐지 우회
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
    })

    try {
      const url = getSearchUrl(channelId, keyword)
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })

      const results = await parseSearchResults(page, channelId)
      log('keyword-search', `[${channelId}] "${keyword}": ${results.length}개 파싱`)

      const ozItem = results.find(r => isOzKids(r.brandName) || isOzKids(r.productName))

      return {
        ...base,
        rank: ozItem?.rank ?? null,
        previousRank: null,
        rankDelta: null,
        productName: ozItem?.productName ?? null,
        productImage: ozItem?.imageUrl ?? null,
        price: ozItem?.price ?? null,
      }
    } finally {
      await context.close()
    }
  } catch (err) {
    log('keyword-search', `[${channelId}] "${keyword}" 오류: ${err}`)
    return {
      ...base,
      rank: null, previousRank: null, rankDelta: null,
      productName: null, productImage: null, price: null,
    }
  }
}

// ─── 전체 키워드 스크래핑 ─────────────────────────────────────────

export async function scrapeAllKeywords(
  keywords: import('../types').Keyword[]
): Promise<KeywordRankEntry[]> {
  const { loadKeywordHistory } = await import('../keywords-store')
  const results: KeywordRankEntry[] = []

  for (const kw of keywords) {
    for (const channelId of kw.channels) {
      const entry = await searchKeywordInChannel(kw.id, kw.keyword, kw.category, channelId)

      // 이전 랭킹 계산
      const history = loadKeywordHistory(kw.id, 7)
      const prevEntry = history
        .filter(h => h.channelId === channelId && h.rank !== null)
        .sort((a, b) => b.scrapedAt.localeCompare(a.scrapedAt))[0]

      if (prevEntry && entry.rank !== null && prevEntry.rank !== null) {
        entry.previousRank = prevEntry.rank
        entry.rankDelta    = prevEntry.rank - entry.rank
      }

      results.push(entry)
    }
  }

  return results
}
