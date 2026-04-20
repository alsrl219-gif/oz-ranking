import express from 'express'
import cors from 'cors'
import cron from 'node-cron'
import { config } from './config'
import { loadLatest, loadHistory, getDataAge } from './data-store'
import { runAllScrapers, getIsRunning, resetIsRunning } from './scrapers/index'
import { log } from './scrapers/base'
import {
  loadKeywords,
  addKeyword,
  updateKeyword,
  deleteKeyword,
  appendKeywordRank,
  loadKeywordHistory,
  loadLatestKeywordRanks,
} from './keywords-store'
import { scrapeAllKeywords } from './scrapers/keyword-search'
import { upload, loadUploadsMeta, addUploadMeta, deleteUploadMeta } from './upload-handler'
import type { ChannelId, PeriodKey, KeywordCategory, UploadFileType } from './types'

const app = express()
app.use(cors())
app.use(express.json())

// ─── GET /api/data ─────────────────────────────────────────────────
app.get('/api/data', (_req, res) => {
  const data = loadLatest()
  if (!data) return res.status(404).json({ error: '데이터가 없습니다. 스크래핑을 먼저 실행하세요.' })
  res.json(data)
})

// ─── GET /api/status ───────────────────────────────────────────────
app.get('/api/status', (_req, res) => {
  const data = loadLatest()
  const age = getDataAge()

  const channelErrors: Record<ChannelId, string | null> = {
    coupang: null, smartstore: null, musinsa: null,
    boribori: null, lotteon: null, kakao: null,
  }
  if (data) {
    for (const snap of data.snapshots) {
      if (snap.error && snap.period === 'realtime') {
        channelErrors[snap.channelId] = snap.error
      }
    }
  }

  res.json({
    hasData: !!data,
    isRunning: getIsRunning(),
    lastScrapedAt: age?.scrapedAt ?? null,
    ageMinutes: age?.ageMinutes ?? null,
    nextSchedule: config.cron4xDaily,
    channelErrors,
  })
})

// ─── POST /api/reset ───────────────────────────────────────────────
app.post('/api/reset', (_req, res) => {
  resetIsRunning()
  res.json({ message: 'isRunning 초기화 완료' })
})

// ─── POST /api/scrape ──────────────────────────────────────────────
app.post('/api/scrape', (_req, res) => {
  if (getIsRunning()) {
    return res.status(409).json({ error: '이미 스크래핑이 진행 중입니다.' })
  }
  res.json({ message: '스크래핑을 시작합니다.' })
  runAllScrapers(['realtime', 'daily', 'weekly', 'monthly']).catch((e) =>
    log('api', `수동 스크래핑 오류: ${e}`)
  )
})

// ─── POST /api/scrape/:channelId ───────────────────────────────────
app.post('/api/scrape/:channelId', (req, res) => {
  const channelId = req.params.channelId as ChannelId
  const validChannels: ChannelId[] = ['coupang', 'smartstore', 'musinsa', 'boribori', 'lotteon', 'kakao']
  if (!validChannels.includes(channelId)) {
    return res.status(400).json({ error: '유효하지 않은 채널입니다.' })
  }
  if (getIsRunning()) {
    return res.status(409).json({ error: '이미 스크래핑이 진행 중입니다.' })
  }
  res.json({ message: `${channelId} 스크래핑을 시작합니다.` })
  // 단일 채널 스크래핑
  import(`./scrapers/${channelId}`)
    .then((mod) => {
      const fnName = `scrape${channelId.charAt(0).toUpperCase() + channelId.slice(1)}`
      return mod[fnName](['realtime', 'daily', 'weekly', 'monthly'])
    })
    .catch((e) => log('api', `단일 채널 스크래핑 오류: ${e}`))
})

// ─── GET /api/history/:channelId ───────────────────────────────────
app.get('/api/history/:channelId', (req, res) => {
  const channelId = req.params.channelId as ChannelId
  const period = req.query.period as PeriodKey | undefined
  const limit = parseInt(req.query.limit as string ?? '60', 10)
  const history = loadHistory(channelId, limit, period)
  res.json(history)
})

// ─── GET  /api/keywords ────────────────────────────────────────────
app.get('/api/keywords', (_req, res) => {
  const keywords = loadKeywords()
  res.json(keywords)
})

