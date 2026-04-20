import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

export const config = {
  port: parseInt(process.env.PORT ?? '3002', 10),
  headless: process.env.HEADLESS !== 'false',

  // 스케줄 (Asia/Seoul) — 하루 4회: 08시, 12시, 16시, 20시
  cron4xDaily: process.env.CRON_4X_DAILY ?? '0 8,12,16,20 * * *',

  dataDir:    path.resolve(__dirname, '../../data'),
  errorsDir:  path.resolve(__dirname, '../../data/errors'),
  historyDir: path.resolve(__dirname, '../../data/history'),
}
