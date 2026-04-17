import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

export const config = {
  port: parseInt(process.env.PORT ?? '3002', 10),
  headless: process.env.HEADLESS !== 'false',

  // 스케줄 (Asia/Seoul)
  cronRealtime: process.env.CRON_REALTIME ?? '0 * * * *',      // 매시 정각
  cronDaily:    process.env.CRON_DAILY    ?? '5 0 * * *',       // 매일 00:05
  cronWeekly:   process.env.CRON_WEEKLY   ?? '10 0 * * 1',      // 매주 월요일 00:10
  cronMonthly:  process.env.CRON_MONTHLY  ?? '15 0 1 * *',      // 매월 1일 00:15

  dataDir:    path.resolve(__dirname, '../../data'),
  errorsDir:  path.resolve(__dirname, '../../data/errors'),
  historyDir: path.resolve(__dirname, '../../data/history'),
}
