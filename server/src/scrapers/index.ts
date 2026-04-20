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
export function resetIsRunning() { isRunning = false; log('orchestrator', 'isRunning 강제 초기화') }

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

  try {
    // 최대 2개 채널 동시 실행, 전체 4분 타임아웃
    const TOTAL_TIMEOUT_MS = 4 * 60 * 1000
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('전체 수집 4분 타임아웃')), TOTAL_TIMEOUT_MS)
    )
    const resultGroups = await Promise.race([
      runWithConcurrency(tasks, 2),
      timeoutPromise,
    ]) as Awaited<ReturnType<typeof runWithConcurrency<RankingSnapshot[]>>>
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
  } catch (err) {
    log('orchestrator', `수집 실패: ${err}`)
  } finally {
    // 어떤 상황에서도 브라우저 정리 + isRunning 해제
    await closeBrowser().catch(() => {})
    isRunning = false
    log('orchestrator', 'isRunning 해제, 브라우저 종료')
  }
}

export { closeBrowser }

if (require.main === module) {
  runAllScrapers(['realtime', 'daily', 'weekly', 'monthly'])
    .then(() => process.exit(0))
    .catch((e) => { console.error(e); process.exit(1) })
}
