import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export interface ClientAction {
  id: string
  title: string
  description: string | null
  description_content: any | null
  source: 'defacto' | 'granola' | 'session'
  status: 'to_do' | 'completed' | 'cancelled'
  due_date: string | null
  created_date: string | null
  note_title: string | null
  source_url: string | null
  session_note_id: string | null
  client_id: string | null
  client_name: string
  company_name: string
  role: string | null
  synced_at: string
  created_at: string | null
}

export interface ClientActionGroup {
  client_id: string | null
  client_name: string
  company_name: string
  role?: string
  next_session_date: string | null
  actions: ClientAction[]
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerComponentClient({ cookies: () => cookieStore })

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const status = request.nextUrl.searchParams.get('status') || 'to_do'

    const { data: actions, error } = await supabase
      .from('client_actions')
      .select(`
        id, title, description, description_content, source, status, due_date, created_date, created_at,
        note_title, source_url, session_note_id, synced_at, client_id,
        clients!client_actions_client_id_fkey (
          name, company_name, role
        )
      `)
      .eq('user_id', session.user.id)
      .eq('status', status)
      .order('created_date', { ascending: false })

    if (error) {
      console.error('Actions query error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Use the same RPCs as the main dashboard for accurate session dates
    const [thisWeekRes, futureRes, needsSchedulingRes] = await Promise.all([
      supabase.rpc('get_clients_this_week_fixed'),
      supabase.rpc('get_clients_future'),
      supabase.rpc('get_clients_needs_scheduling'),
    ])

    type DashboardClient = {
      client_id: string; client_name: string; company_name: string
      role: string | null; next_session_date?: string | null
    }

    const allDashboardClients = new Map<string, DashboardClient>()
    for (const c of [...(thisWeekRes.data || []), ...(futureRes.data || []), ...(needsSchedulingRes.data || [])]) {
      if (!allDashboardClients.has(c.client_id)) {
        allDashboardClients.set(c.client_id, c)
      }
    }

    // Seed groups with all active clients using dashboard data
    const groupMap = new Map<string, ClientActionGroup>()
    for (const [id, c] of allDashboardClients) {
      groupMap.set(id, {
        client_id: id,
        client_name: c.client_name,
        company_name: c.company_name || '',
        role: c.role || undefined,
        next_session_date: c.next_session_date || null,
        actions: []
      })
    }

    // Add actions to their client groups
    for (const action of (actions || [])) {
      const key = action.client_id || 'unmatched'

      if (!groupMap.has(key)) {
        const client = action.clients as unknown as { name: string; company_name: string; role: string | null } | null
        groupMap.set(key, {
          client_id: action.client_id,
          client_name: client?.name || 'Unmatched',
          company_name: client?.company_name || '',
          role: client?.role || undefined,
          next_session_date: null,
          actions: []
        })
      }

      const client = action.clients as unknown as { name: string; company_name: string; role: string | null } | null
      groupMap.get(key)!.actions.push({
        id: action.id,
        title: action.title,
        description: action.description,
        description_content: action.description_content,
        source: action.source,
        status: action.status,
        due_date: action.due_date,
        created_date: action.created_date,
        note_title: action.note_title,
        source_url: action.source_url,
        session_note_id: action.session_note_id,
        client_id: action.client_id,
        client_name: client?.name || 'Unmatched',
        company_name: client?.company_name || '',
        role: client?.role || null,
        synced_at: action.synced_at,
        created_at: action.created_at,
      })
    }

    // Sort: next session soonest first, no session to bottom
    const groups = Array.from(groupMap.values()).sort((a, b) => {
      if (a.next_session_date && b.next_session_date) {
        return new Date(a.next_session_date).getTime() - new Date(b.next_session_date).getTime()
      }
      if (a.next_session_date && !b.next_session_date) return -1
      if (!a.next_session_date && b.next_session_date) return 1
      return a.client_name.localeCompare(b.client_name)
    })

    const totalActions = groups.reduce((sum, g) => sum + g.actions.length, 0)

    // Get last synced timestamp
    const { data: syncRow } = await supabase
      .from('client_actions')
      .select('synced_at')
      .eq('user_id', session.user.id)
      .order('synced_at', { ascending: false })
      .limit(1)
      .single()

    return NextResponse.json({
      groups,
      total_actions: totalActions,
      last_synced: syncRow?.synced_at || null
    })
  } catch (error) {
    console.error('Actions API error:', error)
    return NextResponse.json({ error: `Failed to fetch actions: ${error}` }, { status: 500 })
  }
}
