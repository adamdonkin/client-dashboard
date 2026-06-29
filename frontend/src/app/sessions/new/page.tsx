'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Loader2 } from 'lucide-react'

export default function NewSessionPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const clientId = searchParams.get('clientId')
  const supabase = createClientComponentClient()

  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!clientId) {
      setError('No client specified')
      return
    }

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth/login')
        return
      }

      const { data: created, error: createErr } = await supabase
        .from('session_notes')
        .insert({
          user_id: session.user.id,
          client_id: clientId,
          session_date: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (createErr) {
        setError(`Failed to create session: ${createErr.message}`)
        return
      }

      router.replace(`/sessions/${created!.id}`)
    }

    init()
  }, [clientId, router, supabase])

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">{error}</p>
          <button onClick={() => router.back()} className="text-primary hover:underline">
            Go back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  )
}
