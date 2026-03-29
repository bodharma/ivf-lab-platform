import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import type { CycleDetail } from '../types'

interface TodayResponse {
  date: string
  cycles: CycleDetail[]
}

export function useTodayCycles() {
  return useQuery({
    queryKey: ['cycles', 'today'],
    queryFn: () => api.get<TodayResponse>('/cycles/today'),
    refetchInterval: 30_000,
  })
}
