'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { SessionWorkspace } from '@/components/session/SessionWorkspace'
import { Loader2, AlertTriangle } from 'lucide-react'

const LOCK_STALE_MS = 30_000
const HEARTBEAT_MS = 10_000

interface SessionPageProps {
  params: Promise<{ id: string }>
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
  const tokenRef = useRef<string | null>(null)

  const releaseLock = useCallback(() => {
    const noteId = noteIdRef.current
    const token = tokenRef.current
    if (!noteId || !token) return

    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current)
      heartbeatRef.current = null
    }

    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/session_notes?id=eq.${noteId}&locked_by=eq.${tabIdRef.current}`
    try {
      fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          'Authorization': `Bearer ${token}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ locked_by: null, locked_at: null }),
        keepalive: true,
      })
    } catch {}
    noteIdRef.current = null
  }, [])

  useEffect(() => {
    const init = async () => {
      const { id } = await params

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth/login')
        return
      }
      tokenRef.current = session.access_token

      // Try to find an existing session_notes row by ID first
      let noteRow = await supabase
        .from('session_notes')
        .select('id, client_id, calendar_event_id, session_date, locked_by, locked_at')
        .eq('id', id)
        .single()
        .then(r => r.data)

      // If not found, treat the ID as a calendar_event_id (backward compat)
      let event: CalendarEvent | null = null
      if (!noteRow) {
        const { data: eventData, error: eventErr } = await supabase
          .from('calendar_events')
          .select('id, client_id, start_time, end_time, title')
          .eq('id', id)
          .single()

        if (eventErr || !eventData) {
          setError('Session not found')
          setLoading(false)
          return
        }

        event = eventData

        // Look up or create the session_notes row for this calendar event
        const { data: existingNote } = await supabase
          .from('session_notes')
          .select('id, client_id, calendar_event_id, session_date, locked_by, locked_at')
          .eq('user_id', session.user.id)
          .eq('calendar_event_id', event.id)
          .single()

        if (existingNote) {
          noteRow = existingNote
        } else {
          const { data: created, error: createErr } = await supabase
            .from('session_notes')
            .insert({
              user_id: session.user.id,
              client_id: event.client_id,
              calendar_event_id: event.id,
              session_date: event.start_time,
            })
            .select('id, client_id, calendar_event_id, session_date, locked_by, locked_at')
            .single()

          if (createErr || !created) {
            setError(`Failed to create session: ${createErr?.message || 'Unknown error'}`)
            setLoading(false)
            return
          }
          noteRow = created
        }

        // Redirect to the canonical note-based URL
        router.replace(`/sessions/${noteRow.id}`)
        return
      }

      // If we have a calendar_event_id, fetch the event for display
      if (!event && noteRow.calendar_event_id) {
        const { data: eventData } = await supabase
          .from('calendar_events')
          .select('id, client_id, start_time, end_time, title')
          .eq('id', noteRow.calendar_event_id)
          .single()
        event = eventData
      }

      // Build the calendar event object (real or synthetic for ad hoc)
      const calEvent: CalendarEvent = event || {
        id: noteRow.id,
        client_id: noteRow.client_id,
        start_time: noteRow.session_date || new Date().toISOString(),
        end_time: noteRow.session_date || new Date().toISOString(),
        title: 'Ad-hoc Session',
      }
      setCalendarEvent(calEvent)

      // Fetch client info
      if (noteRow.client_id) {
        const { data: clientData } = await supabase
          .from('clients')
          .select('id, name, company_name, role')
          .eq('id', noteRow.client_id)
          .single()
        if (clientData) setClient(clientData)
      }

      // Handle locking
      if (noteRow.locked_by && noteRow.locked_by !== tabIdRef.current && noteRow.locked_at) {
        const lockAge = Date.now() - new Date(noteRow.locked_at).getTime()
        if (lockAge < LOCK_STALE_MS) {
          setSessionNoteId(noteRow.id)
          setLocked(true)
          setLoading(false)
          return
        }
      }

      noteIdRef.current = noteRow.id

      await supabase
        .from('session_notes')
        .update({ locked_by: tabIdRef.current, locked_at: new Date().toISOString() })
        .eq('id', noteRow.id)

      heartbeatRef.current = setInterval(async () => {
        await supabase
          .from('session_notes')
          .update({ locked_at: new Date().toISOString() })
          .eq('id', noteRow.id)
          .eq('locked_by', tabIdRef.current)
      }, HEARTBEAT_MS)

      setSessionNoteId(noteRow.id)
      setLoading(false)
    }

    init()

    const handleBeforeUnload = () => releaseLock()
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
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
