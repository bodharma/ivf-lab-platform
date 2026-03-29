import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { createElement } from 'react'
import { api } from '../api/client'
import type { TokenResponse, User } from '../types'

interface AuthContextType {
  isAuthenticated: boolean
  user: User | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('access_token'))
  const [user, setUser] = useState<User | null>(null)

  if (token) api.setToken(token)

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<TokenResponse>('/auth/login', { email, password })
    localStorage.setItem('access_token', res.access_token)
    localStorage.setItem('refresh_token', res.refresh_token)
    api.setToken(res.access_token)
    setToken(res.access_token)
    const me = await api.get<User>('/auth/me')
    setUser(me)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    api.setToken(null)
    setToken(null)
    setUser(null)
  }, [])

  return createElement(
    AuthContext.Provider,
    { value: { isAuthenticated: !!token, user, login, logout } },
    children,
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
