import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import type { CycleDetail, ChecklistInstance } from '../types'

export function useCycleDetail(cycleId: string) {
  return useQuery({
    queryKey: ['cycles', cycleId],
    queryFn: () => api.get<CycleDetail>(`/cycles/${cycleId}`),
    enabled: !!cycleId,
  })
}

export function useCycleChecklists(cycleId: string) {
  return useQuery({
    queryKey: ['cycles', cycleId, 'checklists'],
    queryFn: () => api.get<ChecklistInstance[]>(`/cycles/${cycleId}/checklists`),
    enabled: !!cycleId,
  })
}
