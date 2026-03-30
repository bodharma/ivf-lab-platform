import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { Cycle, CycleDetail } from '../types'

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

export interface CreateCyclePayload {
  patient_alias_id: string
  cycle_code: string
  cycle_type: string
  start_date: string
}

export function useCreateCycle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateCyclePayload) => api.post<Cycle>('/cycles', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cycles'] })
    },
  })
}

export function useCreateEmbryo(cycleId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { embryo_code: string; source: string }) =>
      api.post(`/cycles/${cycleId}/embryos`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cycles', cycleId] })
    },
  })
}
