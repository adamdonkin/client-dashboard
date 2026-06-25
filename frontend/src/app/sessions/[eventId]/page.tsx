'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { SessionWorkspace } from '@/components/session/SessionWorkspace'
import { Loader2 } from 'lucide-react'

interface SessionPageProps {
  params: Promise<{ eventId: string }>
}

interface CalendarEvent {
  id: string
  client_id: string
  start_time: string
  end_time: string
  title: string
}

interface ClientInfo {
  id: string
  name: string
  company_name: string | null
  role: string | null
}

export default function SessionPage({ params }: SessionPageProps) {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [calendarEvent, setCalendarEvent] = useState<CalendarEvent | null>(null)
  const [client, setClient] = useState<ClientInfo | null>(null)
  const [sessionNoteId, setSessionNoteId] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      const { eventId } = await params

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth/login')
        return
      }

      // Fetch calendar event
      const { data: event, error: eventErr } = await supabase
        .from('calendar_events')
        .select('id, client_id, start_time, end_time, title')
        .eq('id', eventId)
        .single()

      if (eventErr || !event) {
        console.error('Event fetch error:', eventErr)
        setError(`Session not found: ${eventErr?.message || 'No event data'}`)
        setLoading(false)
        return
      }

      setCalendarEvent(event)

      // Fetch client info
      if (event.client_id) {
        const { data: clientData } = await supabase
          .from('clients')
          .select('id, name, company_name, role')
          .eq('id', event.client_id)
          .single()

        if (clientData) setClient(clientData)
      }

      // Auto-provision session_notes
      const { data: existing } = await supabase
        .from('session_notes')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('calendar_event_id', event.id)
        .single()

      if (existing) {
        setSessionNoteId(existing.id)
      } else {
        const { data: created, error: createErr } = await supabase
          .from('session_notes')
          .insert({
            user_id: session.user.id,
            client_id: event.client_id,
            calendar_event_id: event.id,
            session_date: event.start_time,
          })
          .select('id')
          .single()

        if (createErr) {
          console.error('Failed to create session_notes:', createErr)
          setError(`Failed to create session workspace: ${createErr.message}`)
          setLoading(false)
          return
        }
        setSessionNoteId(created!.id)
      }

      setLoading(false)
    }

    init()
  }, [params, router, supabase])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !calendarEvent || !sessionNoteId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">{error || 'Something went wrong'}</p>
          <button onClick={() => router.back()} className="text-primary hover:underline">
            Go back
          </button>
        </div>
      </div>
    )
  }

  return (
    <SessionWorkspace
      calendarEvent={calendarEvent}
      client={client}
      sessionNoteId={sessionNoteId}
      onBack={() => router.back()}
    />
  )
}
