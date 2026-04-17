import { OZProductRow } from './OZProductRow'
import type { RankingSnapshot } from '../types'

interface RankingTableProps {
  snapshot: RankingSnapshot | null
  showAll?: boolean
}

export function RankingTable({ snapshot, showAll = false }: RankingTableProps) {
  if (!snapshot) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-400">
        <p className="text-sm">데이터 없음</p>
        <p className="text-xs mt-1">스크래핑을 실행해 주세요</p>
      </div>
    )
  }

  if (snapshot.error && snapshot.products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6">
        <p className="text-sm text-gray-400">
          {snapshot.error === '이 채널은 해당 기간을 지원하지 않습니다'
            ? '이 기간은 지원하지 않습니다'
            : '수집 중 오류가 발생했습니다'}
        </p>
      </div>
    )
  }

  const ozEntries = snapshot.ozKidsEntries
  const otherProducts = showAll
    ? snapshot.products.filter((p) => !p.isOzKids).slice(0, 20)
    : []

  if (ozEntries.length === 0 && !showAll) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-400">
        <p className="text-sm">이 기간에 오즈키즈 제품이 없습니다</p>
        <p className="text-xs mt-1">
          전체 {snapshot.products.length}개 상품 수집됨
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {/* 오즈키즈 제품 (하이라이트) */}
      {ozEntries.map((entry) => (
        <OZProductRow key={`${entry.rank}-${entry.productName}`} entry={entry} />
      ))}

      {/* 전체보기 시 나머지 제품 */}
      {showAll && otherProducts.length > 0 && (
        <>
          {ozEntries.length > 0 && (
            <div className="border-t border-gray-100 my-2" />
          )}
          {otherProducts.map((product, i) => (
            <div
              key={`other-${i}`}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium text-gray-500 flex-shrink-0">
                {product.rank}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700 truncate">{product.productName}</p>
                {product.brandName && (
                  <p className="text-xs text-gray-400 truncate">{product.brandName}</p>
                )}
              </div>
              {product.price > 0 && (
                <span className="text-xs text-gray-500 flex-shrink-0">
                  {product.price.toLocaleString()}원
                </span>
              )}
            </div>
          ))}
        </>
      )}

      {ozEntries.length > 0 && (
        <p className="text-xs text-gray-400 text-center pt-1">
          전체 {snapshot.products.length}개 중 {ozEntries.length}개 오즈키즈
        </p>
      )}
    </div>
  )
}
