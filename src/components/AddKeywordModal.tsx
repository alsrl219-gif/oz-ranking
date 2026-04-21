import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import { ChannelLogo } from './ChannelLogo'
import { KEYWORD_CATEGORIES, CHANNEL_META } from '../types'
import type { KeywordCategory, ChannelId, Keyword } from '../types'

const ALL_CHANNELS: ChannelId[] = ['coupang', 'smartstore', 'musinsa', 'boribori', 'lotteon', 'kakao']

interface Props {
  onClose: () => void
  onSubmit: (data: { keyword: string; category: KeywordCategory; channels: ChannelId[] }) => Promise<void>
  editTarget?: Keyword | null
}

export function AddKeywordModal({ onClose, onSubmit, editTarget }: Props) {
  const [keyword,      setKeyword]      = useState(editTarget?.keyword ?? '')
  const [category,     setCategory]     = useState<KeywordCategory>(editTarget?.category ?? '기타')
  const [channels,     setChannels]     = useState<ChannelId[]>(editTarget?.channels ?? [...ALL_CHANNELS])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  function toggle(ch: ChannelId) {
    setChannels(prev => prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!keyword.trim())      { setError('키워드를 입력하세요.'); return }
    if (channels.length === 0) { setError('채널을 하나 이상 선택하세요.'); return }

    setIsSubmitting(true); setError(null)
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        style={{ border: '1px solid #EAECF0' }}>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #F0F2F5' }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #FF5043 0%, #FF7A6D 100%)' }}>
              <Plus size={14} className="text-white" />
            </div>
            <h2 className="text-[15px] font-bold text-gray-900">
              {editTarget ? '키워드 수정' : '키워드 추가'}
            </h2>
          </div>
          <button onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">

          {/* 키워드 입력 */}
          <div>
            <label className="block text-[12px] font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              키워드 <span className="text-red-400 normal-case">*</span>
            </label>
            <input
              type="text"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="예: 키즈 바람막이"
              className="w-full px-4 py-2.5 text-[14px] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all"
              style={{ border: '1px solid #EAECF0', background: '#FAFAFA' }}
              autoFocus
            />
          </div>

          {/* 분류 */}
          <div>
            <label className="block text-[12px] font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              분류 <span className="text-red-400 normal-case">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {KEYWORD_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className="px-3 py-1.5 rounded-xl text-[12px] font-semibold transition-all"
                  style={
                    category === cat
                      ? { background: '#FF5043', color: '#fff', border: '1px solid #FF5043' }
                      : { background: '#FAFAFA', color: '#6B7280', border: '1px solid #EAECF0' }
                  }
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* 채널 선택 */}
          <div>
            <label className="block text-[12px] font-semibold text-gray-600 mb-2 uppercase tracking-wide">
              채널 <span className="text-red-400 normal-case">*</span>
              <span className="text-gray-400 font-normal normal-case ml-1.5">({channels.length}/{ALL_CHANNELS.length})</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ALL_CHANNELS.map(ch => {
                const checked = channels.includes(ch)
                return (
                  <label
                    key={ch}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all"
                    style={
                      checked
                        ? { border: `1.5px solid ${CHANNEL_META[ch].color}`, background: CHANNEL_META[ch].color + '0D' }
                        : { border: '1.5px solid #EAECF0', background: '#FAFAFA' }
                    }
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(ch)}
                      className="sr-only"
                    />
                    <div
                      className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-all"
                      style={
                        checked
                          ? { background: CHANNEL_META[ch].color, border: `1.5px solid ${CHANNEL_META[ch].color}` }
                          : { background: 'white', border: '1.5px solid #D1D5DB' }
                      }
                    >
                      {checked && (
                        <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                          <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <ChannelLogo channelId={ch} size="sm" />
                  </label>
                )
              })}
            </div>
          </div>

          {/* 에러 */}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-50"
              style={{ border: '1px solid #FEE2E2' }}>
              <span className="text-red-400 text-xs">⚠</span>
              <p className="text-[12px] text-red-600 font-medium">{error}</p>
            </div>
          )}

          {/* 버튼 */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-gray-600 transition-all hover:bg-gray-50"
              style={{ border: '1px solid #EAECF0' }}
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all disabled:opacity-60"
              style={{ background: isSubmitting ? '#fca5a5' : 'linear-gradient(135deg, #FF5043 0%, #FF7A6D 100%)' }}
            >
              {isSubmitting ? '저장 중...' : editTarget ? '수정하기' : '추가하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
