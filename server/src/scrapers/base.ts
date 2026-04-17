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
