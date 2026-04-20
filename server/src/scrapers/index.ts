import { log, closeBrowser } from './base'
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

// 동시 실행 수 제한 (메모리 초과 방지)
async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<T[]> {
  const results: T[] = []
  let idx = 0
  async function worker() {
    while (idx < tasks.length) {
      const i = idx++
      results[i] = await tasks[i]()
    }
  }
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, worker)
  await Promise.all(workers)
  return results
}

export async function runAllScrapers(periods: PeriodKey[]): Promise<void> {
  if (isRunning) {
    log('orchestrator', '이미 실행 중. 스킵.')
    return
  }
  isRunning = true
  log('orchestrator', `스크래핑 시작 (기간: ${periods.join(', ')}) — 최대 2채널 동시`)

  const scrapers: Array<{ name: ChannelId; fn: () => Promise<RankingSnapshot[]> }> = [
    { name: 'musinsa',    fn: () => scrapeMusinsa(periods)    },
    { name: 'boribori',   fn: () => scrapeBoribori(periods)   },
    { name: 'kakao',      fn: () => scrapeKakao(periods)      },
    { name: 'lotteon',    fn: () => scrapeLotteon(periods)    },
    { name: 'coupang',    fn: () => scrapeCoupang(periods)    },
    { name: 'smartstore', fn: () => scrapeSmartstore(periods) },
  ]

  const tasks = scrapers.map(({ name, fn }) => async (): Promise<RankingSnapshot[]> => {
    try {
      return await fn()
    } catch (err) {
      log(name, `실패: ${err}`)
      return periods.map((period): RankingSnapshot => ({
        channelId: name, period,
        scrapedAt: new Date().toISOString(),
        products: [], ozKidsEntries: [],
        error: String(err),
      }))
    }
  })

  // 최대 2개 채널 동시 실행 (512MB 메모리 제한 대응)
  const resultGroups = await runWithConcurrency(tasks, 2)
  const allSnapshots = resultGroups.flat()

  // 히스토리 저장
  for (const snap of allSnapshots) {
    if (snap.ozKidsEntries.length > 0) {
      appendHistory({
        scrapedAt: snap.scrapedAt,
        channelId: snap.channelId,
        period: snap.period,
        ozKidsEntries: snap.ozKidsEntries,
      })
    }
  }

  const summary = computeSummary(allSnapshots)
  saveLatest({ snapshots: allSnapshots, scrapedAt: new Date().toISOString(), summary })

  log('orchestrator', `완료. 스냅샷: ${allSnapshots.length}개, 오즈키즈: ${summary.totalOzKidsAppearances}회`)

  // 브라우저 완전 종료 → 메모리 해제
  await closeBrowser()
  isRunning = false
}

if (require.main === module) {
  runAllScrapers(['realtime', 'daily', 'weekly', 'monthly'])
    .then(() => process.exit(0))
    .catch((e) => { console.error(e); process.exit(1) })
}
