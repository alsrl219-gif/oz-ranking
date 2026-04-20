/**
 * 채널별 수집 빠른 테스트
 * 실행: npx tsx src/scrapers/test-channels.ts
 */
import { chromium } from 'playwright'

const MODERN_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

const CHANNELS = [
  {
    name: '무신사키즈API',  // Playwright 없이 직접 API 테스트
    url: 'API_ONLY',
  },
  {
    name: '무신사키즈',
    url: 'https://www.musinsa.com/main/kids/ranking?gf=A&storeCode=kids&sectionId=234&categoryCode=106000&ageBand=AGE_BAND_ALL&rankingType=REALTIME',
  },
  {
    name: '보리보리',
    url: 'https://m.boribori.co.kr/home/best/product?interval=24&dealYn=N&ageGroupCode=KD',
  },
  {
    name: '카카오선물하기',
    url: 'https://gift.kakao.com/ranking/category/3',
  },
  {
    name: '롯데온',
    url: 'https://www.lotteon.com/p/display/shop/seltDpShop/13979?callType=menu',
  },
  {
    name: '쿠팡',
    url: 'https://www.coupang.com/np/categories/487148',
  },
  {
    name: '스마트스토어',
    url: 'https://shopping.naver.com/best100v2/main.nhn?catId=50000167',
  },
]

async function testMusinsaAPI() {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`[무신사키즈API] 직접 API 호출 테스트`)
  const apiUrl = 'https://api.musinsa.com/api2/hm/web/v5/pans/ranking?storeCode=kids&sectionId=234&gf=A&categoryCode=106000&ageBand=AGE_BAND_ALL&rankingType=REALTIME'
  try {
    const res = await fetch(apiUrl, {
      headers: {
        'User-Agent': MODERN_UA,
        'Accept': 'application/json',
        'Referer': 'https://www.musinsa.com/',
      }
    })
    console.log(`   HTTP 상태: ${res.status}`)
    const json = await res.json() as any
    const text = JSON.stringify(json)
    console.log(`   응답 크기: ${text.length} chars`)

    // 상품 배열 찾기
    const scan = (obj: any, depth = 0): any[] => {
      if (depth > 6) return []
      if (Array.isArray(obj) && obj.length > 3 && obj[0]?.info?.productName) return obj
      if (typeof obj === 'object' && obj !== null) {
        for (const v of Object.values(obj)) {
          const found = scan(v, depth + 1)
          if (found.length > 0) return found
        }
      }
      return []
    }
    const items = scan(json)
    console.log(`   ✅ 상품 ${items.length}개 발견!`)
    items.slice(0, 5).forEach((item: any, i: number) => {
      const rank  = item?.image?.rank ?? i + 1
      const brand = item?.info?.brandName ?? ''
      const name  = item?.info?.productName ?? ''
      const price = item?.info?.finalPrice ?? 0
      console.log(`   ${rank}위. [${brand}] ${name} — ${price.toLocaleString()}원`)
    })
  } catch (err) {
    console.log(`   ❌ 오류: ${err}`)
  }
}

