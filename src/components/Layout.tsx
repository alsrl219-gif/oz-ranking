import { NavLink } from 'react-router-dom'
import { BarChart2, Search, FolderOpen, LayoutDashboard } from 'lucide-react'

interface LayoutProps { children: React.ReactNode }

const NAV = [
  {
    section: 'OVERVIEW',
    items: [
      { to: '/', end: true, icon: '🏠', label: '대시보드', iconEl: LayoutDashboard },
    ],
  },
  {
    section: 'ANALYTICS',
    items: [
      { to: '/keywords', end: false, icon: '🏆', label: '키워드 랭킹', iconEl: Search },
      { to: '/history',  end: false, icon: '📈', label: '추이 분석',   iconEl: BarChart2 },
    ],
  },
  {
    section: 'MANAGEMENT',
    items: [
      { to: '/data', end: false, icon: '📂', label: '데이터 관리', iconEl: FolderOpen },
    ],
  },
]

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex min-h-screen" style={{ background: '#F4F6FA' }}>

      {/* ── 사이드바 ─────────────────────────────────────────── */}
      <aside
        className="fixed top-0 left-0 h-full flex flex-col z-30 select-none"
        style={{
          width: 220,
          background: 'linear-gradient(180deg, #1A1D2E 0%, #1E2139 100%)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* 브랜드 */}
        <div className="flex items-center gap-3 px-5 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-[13px] font-black flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #FF5043 0%, #FF8A80 100%)' }}
          >
            OZ
          </div>
          <div className="leading-tight min-w-0">
            <p className="text-white font-extrabold text-[13px] tracking-tight truncate">오즈키즈</p>
            <p className="text-[10px] font-medium tracking-widest truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>
              RANKING MONITOR
            </p>
          </div>
        </div>

        {/* 네비게이션 */}
        <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
          {NAV.map(({ section, items }) => (
            <div key={section}>
              <p
                className="text-[10px] font-bold tracking-widest px-2 mb-2"
                style={{ color: 'rgba(255,255,255,0.3)' }}
              >
                {section}
              </p>
              <div className="space-y-0.5">
                {items.map(({ to, end, icon, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all ${
                        isActive ? 'active-nav' : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`
                    }
                    style={({ isActive }) =>
                      isActive
                        ? { background: 'rgba(255,80,67,0.15)', color: '#FF7A6D' }
                        : {}
                    }
                  >
                    <span className="text-base leading-none">{icon}</span>
                    {label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* 하단 */}
        <div className="px-5 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
            © 2026 OZ Kids Monitor
          </p>
        </div>
      </aside>

      {/* ── 메인 콘텐츠 ────────────────────────────────────────── */}
      <main className="flex-1 min-w-0" style={{ marginLeft: 220 }}>
        {children}
      </main>
    </div>
  )
}
