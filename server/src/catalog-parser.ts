/**
 * 전체상품목록 파일 파싱
 *
 * 지원 형식:
 *   - .xls  : 이지어드민 HTML-XLS (UTF-8) → 직접 HTML 파싱
 *   - .csv  : EUC-KR 또는 UTF-8 CSV
 *   - .xlsx : SheetJS (xlsx 라이브러리)
 *
 * 컬럼 순서 (0-based):
 *  0: 어드민 S코드  |  1: 대표 O코드  |  4: 이미지URL
 *  8: 시즌          |  9: 카테고리    | 10: 상품명
 * 13: 판매가
 */

import fs from 'fs'
import path from 'path'
import * as XLSX from 'xlsx'
import iconv from 'iconv-lite'
import { config } from './config'
import { loadUploadsMeta } from './upload-handler'

export interface CatalogProduct {
  sCode: string
  oCode: string
  productName: string
  season: string
  category: string
  price: number
  imageUrl: string
}

// ─── 공개 API ───────────────────────────────────────────────────────────────

/** 업로드된 파일 중 가장 최근 easyAdmin 파일을 파싱하여 반환 */
export function loadCatalog(): CatalogProduct[] | null {
  const allFiles = loadUploadsMeta()
  const adminFiles = allFiles
    .filter(f => f.fileType === 'easyAdmin')
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())

  if (adminFiles.length === 0) return null

  const uploadsDir = path.join(config.dataDir, 'uploads')
  const filePath = path.join(uploadsDir, adminFiles[0].storedName)
  if (!fs.existsSync(filePath)) return null

  return parseCatalogFile(filePath)
}

/** 파일 경로를 받아 CatalogProduct[] 반환 (확장자별 자동 처리) */
export function parseCatalogFile(filePath: string): CatalogProduct[] {
  const ext = path.extname(filePath).toLowerCase()
  let rows: string[][]

  try {
    if (ext === '.xls') {
      rows = parseHtmlXls(filePath)
    } else if (ext === '.csv') {
      rows = parseCsv(filePath)
    } else {
      rows = parseXlsx(filePath)
    }
  } catch (e) {
    console.error('[catalog-parser] 파일 파싱 오류:', e)
    return []
  }

  return rowsToCatalog(rows)
}

// ─── 형식별 파서 ────────────────────────────────────────────────────────────

/** HTML-based XLS (이지어드민): UTF-8 텍스트로 읽어 <td> 추출 */
function parseHtmlXls(filePath: string): string[][] {
  const text = fs.readFileSync(filePath, 'utf8')
  return parseHtmlTable(text)
}

/** HTML 문자열에서 <tr><td>...</td></tr> 구조를 파싱 */
function parseHtmlTable(html: string): string[][] {
  const rows: string[][] = []
  const trRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi

  let trMatch: RegExpExecArray | null
  while ((trMatch = trRegex.exec(html)) !== null) {
    const rowHtml = trMatch[1]
    const cells: string[] = []
    const tdRegex = /<td\b[^>]*>([\s\S]*?)<\/td>/gi

    let tdMatch: RegExpExecArray | null
    while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
      const raw = tdMatch[1]
        .replace(/<br\s*\/?>/gi, ' ')   // 줄바꿈 → 공백
        .replace(/<[^>]*>/g, '')         // HTML 태그 제거
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&nbsp;/g, ' ')
        .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(parseInt(n, 10)))
        .trim()
      cells.push(raw)
    }

    if (cells.length > 0) rows.push(cells)
  }

  return rows
}

/** CSV: EUC-KR or UTF-8 자동 감지 */
function parseCsv(filePath: string): string[][] {
  const buf = fs.readFileSync(filePath)

  // UTF-8 BOM 확인 (EF BB BF)
  let text: string
  if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    text = buf.slice(3).toString('utf8')
  } else {
    // EUC-KR 시도
    try {
      text = iconv.decode(buf, 'euc-kr')
      // 한글이 정상적으로 디코딩되면 사용
      if (!/[\uAC00-\uD7A3]/.test(text)) {
        // 한글 없음 → UTF-8로 재시도
        text = buf.toString('utf8')
      }
    } catch {
      text = buf.toString('utf8')
    }
  }

  return parseSimpleCsv(text)
}

/** 간단한 CSV 파서 (따옴표 내부 쉼표/줄바꿈 처리) */
function parseSimpleCsv(text: string): string[][] {
  const rows: string[][] = []
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')

  for (const line of lines) {
    if (!line.trim()) continue
    const cells: string[] = []
    let i = 0
    let cell = ''
    let inQuote = false

    while (i < line.length) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') {
          cell += '"'; i += 2; continue
        }
        inQuote = !inQuote
      } else if (ch === ',' && !inQuote) {
        cells.push(cell.trim())
        cell = ''
      } else {
        cell += ch
      }
      i++
    }
    cells.push(cell.trim())
    rows.push(cells)
  }

  return rows
}

/** XLSX (.xlsx) 파싱 */
function parseXlsx(filePath: string): string[][] {
  const buf = fs.readFileSync(filePath)
  const wb = XLSX.read(buf, { type: 'buffer', raw: false })
  const ws = wb.Sheets[wb.SheetNames[0]]
  return XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' }) as string[][]
}

// ─── 행 → CatalogProduct 변환 ──────────────────────────────────────────────

const HEADER_KEYWORDS = ['코드', 'code', '상품명', 'product', '시즌', 'season']

function rowsToCatalog(rows: string[][]): CatalogProduct[] {
  if (rows.length < 2) return []

  // 첫 행이 헤더인지 확인
  const first = rows[0].join(' ').toLowerCase()
  const hasHeader = HEADER_KEYWORDS.some(k => first.includes(k))
  const dataRows = hasHeader ? rows.slice(1) : rows

  // O코드 기준으로 대표 상품만 유지 (옵션/사이즈 중복 제거)
  const byOCode = new Map<string, CatalogProduct>()
  const noOCode: CatalogProduct[] = []

  for (const row of dataRows) {
    const sCode       = str(row[0])
    const oCode       = str(row[1])
    const imageUrl    = str(row[4])
    const season      = str(row[8])
    const categoryRaw = str(row[9])
    const productName = str(row[10])
    const price       = toPrice(row[13])

    if (!productName) continue

    // 카테고리 정리: "의류 > 세트(C)" → "세트"
    const category = categoryRaw.includes('>')
      ? categoryRaw.split('>').pop()!.replace(/\(.*?\)/g, '').trim()
      : categoryRaw.replace(/\(.*?\)/g, '').trim()

    const product: CatalogProduct = { sCode, oCode, productName, season, category, price, imageUrl }

    if (oCode) {
      if (!byOCode.has(oCode)) {
        byOCode.set(oCode, product)
      } else {
        // 이미지 없으면 교체, 가격은 높은 것 우선
        const ex = byOCode.get(oCode)!
        byOCode.set(oCode, {
          ...ex,
          imageUrl: imageUrl || ex.imageUrl,
          price: price > ex.price ? price : ex.price,
        })
      }
    } else {
      noOCode.push(product)
    }
  }

  return [...byOCode.values(), ...noOCode]
}

function str(v: unknown): string {
  return String(v ?? '').trim()
}

function toPrice(v: unknown): number {
  if (typeof v === 'number') return Math.round(v)
  const n = parseInt(String(v ?? '').replace(/[^0-9]/g, ''), 10)
  return isNaN(n) ? 0 : n
}
