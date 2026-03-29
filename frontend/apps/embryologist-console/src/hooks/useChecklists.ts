import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { ChecklistInstance, ChecklistTemplate } from '../types'

export function useChecklist(checklistId: string) {
  return useQuery({
    queryKey: ['checklists', checklistId],
    queryFn: () => api.get<ChecklistInstance>(`/checklists/${checklistId}`),
    enabled: !!checklistId,
  })
}

export function useChecklistTemplates() {
  return useQuery({
    queryKey: ['checklist-templates'],
    queryFn: () => api.get<ChecklistTemplate[]>('/checklist-templates'),
  })
}

export function useCompleteItem(checklistId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (itemIndex: number) =>
      api.post(`/checklists/${checklistId}/items/${itemIndex}`, { value: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklists', checklistId] })
    },
  })
}
