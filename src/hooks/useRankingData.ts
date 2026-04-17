import { useEffect } from 'react'
import { useRankingStore } from '../store/useRankingStore'

const POLL_INTERVAL = 5 * 60 * 1000 // 5분

export function useRankingData() {
  const { fetchData, fetchStatus } = useRankingStore()

  useEffect(() => {
    fetchData()
    fetchStatus()

    const dataInterval = setInterval(fetchData, POLL_INTERVAL)
    const statusInterval = setInterval(fetchStatus, 30_000) // 30초마다 상태 확인

    return () => {
      clearInterval(dataInterval)
      clearInterval(statusInterval)
    }
  }, [fetchData, fetchStatus])
}
