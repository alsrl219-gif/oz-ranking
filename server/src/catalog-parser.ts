/**
 * 전체상품목록 XLS 파싱 (이지어드민 HTML-XLS 형식)
 *
 * 컬럼 순서 (0-based index):
 *  0: 어드민 S코드
 *  1: 대표 O코드
 *  2: 카페24 상품코드
 *  3: 로케이션
 *  4: 이미지URL
 *  5: 공급처
 *  6: 원산지
 *  7: 등록일
 *  8: 시즌
 *  9: 카테고리
 * 10: 상품명
 * 11: 정상재고
 * 12: 원가
 * 13: 판매가
 * 14: 시중가
 * 15: 가용재고
 * 16: 바코드
 * 17: 옵션
 * 18: 이미지
 */

import fs from 'fs'
import path from 'path'
import * as XLSX from 'xlsx'
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

/** XLS 파일을 파싱하여 CatalogProduct[] 반환 */
export function parseCatalogFile(filePath: string): CatalogProduct[] {
  try {
    const buf = fs.readFileSync(filePath)
    const workbook = XLSX.read(buf, { type: 'buffer', raw: false, cellDates: false })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]

    // header: 1 → 각 행을 배열로 반환, defval: '' → 빈 셀은 빈 문자열
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' })

    if (rows.length < 2) return []

    // 첫 행이 헤더인지 확인 (어드민 S코드 or S코드 포함)
    const headerRow = rows[0]
    const hasHeader = String(headerRow[0]).includes('코드') ||
                      String(headerRow[10]).includes('상품명')

    const dataRows = hasHeader ? rows.slice(1) : rows

    // O코드 기준으로 대표 상품 1개만 유지 (옵션 중복 제거)
    const byOCode = new Map<string, CatalogProduct>()
    const noOCode: CatalogProduct[] = []

    for (const row of dataRows) {
      const sCode       = String(row[0]  ?? '').trim()
      const oCode       = String(row[1]  ?? '').trim()
      const imageUrl    = String(row[4]  ?? '').trim()
      const season      = String(row[8]  ?? '').trim()
      const categoryRaw = String(row[9]  ?? '').trim()
      const productName = String(row[10] ?? '').trim()
      const priceRaw    = row[13]
      const price       = typeof priceRaw === 'number'
        ? priceRaw
        : parseInt(String(priceRaw).replace(/[^0-9]/g, ''), 10) || 0

      if (!productName) continue

      // 카테고리에서 " > " 이후 부분만 사용 (예: "의류 > 세트(C)" → "세트")
      const category = categoryRaw.includes('>')
        ? categoryRaw.split('>').pop()!.replace(/\(.*?\)/g, '').trim()
        : categoryRaw.replace(/\(.*?\)/g, '').trim()

      const product: CatalogProduct = {
        sCode,
        oCode,
        productName,
        season,
        category,
        price,
        imageUrl,
      }

      if (oCode) {
        // O코드가 있으면 첫 번째 항목만 유지 (대표 상품)
        if (!byOCode.has(oCode)) {
          byOCode.set(oCode, product)
        } else {
          // 가격이 더 높은 것(대표 판매가)을 유지
          const existing = byOCode.get(oCode)!
          if (price > existing.price) {
            byOCode.set(oCode, { ...existing, price, imageUrl: imageUrl || existing.imageUrl })
          }
        }
      } else {
        noOCode.push(product)
      }
    }

    return [...byOCode.values(), ...noOCode]
  } catch (e) {
    console.error('[catalog-parser] 파싱 오류:', e)
    return []
  }
}
