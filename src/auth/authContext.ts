import { createContext, useContext } from 'react'

export type AuthPhase = 'loading' | 'signedOut' | 'checking' | 'authorized' | 'denied' | 'unavailable' | 'configuration'
export interface AuthState { phase: AuthPhase; operator: string | null; email: string | null; message: string | null }
export interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  retry: () => void
}
export const AuthContext = createContext<AuthContextValue | null>(null)
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('Panoptes authentication provider is missing.')
  return context
}
