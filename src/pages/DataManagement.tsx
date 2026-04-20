import { useEffect, useState, useRef } from 'react'
import { Upload, FileSpreadsheet, Trash2, Loader2, CheckCircle2 } from 'lucide-react'
import { API_BASE } from '../config'
import type { UploadedFile, UploadFileType } from '../types'

interface SectionProps {
  title: string
  description: string
  fileType: UploadFileType
  accept?: string
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function UploadSection({ title, description, fileType, accept = '.xlsx,.xls,.csv' }: SectionProps) {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function fetchFiles() {
    try {
      const res = await fetch(`${API_BASE}/api/upload/files?fileType=${fileType}`)
      if (res.ok) {
        const data: UploadedFile[] = await res.json()
        setFiles(data.slice().reverse()) // 최신 순
      }
    } catch {
      // 무시
    }
  }

  useEffect(() => {
    fetchFiles()
  }, [fileType])

  async function uploadFile(file: File) {
    setIsUploading(true)
    setError(null)
    setUploadSuccess(false)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('fileType', fileType)
      const res = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '업로드 실패' }))
        throw new Error(err.error ?? '업로드에 실패했습니다.')
      }
      setUploadSuccess(true)
      setTimeout(() => setUploadSuccess(false), 3000)
      await fetchFiles()
    } catch (e) {
      setError(String(e).replace('Error: ', ''))
    } finally {
      setIsUploading(false)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
    if (inputRef.current) inputRef.current.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) uploadFile(file)
  }

  async function handleDelete(id: string) {
    if (!confirm('이 파일을 삭제하시겠습니까?')) return
    try {
      const res = await fetch(`${API_BASE}/api/upload/files/${id}`, { method: 'DELETE' })
      if (res.ok) await fetchFiles()
    } catch {
      // 무시
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      {/* 섹션 헤더 */}
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <FileSpreadsheet size={16} className="text-brand-500" />
          <h2 className="font-semibold text-gray-900 text-sm">{title}</h2>
        </div>
        <p className="text-xs text-gray-500 mt-1">{description}</p>
      </div>

      {/* 드롭존 */}
      <div className="px-5 py-4">
        <div
          className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
            isDragging
              ? 'border-brand-400 bg-brand-50'
              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
          }`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={handleFileChange}
          />
          {isUploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 size={24} className="animate-spin text-brand-400" />
              <span className="text-sm text-gray-500">업로드 중...</span>
            </div>
          ) : uploadSuccess ? (
            <div className="flex flex-col items-center gap-2">
              <CheckCircle2 size={24} className="text-green-500" />
              <span className="text-sm text-green-600 font-medium">업로드 완료!</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload size={24} className="text-gray-300" />
              <div>
                <p className="text-sm text-gray-600">
                  파일을 드래그하거나 <span className="text-brand-500 font-medium">클릭하여 선택</span>
                </p>
                <p className="text-xs text-gray-400 mt-0.5">xlsx, xls, csv (최대 20MB)</p>
              </div>
            </div>
          )}
        </div>

        {/* 에러 */}
        {error && (
          <p className="mt-2 text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
        )}

        {/* 파일 목록 */}
        {files.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-medium text-gray-500">업로드된 파일 ({files.length})</p>
            {files.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileSpreadsheet size={14} className="text-green-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800 truncate">{f.originalName}</p>
                    <p className="text-xs text-gray-400">
                      {formatSize(f.size)} · {formatDate(f.uploadedAt)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(f.id)}
                  className="p-1.5 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0 ml-2"
                  title="삭제"
                >
                  <Trash2 size={13} className="text-red-400" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function DataManagement() {
  return (
    <div className="space-y-5">
      {/* 페이지 타이틀 */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">데이터 관리</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          판매 데이터 및 상품 마스터 파일을 업로드하여 관리합니다
        </p>
      </div>

      {/* 섹션 */}
      <UploadSection
        title="이지어드민 상품마스터"
        description="이지어드민에서 내보낸 상품마스터 xlsx/csv 파일을 업로드하세요."
        fileType="easyAdmin"
      />
    </div>
  )
}
