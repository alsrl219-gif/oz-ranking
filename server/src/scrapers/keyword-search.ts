import { getBrowser, MODERN_UA, log } from './base'
import { isOzKids } from '../types'
import type { ChannelId, KeywordRankEntry } from '../types'

interface SearchResult {
  rank: number
  productName: string
  brandName: string
  price: number
  imageUrl: string
}

// ─── 채널별 검색 URL ──────────────────────────────────────────────

function getSearchUrl(channelId: ChannelId, keyword: string): string {
  const q = encodeURIComponent(keyword)
  switch (channelId) {
    case 'coupang':
      return `https://www.coupang.com/np/search?q=${q}`
    case 'smartstore':
      return `https://search.shopping.naver.com/search/all?query=${q}`
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

// ─── 채널별 상품 파싱 ─────────────────────────────────────────────

async function parseSearchResults(
  page: import('playwright').Page,
  channelId: ChannelId
): Promise<SearchResult[]> {
  return page.evaluate(
    ({ channelId }: { channelId: ChannelId }) => {
      let selector = ''
      switch (channelId) {
        case 'coupang':
          selector = 'li.search-product, li[class*="SearchProduct"], .search-product-list li'
          break
        case 'smartstore':
          selector = '[class*="productItem"], [class*="product_item"], .basicList_item__'
          break
        case 'musinsa':
          selector = '[class*="goods-list"] li, [class*="goodsList"] li, .list-box li'
          break
        case 'boribori':
          selector = '.prd_list li, .item_list li, [class*="prd-item"]'
          break
        case 'lotteon':
          selector = '.search_result li, [class*="search-result"] li, [class*="ProductItem"]'
          break
        case 'kakao':
          selector = '[class*="SearchItem"], [class*="search-item"], [class*="ProductItem"]'
          break
      }

      const cards = document.querySelectorAll(selector)
      const items: SearchResult[] = []

      cards.forEach((card, idx) => {
        if (idx >= 50) return

        const nameEl =
          card.querySelector('[class*="name"i], [class*="title"i], .name, .tit') as HTMLElement | null
        const brandEl =
          card.querySelector('[class*="brand"i], [class*="maker"i], .brand') as HTMLElement | null
        const priceEl =
          card.querySelector('[class*="price"i], .price') as HTMLElement | null
        const imgEl = card.querySelector('img') as HTMLImageElement | null

        const name = nameEl?.textContent?.trim() ?? ''
        const brand = brandEl?.textContent?.trim() ?? ''
        const priceText = priceEl?.textContent?.trim().replace(/[^0-9]/g, '') ?? '0'

        if (!name) return

        items.push({
          rank: idx + 1,
          productName: name,
          brandName: brand,
          price: parseInt(priceText, 10) || 0,
          imageUrl: imgEl?.src ?? '',
        })
      })

      return items
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
  const today = new Date().toISOString().slice(0, 10)
  const scrapedAt = new Date().toISOString()
  const baseEntry: Omit<KeywordRankEntry, 'rank' | 'productName' | 'productImage' | 'price' | 'previousRank' | 'rankDelta'> = {
    keywordId,
    keyword,
    category,
    channelId,
    date: today,
    scrapedAt,
  }

  try {
    const browser = await getBrowser()
    const context = await browser.newContext({ userAgent: MODERN_UA })
    const page = await context.newPage()

    try {
      const url = getSearchUrl(channelId, keyword)
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await page.waitForTimeout(2000)

      const results = await parseSearchResults(page, channelId)
      log('keyword-search', `[${channelId}] "${keyword}": ${results.length}개 결과`)

      // 오즈키즈 상품 필터
      const ozItem = results.find(
        (r) => isOzKids(r.brandName) || isOzKids(r.productName)
      )

      return {
        ...baseEntry,
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
      ...baseEntry,
      rank: null,
      previousRank: null,
      rankDelta: null,
      productName: null,
      productImage: null,
      price: null,
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
        .filter((h) => h.channelId === channelId && h.rank !== null)
        .sort((a, b) => b.scrapedAt.localeCompare(a.scrapedAt))[0]

      if (prevEntry && entry.rank !== null && prevEntry.rank !== null) {
        entry.previousRank = prevEntry.rank
        entry.rankDelta = prevEntry.rank - entry.rank
      }

      results.push(entry)
    }
  }

  return results
}
