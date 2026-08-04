import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const serviceSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Check if already linked
  let clientId: string | null = null
  let clientName: string | null = null
  let companyName: string | null = null

  const { data: existing } = await serviceSupabase
    .from('clients')
    .select('id, name, company_name')
    .eq('auth_user_id', user.id)
    .single()

  if (existing) {
    clientId = existing.id
    clientName = existing.name
    companyName = existing.company_name
  } else {
    // Try to auto-link by matching email
    const { data: matchByEmail } = await serviceSupabase
      .from('clients')
      .select('id, name, company_name, auth_user_id')
      .ilike('email', user.email)
      .limit(1)
      .single()

    if (matchByEmail && !matchByEmail.auth_user_id) {
      const { error } = await serviceSupabase
        .from('clients')
        .update({ auth_user_id: user.id })
        .eq('id', matchByEmail.id)

      if (error) {
        return NextResponse.json({ error: 'Failed to link account' }, { status: 500 })
      }

      clientId = matchByEmail.id
      clientName = matchByEmail.name
      companyName = matchByEmail.company_name
    }
  }

  if (!clientId) {
    console.log('[portal] No client found for email:', user.email)
    return NextResponse.json({ client: null })
  }

  console.log('[portal] Client found:', clientId, clientName)

  // Fetch actions and sessions using service role (bypasses RLS timing issues)
  const { data: actionsData } = await serviceSupabase
    .from('client_actions')
    .select('id, title, description, description_content, status, due_date, created_at')
    .eq('client_id', clientId)
    .eq('status', 'to_do')
    .order('created_at', { ascending: false })

  // Fetch sessions: try calendar events first, fall back to session_notes directly
  const { data: eventsData } = await serviceSupabase
    .from('calendar_events')
    .select('id, start_time, title')
    .eq('client_id', clientId)
    .or('status.is.null,status.neq.cancelled')
    .lte('start_time', new Date().toISOString())
    .order('start_time', { ascending: false })

  let sessions: any[] = []

  if (eventsData && eventsData.length > 0) {
    const eventIds = eventsData.map(e => e.id)
    const { data: notesData } = await serviceSupabase
      .from('session_notes')
      .select('id, calendar_event_id, content, connection_notes')
      .in('calendar_event_id', eventIds)

    const notesMap = new Map<string, any>()
    for (const note of (notesData || [])) {
      if (note.calendar_event_id && note.content) {
        notesMap.set(note.calendar_event_id, note)
      }
    }

    sessions = eventsData
      .filter(e => notesMap.has(e.id))
      .map(e => {
        const note = notesMap.get(e.id)
        return {
          id: e.id,
          calendar_event_id: e.id,
          start_time: e.start_time,
          title: e.title,
          content: typeof note.content === 'string' ? JSON.parse(note.content) : note.content,
          connection_notes: note.connection_notes,
        }
      })
  }

  // Fallback: fetch session_notes directly by client_id (for sessions without calendar events)
  if (sessions.length === 0) {
    const { data: directNotes, error: notesError } = await serviceSupabase
      .from('session_notes')
      .select('id, client_id, session_date, content, connection_notes, created_at')
      .eq('client_id', clientId)
      .order('session_date', { ascending: false, nullsFirst: false })

    console.log('[portal] Direct notes query for client', clientId, '- found:', directNotes?.length || 0, 'error:', notesError?.message || 'none')

    if (directNotes && directNotes.length > 0) {
      sessions = directNotes
        .filter(note => note.content)
        .map(note => ({
          id: note.id,
          calendar_event_id: null,
          start_time: note.session_date || note.created_at,
          title: null,
          content: typeof note.content === 'string' ? JSON.parse(note.content) : note.content,
          connection_notes: note.connection_notes,
        }))

      // If no notes have content, still show the sessions (without expandable notes)
      if (sessions.length === 0) {
        sessions = directNotes.map(note => ({
          id: note.id,
          calendar_event_id: null,
          start_time: note.session_date || note.created_at,
          title: null,
          content: null,
          connection_notes: note.connection_notes,
        }))
      }
    }
  }

  return NextResponse.json({
    client: { id: clientId, name: clientName, company_name: companyName },
    actions: actionsData || [],
    sessions,
  })
}