// ─── POST /api/keywords ────────────────────────────────────────────
app.post('/api/keywords', (req, res) => {
  const { keyword, category, channels } = req.body as {
    keyword?: string
    category?: KeywordCategory
    channels?: ChannelId[]
  }
  if (!keyword?.trim()) return res.status(400).json({ error: '키워드를 입력하세요.' })
  if (!category) return res.status(400).json({ error: '분류를 선택하세요.' })
  if (!channels || channels.length === 0)
    return res.status(400).json({ error: '채널을 하나 이상 선택하세요.' })

  const newKw = addKeyword({ keyword, category, channels })
  res.status(201).json(newKw)
})

// ─── PUT  /api/keywords/:id ────────────────────────────────────────
app.put('/api/keywords/:id', (req, res) => {
  const { id } = req.params
  const { keyword, category, channels } = req.body as Partial<{
    keyword: string
    category: KeywordCategory
    channels: ChannelId[]
  }>
  const updated = updateKeyword(id, { keyword, category, channels })
  if (!updated) return res.status(404).json({ error: '키워드를 찾을 수 없습니다.' })
  res.json(updated)
})

// ─── DELETE /api/keywords/:id ──────────────────────────────────────
app.delete('/api/keywords/:id', (req, res) => {
  const { id } = req.params
  const ok = deleteKeyword(id)
  if (!ok) return res.status(404).json({ error: '키워드를 찾을 수 없습니다.' })
  res.json({ message: '삭제되었습니다.' })
})

// ─── POST /api/keywords/scrape ─────────────────────────────────────
app.post('/api/keywords/scrape', (_req, res) => {
  const keywords = loadKeywords()
  if (keywords.length === 0) {
    return res.status(400).json({ error: '등록된 키워드가 없습니다.' })
  }
  res.json({ message: `${keywords.length}개 키워드 스크래핑을 시작합니다.` })

  scrapeAllKeywords(keywords)
    .then((entries) => {
      for (const entry of entries) {
        appendKeywordRank(entry)
      }
      log('keywords', `키워드 스크래핑 완료: ${entries.length}개 항목`)
    })
    .catch((e) => log('keywords', `키워드 스크래핑 오류: ${e}`))
})

// ─── GET  /api/keywords/ranks ──────────────────────────────────────
app.get('/api/keywords/ranks', (_req, res) => {
  const ranks = loadLatestKeywordRanks()
  res.json(ranks)
})

// ─── GET  /api/keywords/history/:id ───────────────────────────────
app.get('/api/keywords/history/:id', (req, res) => {
  const { id } = req.params
  const days = parseInt(req.query.days as string ?? '7', 10)
  const history = loadKeywordHistory(id, days)
  res.json(history)
})

// ─── POST /api/upload ──────────────────────────────────────────────
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '파일이 없습니다.' })
  const fileType = (req.body.fileType as UploadFileType) || 'easyAdmin'
  const meta = addUploadMeta(
    req.file.originalname,
    req.file.filename,
    fileType,
    req.file.size
  )
  res.status(201).json(meta)
})

// ─── GET  /api/upload/files ────────────────────────────────────────
app.get('/api/upload/files', (req, res) => {
  const fileType = req.query.fileType as UploadFileType | undefined
  let files = loadUploadsMeta()
  if (fileType) files = files.filter((f) => f.fileType === fileType)
  res.json(files)
})

// ─── DELETE /api/upload/files/:id ─────────────────────────────────
app.delete('/api/upload/files/:id', (req, res) => {
  const ok = deleteUploadMeta(req.params.id)
  if (!ok) return res.status(404).json({ error: '파일을 찾을 수 없습니다.' })
  res.json({ message: '삭제되었습니다.' })
})

