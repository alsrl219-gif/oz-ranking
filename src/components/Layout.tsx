import { NavLink } from 'react-router-dom'
import { BarChart2, Search, FolderOpen, LayoutDashboard } from 'lucide-react'

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F4F6FA' }}>

      {/* ── 헤더 ─────────────────────────────────────────────── */}
      <header className="bg-white sticky top-0 z-20" style={{ borderBottom: '1px solid #EAECF0' }}>
        <div className="max-w-screen-xl mx-auto px-6 h-14 flex items-center gap-8">

          {/* 로고 */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[11px] font-black"
              style={{ background: 'linear-gradient(135deg, #FF5043 0%, #FF8A80 100%)' }}
            >
              OZ
            </div>
            <div className="leading-tight">
              <p className="text-[14px] font-extrabold text-gray-900 tracking-tight leading-none">
                오즈키즈
              </p>
              <p className="text-[10px] text-gray-400 font-medium tracking-wide leading-none mt-0.5">
                RANKING MONITOR
              </p>
            </div>
          </div>

          {/* 구분선 */}
          <div className="h-5 w-px bg-gray-200 flex-shrink-0" />

          {/* 내비게이션 */}
          <nav className="flex items-center gap-0.5 flex-1">
            {[
              { to: '/',         end: true,  icon: LayoutDashboard, label: '대시보드' },
              { to: '/keywords', end: false, icon: Search,          label: '키워드 랭킹' },
              { to: '/data',     end: false, icon: FolderOpen,      label: '데이터 관리' },
              { to: '/history',  end: false, icon: BarChart2,       label: '추이' },
            ].map(({ to, end, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-semibold transition-all ${
                    isActive
                      ? 'bg-orange-50 text-[#FF5043]'
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                  }`
                }
              >
                <Icon size={14} />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      {/* ── 메인 ─────────────────────────────────────────────── */}
      <main className="max-w-screen-xl mx-auto px-6 py-6">
        {children}
      </main>
    </div>
  )
}
