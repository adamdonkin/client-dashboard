'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { SessionWorkspace } from '@/components/session/SessionWorkspace'
import { Loader2, AlertTriangle } from 'lucide-react'

const LOCK_STALE_MS = 45_000
const HEARTBEAT_MS = 15_000

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
  const [locked, setLocked] = useState(false)
  const [calendarEvent, setCalendarEvent] = useState<CalendarEvent | null>(null)
  const [client, setClient] = useState<ClientInfo | null>(null)
  const [sessionNoteId, setSessionNoteId] = useState<string | null>(null)

  const tabIdRef = useRef<string>(`tab-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null)
  const noteIdRef = useRef<string | null>(null)

  const releaseLock = useCallback(async () => {
    const noteId = noteIdRef.current
    if (!noteId) return
    await supabase
      .from('session_notes')
      .update({ locked_by: null, locked_at: null })
      .eq('id', noteId)
      .eq('locked_by', tabIdRef.current)
  }, [supabase])

  useEffect(() => {
    const init = async () => {
      const { eventId } = await params

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth/login')
        return
      }

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

      if (event.client_id) {
        const { data: clientData } = await supabase
          .from('clients')
          .select('id, name, company_name, role')
          .eq('id', event.client_id)
          .single()
        if (clientData) setClient(clientData)
      }

      let noteId: string
      const { data: existing } = await supabase
        .from('session_notes')
        .select('id, locked_by, locked_at')
        .eq('user_id', session.user.id)
        .eq('calendar_event_id', event.id)
        .single()

      if (existing) {
        noteId = existing.id

        if (existing.locked_by && existing.locked_by !== tabIdRef.current && existing.locked_at) {
          const lockAge = Date.now() - new Date(existing.locked_at).getTime()
          if (lockAge < LOCK_STALE_MS) {
            setSessionNoteId(noteId)
            setLocked(true)
            setLoading(false)
            return
          }
        }
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
        noteId = created!.id
      }

      noteIdRef.current = noteId

      await supabase
        .from('session_notes')
        .update({ locked_by: tabIdRef.current, locked_at: new Date().toISOString() })
        .eq('id', noteId)

      heartbeatRef.current = setInterval(async () => {
        await supabase
          .from('session_notes')
          .update({ locked_at: new Date().toISOString() })
          .eq('id', noteId)
          .eq('locked_by', tabIdRef.current)
      }, HEARTBEAT_MS)

      setSessionNoteId(noteId)
      setLoading(false)
    }

    init()

    const handleBeforeUnload = () => {
      releaseLock()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
      releaseLock()
    }
  }, [params, router, supabase, releaseLock])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (locked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md space-y-4">
          <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
          <p className="text-[15px] font-medium text-foreground">This session is open elsewhere</p>
          <p className="text-[13px] text-muted-foreground">
            To prevent data loss, only one window can edit a session at a time. Close the other window or tab first, then reload this page.
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => router.back()} className="text-[13px] text-muted-foreground hover:text-foreground transition-colors">
              Go back
            </button>
            <button onClick={() => window.location.reload()} className="text-[13px] text-primary hover:text-primary/80 font-medium transition-colors">
              Reload
            </button>
          </div>
        </div>
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