// ─── GET /api/debug/:channelId ─────────────────────────────────────
// 네트워크 응답 + __NEXT_DATA__ + DOM 셀렉터 종합 분석
app.get('/api/debug/:channelId', async (req, res) => {
  const { getBrowser, MODERN_UA } = await import('./scrapers/base')
  const urlMap: Record<string, string> = {
    boribori:   'https://m.boribori.co.kr/home/best/product?interval=24&dealYn=N',
    musinsa:    'https://www.musinsa.com/main/kids/ranking?gf=A&storeCode=kids&sectionId=234&categoryCode=106000&ageBand=AGE_BAND_ALL&rankingType=REALTIME',
    kakao:      'https://gift.kakao.com/ranking/category/3',
    lotteon:    'https://www.lotteon.com/p/display/shop/seltDpShop/13979?callType=menu',
    coupang:    'https://www.coupang.com/np/categories/487148',
    smartstore: 'https://shopping.naver.com/best100v2/main.nhn?catId=50000167',
  }
  const url = urlMap[req.params.channelId]
  if (!url) return res.status(400).json({ error: '알 수 없는 채널' })

  const capturedApis: Array<{ url: string; snippet: string }> = []

  try {
    const browser = await getBrowser()
    const context = await browser.newContext({ userAgent: MODERN_UA })
    const page = await context.newPage()

    // 모든 JSON API 응답 캡처
    page.on('response', async (response) => {
      const resUrl = response.url()
      const ct = response.headers()['content-type'] ?? ''
      if (!ct.includes('json')) return
      // 광고/분석 제외
      if (/google|facebook|amplitude|segment|mixpanel|gtm|analytics/i.test(resUrl)) return
      try {
        const text = await response.text()
        if (text.length > 50) {
          capturedApis.push({ url: resUrl, snippet: text.slice(0, 1000) })
        }
      } catch {}
    })

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 })
    await page.waitForTimeout(3000)

    const info = await page.evaluate(() => {
      // __NEXT_DATA__ 추출
      const nextDataEl = document.getElementById('__NEXT_DATA__')
      let nextDataSnippet: string | null = null
      if (nextDataEl?.textContent) {
        nextDataSnippet = nextDataEl.textContent.slice(0, 3000)
      }

      // 페이지 상태 객체 (window.__INITIAL_STATE__ 등)
      const w = window as any
      const stateKeys = Object.keys(w).filter(k =>
        /state|store|data|redux|vuex|props|ranking|product/i.test(k)
      ).slice(0, 10)

      return {
        title: document.title,
        url: location.href,
        nextDataSnippet,
        stateKeys,
        bodySnippet: document.body.innerHTML.slice(0, 3000),
        selectors: {
          'li[class]': document.querySelectorAll('li[class]').length,
          '[class*="product" i]': document.querySelectorAll('[class*="product"]').length,
          '[class*="item" i]': document.querySelectorAll('[class*="item"]').length,
          '[class*="goods" i]': document.querySelectorAll('[class*="goods"]').length,
          '[class*="rank" i]': document.querySelectorAll('[class*="rank"]').length,
          'ul > li': document.querySelectorAll('ul > li').length,
          'a[href]': document.querySelectorAll('a[href]').length,
        },
        // 첫 번째 <ul><li> 구조 샘플
        firstListHtml: document.querySelector('ul')?.innerHTML.slice(0, 500) ?? null,
      }
    })

    await context.close()
    res.json({ ...info, capturedApis: capturedApis.slice(0, 20) })
  } catch (e) {
    res.status(500).json({ error: String(e), capturedApis })
  }
})

// ─── GET /api/channels ─────────────────────────────────────────────
app.get('/api/channels', (_req, res) => {
  res.json([
    { id: 'coupang',    label: '쿠팡',         supportedPeriods: ['realtime','daily','weekly','monthly'] },
    { id: 'smartstore', label: '스마트스토어', supportedPeriods: ['realtime','daily','weekly','monthly'] },
    { id: 'musinsa',    label: '무신사키즈',   supportedPeriods: ['realtime','daily','weekly','monthly'] },
    { id: 'boribori',   label: '보리보리',     supportedPeriods: ['realtime','daily','weekly','monthly'] },
    { id: 'lotteon',    label: '롯데온',       supportedPeriods: ['realtime','daily'] },
    { id: 'kakao',      label: '카카오선물하기', supportedPeriods: ['realtime','weekly'] },
  ])
})

// ─── 스케줄러 — 하루 4회 (08, 12, 16, 20시 KST) ────────────────────
cron.schedule(config.cron4xDaily, () => {
  log('cron', '정기 스케줄 실행 (전체 기간)')
  runAllScrapers(['realtime', 'daily', 'weekly', 'monthly']).catch((e) => log('cron', `오류: ${e}`))
}, { timezone: 'Asia/Seoul' })

// ─── 서버 시작 ────────────────────────────────────────────────────
app.listen(config.port, () => {
  log('server', `서버 시작: http://localhost:${config.port}`)
  log('server', `스케줄: ${config.cron4xDaily} (08, 12, 16, 20시 KST)`)
})
