import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'

interface PatientResponse {
  id: string
  clinic_id: string
  alias_code: string
  partner_alias_id: string | null
  notes: string | null
  created_at: string
}

export function usePatients() {
  return useQuery({
    queryKey: ['patients'],
    queryFn: () => api.get<PatientResponse[]>('/patients'),
  })
}

export function useCreatePatient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (aliasCode: string) =>
      api.post<PatientResponse>('/patients', { alias_code: aliasCode }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] })
    },
  })
}
