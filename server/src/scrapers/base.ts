import { chromium, type Browser } from 'playwright'
import { config } from '../config'

let _browser: Browser | null = null

export async function getBrowser(): Promise<Browser> {
  if (_browser && _browser.isConnected()) return _browser
  _browser = await chromium.launch({
    headless: config.headless,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  return _browser
}

export async function closeBrowser(): Promise<void> {
  if (_browser) {
    await _browser.close()
    _browser = null
  }
}

export const MODERN_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

export function log(channel: string, msg: string) {
  console.log(`[${new Date().toISOString()}] [${channel}] ${msg}`)
}

export function makeErrorPath(channel: string): string {
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  return `${config.errorsDir}/screenshot-${channel}-${ts}.png`
}

// ─── 공통: JSON에서 상품 배열 자동 탐지 ──────────────────────────
export function findProductsInJson(obj: any, depth = 0): any[] {
  if (depth > 7 || obj == null) return []
  if (Array.isArray(obj) && obj.length >= 5) {
    const first = obj[0]
    if (first && typeof first === 'object') {
      const keys = Object.keys(first).join(',').toLowerCase()
      if ((keys.includes('name') || keys.includes('nm') || keys.includes('title') || keys.includes('subject')) &&
          (keys.includes('price') || keys.includes('amt') || keys.includes('prc') || keys.includes('cost'))) {
        return obj
      }
    }
  }
  if (typeof obj === 'object') {
    for (const v of Object.values(obj as object)) {
      const found = findProductsInJson(v, depth + 1)
      if (found.length >= 5) return found
    }
  }
  return []
}

// ─── 공통: 각 사이트 JSON 필드명 자동 정규화 ────────────────────
export function normalizeApiProduct(raw: any, idx: number) {
  const rank = raw.rank ?? raw.rankNo ?? raw.ranking ?? raw.rankOrder ?? raw.no ?? idx + 1
  const brand =
    raw.brandName ?? raw.brand ?? raw.brandNm ?? raw.makerNm ?? raw.maker ??
    raw.vendorName ?? raw.sellerName ?? ''
  const name =
    raw.goodsName ?? raw.productName ?? raw.itemName ?? raw.name ??
    raw.title ?? raw.goodsNm ?? raw.prodNm ?? raw.prdtName ?? raw.dispNm ?? ''
  const rawPrice =
    raw.salePrice ?? raw.finalPrice ?? raw.price ?? raw.sellPrice ??
    raw.normalPrice ?? raw.basicPrice ?? raw.dcPrice ?? raw.salAmt ?? 0
  const price =
    typeof rawPrice === 'number' ? rawPrice
    : parseInt(String(rawPrice).replace(/\D/g, '') || '0', 10)
  const imageUrl =
    raw.imageUrl ?? raw.imgUrl ?? raw.thumbnail ?? raw.image ??
    raw.imgPath ?? raw.goodsImg ?? raw.repImgUrl ?? raw.listImgUrl ?? ''
  const productUrl =
    raw.goodsUrl ?? raw.productUrl ?? raw.url ?? raw.link ??
    raw.linkUrl ?? raw.detailUrl ?? raw.pcUrl ?? raw.mobileUrl ?? ''

  return {
    rank: typeof rank === 'number' ? rank : idx + 1,
    productName: String(name).trim(),
    brandName: String(brand).trim(),
    price,
    imageUrl: String(imageUrl),
    productUrl: String(productUrl),
    isOzKids: /오즈키즈|OZKIZ|ozkiz/i.test(
      (String(brand) + ' ' + String(name)).replace(/\s/g, '')
    ),
  }
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  label = ''
): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      log(label, `재시도 ${i + 1}/${retries}: ${err}`)
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)))
    }
  }
  throw lastErr
}
