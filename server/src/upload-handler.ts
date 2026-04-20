import fs from 'fs'
import path from 'path'
import multer from 'multer'
import { config } from './config'
import type { UploadedFile, UploadFileType } from './types'

const UPLOADS_DIR = path.join(config.dataDir, 'uploads')
const UPLOADS_META_FILE = path.join(config.dataDir, 'uploads-meta.json')

function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true })
  }
}

// ─── multer 설정 ──────────────────────────────────────────────────

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureUploadsDir()
    cb(null, UPLOADS_DIR)
  },
  filename: (_req, file, cb) => {
    const ts = Date.now()
    const ext = path.extname(file.originalname)
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9가-힣_-]/g, '_')
    cb(null, `${ts}_${base}${ext}`)
  },
})

export const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const allowed = ['.xlsx', '.xls', '.csv']
    const ext = path.extname(file.originalname).toLowerCase()
    if (allowed.includes(ext)) {
      cb(null, true)
    } else {
      cb(new Error(`허용되지 않는 파일 형식입니다. (허용: ${allowed.join(', ')})`))
    }
  },
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
})

// ─── 메타데이터 CRUD ──────────────────────────────────────────────

export function loadUploadsMeta(): UploadedFile[] {
  try {
    if (!fs.existsSync(UPLOADS_META_FILE)) return []
    return JSON.parse(fs.readFileSync(UPLOADS_META_FILE, 'utf8')) as UploadedFile[]
  } catch {
    return []
  }
}

export function saveUploadsMeta(files: UploadedFile[]): void {
  fs.writeFileSync(UPLOADS_META_FILE, JSON.stringify(files, null, 2), 'utf8')
}

export function addUploadMeta(
  originalName: string,
  storedName: string,
  fileType: UploadFileType,
  size: number
): UploadedFile {
  const files = loadUploadsMeta()
  const entry: UploadedFile = {
    id: `uf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    originalName,
    storedName,
    fileType,
    uploadedAt: new Date().toISOString(),
    size,
  }
  files.push(entry)
  // 파일 타입별 최근 10개만 유지
  const byType = files.filter((f) => f.fileType === fileType)
  if (byType.length > 10) {
    const toRemove = byType.slice(0, byType.length - 10)
    for (const f of toRemove) {
      const fullPath = path.join(UPLOADS_DIR, f.storedName)
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath)
    }
    const removeIds = new Set(toRemove.map((f) => f.id))
    const filtered = files.filter((f) => !removeIds.has(f.id))
    filtered.push(entry)
    saveUploadsMeta(filtered)
    return entry
  }
  saveUploadsMeta(files)
  return entry
}

export function deleteUploadMeta(id: string): boolean {
  const files = loadUploadsMeta()
  const target = files.find((f) => f.id === id)
  if (!target) return false

  // 실제 파일 삭제
  const fullPath = path.join(UPLOADS_DIR, target.storedName)
  if (fs.existsSync(fullPath)) {
    try { fs.unlinkSync(fullPath) } catch { /* ignore */ }
  }

  const filtered = files.filter((f) => f.id !== id)
  saveUploadsMeta(filtered)
  return true
}

export function getUploadFilePath(storedName: string): string {
  return path.join(UPLOADS_DIR, storedName)
}
