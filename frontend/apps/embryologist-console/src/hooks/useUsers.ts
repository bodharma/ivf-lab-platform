import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { UserResponse } from '../types'

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<UserResponse[]>('/users'),
  })
}

export interface CreateUserPayload {
  email: string
  password: string
  full_name: string
  role: string
}

export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateUserPayload) => api.post<UserResponse>('/users', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

export interface UpdateUserPayload {
  role?: string
  is_active?: boolean
  full_name?: string
}

export function useUpdateUser(userId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateUserPayload) => api.patch<UserResponse>(`/users/${userId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}
