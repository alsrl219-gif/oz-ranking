import { NavLink } from 'react-router-dom'
import { BarChart2, RefreshCw, Loader2, Search, FolderOpen, LayoutDashboard, Clock } from 'lucide-react'
import { useRankingStore } from '../store/useRankingStore'

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  const { isScraping, triggerScrape, status } = useRankingStore()

  const ageText = status?.ageMinutes !== null && status?.ageMinutes !== undefined
    ? status.ageMinutes < 1 ? '방금 전'
      : status.ageMinutes < 60 ? `${status.ageMinutes}분 전`
      : `${Math.floor(status.ageMinutes / 60)}시간 전`
    : null

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#EEF2F8' }}>
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20">
        <div className="max-w-screen-xl mx-auto px-6 h-14 flex items-center gap-6">
          {/* 로고 */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-black" style={{ background: 'linear-gradient(135deg, #FF5043 0%, #FF7A6D 100%)' }}>
              OZ
            </div>
            <span className="font-bold text-gray-900 text-[15px] tracking-tight">
              오즈키즈 <span className="text-gray-400 font-normal">랭킹</span>
            </span>
          </div>

          {/* 네비게이션 */}
          <nav className="flex items-center gap-1 flex-1">
            {[
              { to: '/', end: true, icon: LayoutDashboard, label: '대시보드' },
              { to: '/keywords', end: false, icon: Search, label: '키워드 랭킹' },
              { to: '/data', end: false, icon: FolderOpen, label: '데이터 관리' },
              { to: '/history', end: false, icon: BarChart2, label: '추이' },
            ].map(({ to, end, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-brand-50 text-brand-600'
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                  }`
                }
              >
                <Icon size={14} />
                {label}
              </NavLink>
            ))}
          </nav>

          {/* 우측 */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {ageText && (
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <Clock size={12} />
                {ageText} 수집
              </div>
            )}
            <button
              onClick={triggerScrape}
              disabled={isScraping}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50"
              style={{ background: isScraping ? '#ff9089' : 'linear-gradient(135deg, #FF5043 0%, #ff6b60 100%)' }}
            >
              {isScraping ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <RefreshCw size={13} />
              )}
              {isScraping ? '수집 중...' : '전체 수집'}
            </button>
          </div>
        </div>
      </header>

      {/* 메인 */}
      <main className="max-w-screen-xl mx-auto px-6 py-7">
        {children}
      </main>
    </div>
  )
}
