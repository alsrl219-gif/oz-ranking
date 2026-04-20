import { useState } from 'react'
import { X } from 'lucide-react'
import { KEYWORD_CATEGORIES, CHANNEL_META } from '../types'
import type { KeywordCategory, ChannelId, Keyword } from '../types'

const ALL_CHANNELS: ChannelId[] = ['coupang', 'smartstore', 'musinsa', 'boribori', 'lotteon', 'kakao']

interface AddKeywordModalProps {
  onClose: () => void
  onSubmit: (data: { keyword: string; category: KeywordCategory; channels: ChannelId[] }) => Promise<void>
  editTarget?: Keyword | null
}

export function AddKeywordModal({ onClose, onSubmit, editTarget }: AddKeywordModalProps) {
  const [keyword, setKeyword] = useState(editTarget?.keyword ?? '')
  const [category, setCategory] = useState<KeywordCategory>(editTarget?.category ?? '기타')
  const [channels, setChannels] = useState<ChannelId[]>(editTarget?.channels ?? [...ALL_CHANNELS])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleChannel(ch: ChannelId) {
    setChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!keyword.trim()) { setError('키워드를 입력하세요.'); return }
    if (channels.length === 0) { setError('채널을 하나 이상 선택하세요.'); return }

    setIsSubmitting(true)
    setError(null)
    try {
      await onSubmit({ keyword: keyword.trim(), category, channels })
      onClose()
    } catch (err) {
      setError(String(err).replace('Error: ', ''))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">
            {editTarget ? '키워드 수정' : '키워드 추가'}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="px-5 py-5 space-y-4">
          {/* 키워드 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              키워드 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="예: 키즈 바람막이"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
            />
          </div>

          {/* 분류 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              분류 <span className="text-red-500">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as KeywordCategory)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              {KEYWORD_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* 채널 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              채널 <span className="text-red-500">*</span>
              <span className="text-xs text-gray-400 font-normal ml-1">
                ({channels.length}/{ALL_CHANNELS.length} 선택)
              </span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ALL_CHANNELS.map((ch) => {
                const meta = CHANNEL_META[ch]
                const checked = channels.includes(ch)
                return (
                  <label
                    key={ch}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                      checked
                        ? 'border-brand-400 bg-brand-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleChannel(ch)}
                      className="w-3.5 h-3.5 accent-brand-500"
                    />
                    <span className="text-sm text-gray-700">{meta.label}</span>
                  </label>
                )
              })}
            </div>
          </div>

          {/* 에러 */}
          {error && (
            <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          {/* 버튼 */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 disabled:opacity-60 transition-colors"
            >
              {isSubmitting ? '저장 중...' : editTarget ? '수정' : '추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
