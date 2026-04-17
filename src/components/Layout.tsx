import { NavLink } from 'react-router-dom'
import { BarChart2, LayoutDashboard, RefreshCw, Loader2 } from 'lucide-react'
import { useRankingStore } from '../store/useRankingStore'

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  const { isScraping, triggerScrape, status } = useRankingStore()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          {/* 로고 */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-brand-500 rounded-lg flex items-center justify-center">
              <BarChart2 size={16} className="text-white" />
            </div>
            <span className="font-bold text-gray-900 text-sm">오즈키즈 랭킹</span>
          </div>

          {/* 네비게이션 */}
          <nav className="flex items-center gap-1">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-800'
                }`
              }
            >
              <LayoutDashboard size={15} />
              대시보드
            </NavLink>
            <NavLink
              to="/history"
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-800'
                }`
              }
            >
              <BarChart2 size={15} />
              추이
            </NavLink>
          </nav>

          {/* 수집 버튼 */}
          <div className="flex items-center gap-3">
            {status?.ageMinutes !== null && status?.ageMinutes !== undefined && (
              <span className="text-xs text-gray-400 hidden sm:block">
                {status.ageMinutes < 60
                  ? `${status.ageMinutes}분 전`
                  : `${Math.floor(status.ageMinutes / 60)}시간 전`} 수집
              </span>
            )}
            <button
              onClick={triggerScrape}
              disabled={isScraping}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 disabled:opacity-60 transition-colors"
            >
              {isScraping ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              {isScraping ? '수집 중' : '수동 수집'}
            </button>
          </div>
        </div>
      </header>

      {/* 메인 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {children}
      </main>
    </div>
  )
}
