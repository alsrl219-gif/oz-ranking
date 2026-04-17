interface StatusIndicatorProps {
  isRunning: boolean
  hasError: boolean
}

export function StatusIndicator({ isRunning, hasError }: StatusIndicatorProps) {
  if (isRunning) {
    return (
      <span className="flex items-center gap-1 text-xs text-blue-500">
        <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
        수집 중
      </span>
    )
  }
  if (hasError) {
    return (
      <span className="flex items-center gap-1 text-xs text-red-400">
        <span className="w-2 h-2 rounded-full bg-red-400" />
        오류
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 text-xs text-emerald-500">
      <span className="w-2 h-2 rounded-full bg-emerald-400" />
      정상
    </span>
  )
}
