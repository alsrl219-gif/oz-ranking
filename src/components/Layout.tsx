import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Package, Search, TrendingUp, FolderOpen,
} from 'lucide-react'

interface LayoutProps { children: React.ReactNode }

const NAV_GROUPS = [
  {
    label: 'OVERVIEW',
    items: [
      { to: '/',         end: true,  icon: LayoutDashboard, label: '대시보드' },
    ],
  },
  {
    label: 'ANALYTICS',
    items: [
      { to: '/products', end: false, icon: Package,         label: '상품 랭킹' },
      { to: '/keywords', end: false, icon: Search,          label: '키워드 랭킹' },
      { to: '/history',  end: false, icon: TrendingUp,      label: '추이 분석' },
    ],
  },
  {
    label: 'DATA',
    items: [
      { to: '/data',     end: false, icon: FolderOpen,      label: '데이터 관리' },
    ],
  },
]

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex min-h-screen" style={{ background: '#F8FAFC' }}>

      {/* ── 사이드바 ─────────────────────────────────── */}
      <aside
        className="fixed top-0 left-0 h-full z-30 flex flex-col select-none"
        style={{
          width: 220,
          background: '#FFFFFF',
          borderRight: '1px solid #E2E8F0',
        }}
      >
        {/* 로고 */}
        <div className="flex items-center gap-3 px-5 h-16 flex-shrink-0"
          style={{ borderBottom: '1px solid #F1F5F9' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[11px] font-black flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #FF5043, #FF8A6D)' }}>
            OZ
          </div>
          <div>
            <p className="text-[13px] font-bold tracking-tight leading-none" style={{ color: '#0F172A' }}>오즈키즈</p>
            <p className="text-[9px] font-medium tracking-[0.15em] mt-0.5" style={{ color: '#94A3B8' }}>
              RANK MONITOR
            </p>
          </div>
        </div>

        {/* 네비게이션 */}
        <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
          {NAV_GROUPS.map(({ label, items }) => (
            <div key={label}>
              <p className="text-[10px] font-semibold tracking-widest px-2 mb-1.5"
                style={{ color: '#CBD5E1' }}>
                {label}
              </p>
              <div className="space-y-0.5">
                {items.map(({ to, end, icon: Icon, label: name }) => (
                  <NavLink
                    key={to} to={to} end={end}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${
                        isActive ? '' : 'hover:bg-slate-50'
                      }`
                    }
                    style={({ isActive }) => isActive
                      ? { background: '#FFF4F3', color: '#FF5043' }
                      : { color: '#64748B' }
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon size={15} strokeWidth={isActive ? 2.2 : 1.8} />
                        <span>{name}</span>
                        {isActive && (
                          <div className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ background: '#FF5043' }} />
                        )}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* 하단 */}
        <div className="px-5 py-4 flex-shrink-0"
          style={{ borderTop: '1px solid #F1F5F9' }}>
          <p className="text-[10px]" style={{ color: '#CBD5E1' }}>v1.0 · © 2026 OZ Kids</p>
        </div>
      </aside>

      {/* ── 메인 ─────────────────────────────────────── */}
      <main className="flex-1 min-w-0 flex flex-col" style={{ marginLeft: 220 }}>
        {children}
      </main>

    </div>
  )
}
