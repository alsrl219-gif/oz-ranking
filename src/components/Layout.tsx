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
    <div className="flex min-h-screen" style={{ background: '#F1F5F9' }}>

      {/* ── 사이드바 ─────────────────────────────────── */}
      <aside
        className="fixed top-0 left-0 h-full z-30 flex flex-col select-none"
        style={{
          width: 220,
          background: '#0F172A',
          borderRight: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        {/* 로고 */}
        <div className="flex items-center gap-3 px-5 h-16 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[11px] font-black flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #FF5043, #FF8A6D)' }}>
            OZ
          </div>
          <div>
            <p className="text-white text-[13px] font-bold tracking-tight leading-none">오즈키즈</p>
            <p className="text-[9px] font-medium tracking-[0.15em] mt-0.5" style={{ color: '#475569' }}>
              RANK MONITOR
            </p>
          </div>
        </div>

        {/* 네비게이션 */}
        <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
          {NAV_GROUPS.map(({ label, items }) => (
            <div key={label}>
              <p className="text-[10px] font-semibold tracking-widest px-2 mb-1.5"
                style={{ color: '#334155' }}>
                {label}
              </p>
              <div className="space-y-0.5">
                {items.map(({ to, end, icon: Icon, label: name }) => (
                  <NavLink
                    key={to} to={to} end={end}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${
                        isActive
                          ? 'text-white'
                          : 'hover:bg-white/5'
                      }`
                    }
                    style={({ isActive }) => isActive
                      ? { background: 'rgba(255,80,67,0.15)', color: '#FF7A6D' }
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
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <p className="text-[10px]" style={{ color: '#1E293B' }}>v1.0 · © 2026 OZ Kids</p>
        </div>
      </aside>

      {/* ── 메인 ─────────────────────────────────────── */}
      <main className="flex-1 min-w-0 flex flex-col" style={{ marginLeft: 220 }}>
        {children}
      </main>

    </div>
  )
}
