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
  assigned_to: string | null
  client_name: string
  company_name: string
  role: string | null
  synced_at: string
  created_at: string | null
  goal_id: string | null
  goal: { id: string; priority: number | null; title: string } | null
  from_magic_questions: boolean
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

    // A teammate works inside the coach's data, so their own actions are owned
    // by the coach. Scoping by user_id would hide the shared set from them and
    // their own work from the coach; RLS already limits this to accessible_user_ids().
    const { data: linkedClient } = await supabase
      .from('clients')
      .select('id')
      .eq('auth_user_id', session.user.id)
      .maybeSingle()
    const myClientId = linkedClient?.id ?? null

    const { data: actions, error } = await supabase
      .from('client_actions')
      .select(`
        id, title, description, description_content, source, status, due_date, created_date, created_at,
        note_title, source_url, session_note_id, synced_at, client_id, assigned_to, goal_id, from_magic_questions,
        goal:client_goals!client_actions_goal_id_fkey ( id, priority, title ),
        clients!client_actions_client_id_fkey (
          name, company_name, role
        )
      `)
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

    // Separate self-assigned vs client actions
    const myActions: ClientAction[] = []
    for (const action of (actions || [])) {
      const client = action.clients as unknown as { name: string; company_name: string; role: string | null } | null
      const mapped: ClientAction = {
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
        assigned_to: action.assigned_to,
        client_name: client?.name || 'Unmatched',
        company_name: client?.company_name || '',
        role: client?.role || null,
        synced_at: action.synced_at,
        created_at: action.created_at,
        goal_id: action.goal_id,
        goal: action.goal as unknown as ClientAction['goal'],
        from_magic_questions: action.from_magic_questions,
      }

      // Mine when it names me, or when it sits on the client record that is me:
      // a teammate's own work lives on their client and is rarely assigned.
      // It stays in the client group below as well, so nothing goes missing
      // from the place someone would look for it.
      if (action.assigned_to === session.user.id || (myClientId && action.client_id === myClientId)) {
        myActions.push(mapped)
      }

      const key = action.client_id || 'unmatched'
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          client_id: action.client_id,
          client_name: client?.name || 'Unmatched',
          company_name: client?.company_name || '',
          role: client?.role || undefined,
          next_session_date: null,
          actions: []
        })
      }
      groupMap.get(key)!.actions.push(mapped)
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
      .order('synced_at', { ascending: false })
      .limit(1)
      .single()

    return NextResponse.json({
      groups,
      my_actions: myActions,
      // Lets the page add an action to the viewer's own client record
      my_client_id: myClientId,
      total_actions: totalActions,
      last_synced: syncRow?.synced_at || null
    })
  } catch (error) {
    console.error('Actions API error:', error)
    return NextResponse.json({ error: `Failed to fetch actions: ${error}` }, { status: 500 })
  }
}
