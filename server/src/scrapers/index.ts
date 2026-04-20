import { log } from './base'
import { scrapeMusinsa } from './musinsa'
import { scrapeCoupang } from './coupang'
import { scrapeSmartstore } from './smartstore'
import { scrapeBoribori } from './boribori'
import { scrapeLotteon } from './lotteon'
import { scrapeKakao } from './kakao'
import { saveLatest, appendHistory, computeSummary } from '../data-store'
import type { PeriodKey, RankingSnapshot, ChannelId } from '../types'

let isRunning = false
export function getIsRunning() { return isRunning }

export async function runAllScrapers(periods: PeriodKey[]): Promise<void> {
  if (isRunning) {
    log('orchestrator', '이미 실행 중입니다. 스킵.')
    return
  }
  isRunning = true
  log('orchestrator', `스크래핑 시작 (기간: ${periods.join(', ')}) — 6채널 병렬 실행`)

  const scrapers: Array<{ name: ChannelId; fn: () => Promise<RankingSnapshot[]> }> = [
    { name: 'musinsa',    fn: () => scrapeMusinsa(periods)    },
    { name: 'coupang',    fn: () => scrapeCoupang(periods)    },
    { name: 'smartstore', fn: () => scrapeSmartstore(periods) },
    { name: 'boribori',   fn: () => scrapeBoribori(periods)   },
    { name: 'lotteon',    fn: () => scrapeLotteon(periods)    },
    { name: 'kakao',      fn: () => scrapeKakao(periods)      },
  ]

  // 6개 채널 동시 실행 (병렬)
  const results = await Promise.allSettled(scrapers.map(({ name, fn }) =>
    fn().catch((err) => {
      log(name, `스크래퍼 전체 실패: ${err}`)
      return periods.map((period): RankingSnapshot => ({
        channelId: name,
        period,
        scrapedAt: new Date().toISOString(),
        products: [],
        ozKidsEntries: [],
        error: String(err),
      }))
    })
  ))

  const allSnapshots: RankingSnapshot[] = []
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allSnapshots.push(...result.value)
      for (const snap of result.value) {
        if (snap.ozKidsEntries.length > 0) {
          appendHistory({
            scrapedAt: snap.scrapedAt,
            channelId: snap.channelId,
            period: snap.period,
            ozKidsEntries: snap.ozKidsEntries,
          })
        }
      }
    }
  }

  const summary = computeSummary(allSnapshots)
  saveLatest({
    snapshots: allSnapshots,
    scrapedAt: new Date().toISOString(),
    summary,
  })

  log('orchestrator', `완료. 스냅샷: ${allSnapshots.length}개, 오즈키즈: ${summary.totalOzKidsAppearances}회`)
  isRunning = false
}

// CLI에서 직접 실행 시
if (require.main === module) {
  runAllScrapers(['realtime', 'daily', 'weekly', 'monthly'])
    .then(() => process.exit(0))
    .catch((e) => { console.error(e); process.exit(1) })
}
