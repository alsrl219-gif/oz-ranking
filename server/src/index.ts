import express from 'express'
import cors from 'cors'
import cron from 'node-cron'
import { config } from './config'
import { loadLatest, loadHistory, getDataAge } from './data-store'
import { runAllScrapers, getIsRunning } from './scrapers/index'
import { log } from './scrapers/base'
import type { ChannelId, PeriodKey } from './types'

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
    nextSchedule: config.cronRealtime,
    channelErrors,
  })
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

// ─── 스케줄러 ─────────────────────────────────────────────────────
cron.schedule(config.cronRealtime, () => {
  log('cron', '실시간 스케줄 실행')
  runAllScrapers(['realtime']).catch((e) => log('cron', `오류: ${e}`))
}, { timezone: 'Asia/Seoul' })

cron.schedule(config.cronDaily, () => {
  log('cron', '일별 스케줄 실행')
  runAllScrapers(['realtime', 'daily']).catch((e) => log('cron', `오류: ${e}`))
}, { timezone: 'Asia/Seoul' })

cron.schedule(config.cronWeekly, () => {
  log('cron', '주별 스케줄 실행')
  runAllScrapers(['realtime', 'daily', 'weekly']).catch((e) => log('cron', `오류: ${e}`))
}, { timezone: 'Asia/Seoul' })

cron.schedule(config.cronMonthly, () => {
  log('cron', '월별 스케줄 실행')
  runAllScrapers(['realtime', 'daily', 'weekly', 'monthly']).catch((e) => log('cron', `오류: ${e}`))
}, { timezone: 'Asia/Seoul' })

// ─── 서버 시작 ────────────────────────────────────────────────────
app.listen(config.port, () => {
  log('server', `서버 시작: http://localhost:${config.port}`)
  log('server', `스케줄: 실시간=${config.cronRealtime}, 일별=${config.cronDaily}`)
})
