'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { User } from '@supabase/supabase-js'

type AuthContextType = {
  user: User | null
  loading: boolean
  isClientUser: boolean
  portalClientId: string | null
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isClientUser: false,
  portalClientId: null,
  signOut: async () => {}
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isClientUser, setIsClientUser] = useState(false)
  const [portalClientId, setPortalClientId] = useState<string | null>(null)
  const supabase = createClientComponentClient()

  const checkClientStatus = async (u: User) => {
    try {
      const [clientRes, teamRes, ownerRes] = await Promise.all([
        supabase.from('clients').select('id').eq('auth_user_id', u.id).limit(1).maybeSingle(),
        supabase.from('team_access').select('id').or(`owner_id.eq.${u.id},member_id.eq.${u.id}`).limit(1),
        supabase.from('clients').select('id').eq('user_id', u.id).limit(1),
      ])
      const clientMatch = clientRes.data
      const isCoachOrTeam = (teamRes.data && teamRes.data.length > 0) || (ownerRes.data && ownerRes.data.length > 0)
      if (clientMatch && !isCoachOrTeam) {
        setIsClientUser(true)
        setPortalClientId(clientMatch.id)
      } else {
        setIsClientUser(false)
        setPortalClientId(null)
      }
    } catch {
      setIsClientUser(false)
      setPortalClientId(null)
    }
  }

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const u = session?.user ?? null
      if (u) await checkClientStatus(u)
      setUser(u)
      setLoading(false)
    }

    getSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const u = session?.user ?? null
        if (u) await checkClientStatus(u)
        else { setIsClientUser(false); setPortalClientId(null) }
        setUser(u)
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [supabase.auth])

  const signOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/auth/login'
  }

  return (
    <AuthContext.Provider value={{ user, loading, isClientUser, portalClientId, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
} 