async function testChannel(name: string, url: string) {
  if (url === 'API_ONLY') { await testMusinsaAPI(); return }
  const browser = await chromium.launch({ headless: false }) // headless:false → 직접 눈으로 확인
  const context = await browser.newContext({ userAgent: MODERN_UA })
  const page = await context.newPage()

  const apiCalls: string[] = []
  page.on('response', async (res) => {
    const ct = res.headers()['content-type'] ?? ''
    if (ct.includes('json') && !/google|facebook|amplitude|gtm/i.test(res.url())) {
      apiCalls.push(res.url())
    }
  })

  console.log(`\n${'='.repeat(60)}`)
  console.log(`[${name}] 시작`)
  console.log(`URL: ${url}`)

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.waitForTimeout(3000)

    const result = await page.evaluate(() => {
      // __NEXT_DATA__ 전체 파싱
      let nextDataKeys: string[] = []
      let nextDataRankingSnippet: string | null = null
      const nextDataRaw = document.getElementById('__NEXT_DATA__')?.textContent ?? null
      if (nextDataRaw) {
        try {
          const parsed = JSON.parse(nextDataRaw)
          // pageProps 키 목록
          const pp = parsed?.props?.pageProps ?? {}
          nextDataKeys = Object.keys(pp)
          // ranking/product 관련 키 찾아서 샘플
          const findDeep = (obj: any, depth = 0): string | null => {
            if (depth > 5) return null
            if (Array.isArray(obj) && obj.length > 0) {
              const first = obj[0]
              if (first && typeof first === 'object' &&
                  (first.goodsNo || first.productNo || first.itemId || first.goodsId ||
                   first.rank || first.brandName || first.goodsName || first.productName)) {
                return JSON.stringify(obj.slice(0, 3))
              }
            }
            if (typeof obj === 'object' && obj !== null) {
              for (const k of Object.keys(obj)) {
                const found = findDeep(obj[k], depth + 1)
                if (found) return found
              }
            }
            return null
          }
          nextDataRankingSnippet = findDeep(pp)
        } catch {}
      }

      // DOM에서 상품처럼 보이는 요소 수 체크
      const selectors: Record<string, number> = {
        'li[class]': document.querySelectorAll('li[class]').length,
        '[class*="product" i]': document.querySelectorAll('[class*="product"]').length,
        '[class*="item" i]': document.querySelectorAll('[class*="item"]').length,
        '[class*="goods" i]': document.querySelectorAll('[class*="goods"]').length,
        '[class*="rank" i]': document.querySelectorAll('[class*="rank"]').length,
        'ul > li': document.querySelectorAll('ul > li').length,
      }

      // 페이지 내 텍스트에서 오즈키즈 등장 여부
      const bodyText = document.body.innerText
      const hasOzKids = /오즈키즈|OZKIZ/i.test(bodyText)

      // ul > li 첫 3개 텍스트
      const liSamples = Array.from(document.querySelectorAll('ul > li')).slice(0, 3)
        .map(el => el.textContent?.trim().slice(0, 80))

      // item 클래스 첫 3개 클래스명
      const itemSamples = Array.from(document.querySelectorAll('[class*="item"]')).slice(0, 3)
        .map(el => (el as HTMLElement).className.slice(0, 80))

      // 순위 숫자(1,2,3)가 있는 요소 찾기 → 상품카드 구조 파악
      const rankEls = Array.from(document.querySelectorAll('*')).filter(el => {
        const txt = el.textContent?.trim()
        return txt === '1' || txt === '2' || txt === '3'
      }).slice(0, 5)
      const rankElInfo = rankEls.map(el => ({
        tag: el.tagName,
        cls: (el as HTMLElement).className.slice(0, 60),
        parentCls: ((el.parentElement as HTMLElement)?.className ?? '').slice(0, 60),
        grandCls: ((el.parentElement?.parentElement as HTMLElement)?.className ?? '').slice(0, 60),
      }))

      // __NUXT__ 상태 (Vue/Nuxt)
      const w = window as any
      const nuxtKeys = w.__NUXT__ ? Object.keys(w.__NUXT__) : []
      const nuxtDataSnippet = w.__NUXT__?.data ? JSON.stringify(w.__NUXT__.data).slice(0, 1000) : null

      return {
        title: document.title,
        finalUrl: location.href,
        selectors,
        hasOzKids,
        nextDataKeys,
        nextDataRankingSnippet,
        liSamples,
        itemSamples,
        rankElInfo,
        nuxtKeys,
        nuxtDataSnippet,
        bodyLength: document.body.innerHTML.length,
      }
    })

    console.log(`✅ 페이지 로드 성공`)
    console.log(`   제목: ${result.title}`)
    console.log(`   최종 URL: ${result.finalUrl}`)
    console.log(`   body 크기: ${result.bodyLength.toLocaleString()} chars`)
    console.log(`   오즈키즈 등장: ${result.hasOzKids ? '🔴 있음!' : '없음'}`)
    console.log(`   셀렉터 히트:`, result.selectors)
    console.log(`   ul>li 샘플:`, result.liSamples)
    console.log(`   item 클래스 샘플:`, result.itemSamples)
    console.log(`   __NEXT_DATA__ pageProps 키:`, result.nextDataKeys)
    if (result.nextDataRankingSnippet) {
      console.log(`   ✨ __NEXT_DATA__ 상품 발견:`, result.nextDataRankingSnippet.slice(0, 500))
    } else {
      console.log(`   __NEXT_DATA__ 상품 데이터: 없음`)
    }
    if ((result as any).nuxtKeys?.length > 0) {
      console.log(`   __NUXT__ 키:`, (result as any).nuxtKeys)
    }
    if ((result as any).nuxtDataSnippet) {
      console.log(`   ✨ __NUXT__ data 발견:`, (result as any).nuxtDataSnippet.slice(0, 500))
    }
    if ((result as any).rankElInfo?.length > 0) {
      console.log(`   순위요소 구조:`)
      ;(result as any).rankElInfo.forEach((r: any) => {
        console.log(`     <${r.tag} class="${r.cls}"> 부모: "${r.parentCls}" 조부모: "${r.grandCls}"`)
      })
    }
    console.log(`   JSON API 호출 (${apiCalls.length}개):`)
    apiCalls.slice(0, 15).forEach(u => console.log(`     - ${u}`))

    // 페이지 스크린샷
    await page.screenshot({ path: `./debug-${name}.png`, fullPage: false })
    console.log(`   📸 스크린샷: debug-${name}.png`)

  } catch (err) {
    console.log(`❌ 오류: ${err}`)
  } finally {
    await browser.close()
  }
}

;(async () => {
  const target = process.argv[2] // 특정 채널만 테스트: npx tsx ... 무신사키즈
  const channels = target
    ? CHANNELS.filter(c => c.name.includes(target))
    : CHANNELS

  if (channels.length === 0) {
    console.log(`"${target}" 채널을 찾을 수 없습니다.`)
    console.log('가능한 채널:', CHANNELS.map(c => c.name).join(', '))
    process.exit(1)
  }

  for (const ch of channels) {
    await testChannel(ch.name, ch.url)
  }

  console.log('\n모든 테스트 완료!')
})()
