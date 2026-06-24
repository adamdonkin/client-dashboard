import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// --- Types ---

interface DefactoAction {
  title: string; workspace: string; id: string
  current_update: { status_action: string; due_date_new: string | null }
  type: string; created_date: string; due_date: string | null; assignee_id: string
}
interface DefactoWorkspace { id: string; name: string }
interface DefactoUser { id: string; name: string }
interface GranolaNoteListItem {
  id: string; title: string; created_at: string; updated_at: string
  web_url?: string; attendees?: { name: string; email: string }[]
  summary_markdown?: string | null
  calendar_event?: { scheduled_start_time?: string | null } | null
}
interface ExtractedAction { title: string; description: string | null; assignee: string | null }
type DbClient = { id: string; client_name: string; client_email: string; company_name: string | null; role: string | null }

// --- Defacto helpers ---

async function mcpCall(mcpUrl: string, method: string, args: Record<string, unknown>, id = 1): Promise<unknown | null> {
  try {
    const res = await fetch(mcpUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/call', params: { name: method, arguments: args }, id }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const text = data?.result?.content?.[0]?.text
    return text ? JSON.parse(text) : null
  } catch { return null }
}

async function fetchDefactoWorkspaces(mcpUrl: string): Promise<DefactoWorkspace[]> {
  return (await mcpCall(mcpUrl, 'list_user_workspaces', {}) as DefactoWorkspace[]) || []
}

async function fetchWorkspaceUsers(mcpUrl: string, workspaceId: string): Promise<DefactoUser[]> {
  return (await mcpCall(mcpUrl, 'list_workspace_users', { workspace_id: workspaceId }) as DefactoUser[]) || []
}

async function fetchActionsForUser(mcpUrl: string, userId: string): Promise<DefactoAction[]> {
  const all: DefactoAction[] = []
  let page = 1
  let hasMore = true
  while (hasMore) {
    const r = await mcpCall(mcpUrl, 'list_actions', { user_id: userId, page, page_size: 100, sort_field: 'modified', sort_desc: true }, page) as { action?: DefactoAction[]; has_more?: boolean } | null
    if (!r) break
    all.push(...(r.action || []))
    hasMore = r.has_more || false
    page++
  }
  return all
}

function normalizeDefactoStatus(status: string): 'to_do' | 'completed' | 'cancelled' {
  const s = (status || '').toLowerCase()
  if (s === 'done' || s === 'completed') return 'completed'
  if (s === 'cancelled' || s === 'canceled') return 'cancelled'
  return 'to_do'
}

function namesMatch(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '')
  if (norm(a) === norm(b)) return true
  const ap = a.toLowerCase().split(/\s+/)
  const bp = b.toLowerCase().split(/\s+/)
  return ap.length > 0 && bp.length > 0 && ap[0] === bp[0] && ap[ap.length - 1] === bp[bp.length - 1]
}

// --- Granola helpers ---

async function fetchGranolaNotes(apiKey: string): Promise<GranolaNoteListItem[]> {
  const since = new Date()
  since.setDate(since.getDate() - 60)
  const all: GranolaNoteListItem[] = []
  let cursor: string | undefined
  let hasMore = true

  while (hasMore) {
    const params = new URLSearchParams({ created_after: since.toISOString() })
    if (cursor) params.set('cursor', cursor)
    const res = await fetch(`https://public-api.granola.ai/v1/notes?${params}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    })
    if (!res.ok) break
    const data = await res.json()
    all.push(...(data.notes || []))
    hasMore = data.hasMore === true
    cursor = data.cursor
    if (!cursor) break
  }
  return all
}

async function fetchGranolaNoteDetail(apiKey: string, noteId: string): Promise<GranolaNoteListItem | null> {
  const res = await fetch(`https://public-api.granola.ai/v1/notes/${noteId}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  })
  if (!res.ok) return null
  return res.json()
}

function stripBold(s: string): string { return s.replace(/\*\*/g, '').trim() }

function extractActionsFromMarkdown(markdown: string): ExtractedAction[] {
  const actions: ExtractedAction[] = []
  const lines = markdown.split('\n')
  let inSection = false
  let current: ExtractedAction | null = null

  for (const line of lines) {
    const trimmed = line.trim()
    const lower = trimmed.toLowerCase()
    if (lower.match(/^#+\s*next\s+steps/)) { inSection = true; continue }
    if (inSection && (lower.match(/^#+\s/) || lower === '---')) {
      if (current) { actions.push(current); current = null }
      inSection = false; continue
    }
    if (!inSection) continue

    const bulletMatch = trimmed.match(/^[-*]\s*(?:\[.\]\s*)?(.+)/)
    if (bulletMatch) {
      if (current) actions.push(current)
      const raw = bulletMatch[1].trim()
      const assigneeMatch = raw.match(/\(([^)]+)\)\s*$/)
      const assignee = assigneeMatch ? assigneeMatch[1].trim() : null
      const titleRaw = assigneeMatch ? raw.slice(0, raw.lastIndexOf('(')).trim() : raw
      current = { title: stripBold(titleRaw), description: null, assignee }
      continue
    }
    if (current && trimmed.length > 0) {
      const cleaned = stripBold(trimmed)
      current.description = current.description ? current.description + ' ' + cleaned : cleaned
    }
  }
  if (current) actions.push(current)
  return actions.filter(a => a.title.length > 5)
}

function inferDueDate(title: string, sessionDate: Date): string | null {
  const t = title.toLowerCase()
  if (t.includes('tomorrow')) {
    const d = new Date(sessionDate); d.setDate(d.getDate() + 1); return d.toISOString()
  }
  if (t.match(/this\s+week|end\s+of\s+week|before\s+end\s+of\s+week/)) {
    const d = new Date(sessionDate); const dow = d.getDay()
    d.setDate(d.getDate() + (5 - dow))
    if (d <= sessionDate) d.setDate(d.getDate() + 7)
    return d.toISOString()
  }
  if (t.match(/next\s+week/)) {
    const d = new Date(sessionDate); d.setDate(d.getDate() + (12 - d.getDay())); return d.toISOString()
  }
  const monthNames = ['january','february','march','april','may','june','july','august','september','october','november','december']
  const monthMatch = t.match(new RegExp(`(early|mid|late|end of|by)\\s+(${monthNames.join('|')})`))
  if (monthMatch) {
    const modifier = monthMatch[1]; const monthIdx = monthNames.indexOf(monthMatch[2])
    let year = sessionDate.getFullYear()
    if (monthIdx < sessionDate.getMonth()) year++
    let day = 15
    if (modifier === 'early') day = 7
    else if (modifier === 'late' || modifier === 'end of' || modifier === 'by') day = 25
    return new Date(year, monthIdx, day).toISOString()
  }
  return null
}

// --- Main handler ---

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { user_id } = await req.json()
    if (!user_id) throw new Error('user_id is required')

    const mcpUrl = Deno.env.get('DEFACTO_MCP_URL') ?? ''
    const granolaKey = Deno.env.get('GRANOLA_API_KEY') ?? ''

    console.log(`Starting actions sync for user: ${user_id}`)

    const { data: clients } = await supabase
      .from('clients')
      .select('id, client_name:name, client_email:email, company_name, role')
      .eq('user_id', user_id)
      .eq('is_active', true)

    if (!clients || clients.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No active clients', stats: { defacto: 0, granola: 0, upserted: 0 } }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const emailToClient = new Map<string, DbClient>()
    const companyToClients = new Map<string, DbClient[]>()
    for (const c of clients) {
      if (c.client_email) emailToClient.set(c.client_email.toLowerCase(), c)
      if (c.company_name) {
        const k = c.company_name.toLowerCase()
        if (!companyToClients.has(k)) companyToClients.set(k, [])
        companyToClients.get(k)!.push(c)
      }
    }

    type Row = {
      user_id: string; client_id: string | null; source: string; source_id: string
      title: string; description: string | null; status: string; due_date: string | null
      created_date: string | null; note_title: string | null; workspace_name: string | null
      source_url: string | null; synced_at: string
    }
    const rows: Row[] = []
    const now = new Date().toISOString()

    // --- Defacto ---
    let defactoCount = 0
    if (mcpUrl) {
      const workspaces = await fetchDefactoWorkspaces(mcpUrl)
      const relevant = workspaces.filter(ws => companyToClients.has(ws.name.toLowerCase()))
      const wsUsers = await Promise.all(relevant.map(async ws => ({ ws, users: await fetchWorkspaceUsers(mcpUrl, ws.id) })))

      const clientDefactoIds = new Map<string, { defactoUserId: string; workspace: string }>()
      for (const { ws, users } of wsUsers) {
        for (const client of (companyToClients.get(ws.name.toLowerCase()) || [])) {
          const matched = users.find(u => namesMatch(u.name, client.client_name))
          if (matched) clientDefactoIds.set(client.id, { defactoUserId: matched.id, workspace: ws.name })
        }
      }

      const actionResults = await Promise.all(
        Array.from(clientDefactoIds.entries()).map(async ([clientId, { defactoUserId, workspace }]) => ({
          clientId, workspace, actions: await fetchActionsForUser(mcpUrl, defactoUserId),
        })),
      )

      for (const { clientId, workspace, actions } of actionResults) {
        for (const a of actions) {
          rows.push({
            user_id, client_id: clientId, source: 'defacto', source_id: a.id,
            title: a.title, description: null,
            status: normalizeDefactoStatus(a.current_update?.status_action),
            due_date: a.due_date, created_date: a.created_date,
            note_title: null, workspace_name: workspace, source_url: null, synced_at: now,
          })
          defactoCount++
        }
      }
    }

    // --- Granola ---
    let granolaCount = 0
    if (granolaKey) {
      const allNotes = await fetchGranolaNotes(granolaKey)

      // Fetch all note details (list endpoint doesn't include attendees)
      const details: GranolaNoteListItem[] = []
      for (let i = 0; i < allNotes.length; i += 3) {
        const batch = allNotes.slice(i, i + 3)
        const results = await Promise.all(batch.map(n => fetchGranolaNoteDetail(granolaKey, n.id)))
        for (const r of results) { if (r) details.push(r) }
        if (i + 3 < allNotes.length) await new Promise(r => setTimeout(r, 700))
      }

      const nameToClient = new Map<string, DbClient>()
      for (const c of clients) {
        nameToClient.set(c.client_name.split(/\s+/)[0].toLowerCase(), c)
        nameToClient.set(c.client_name.toLowerCase(), c)
      }

      // Find the most recent note per client by attendee email
      const latestNotePerClient = new Map<string, GranolaNoteListItem>()
      for (const note of details) {
        if (!note.attendees) continue
        for (const att of note.attendees) {
          if (!att.email) continue
          const client = emailToClient.get(att.email.toLowerCase())
          if (!client) continue
          const noteDate = new Date(note.calendar_event?.scheduled_start_time || note.created_at)
          const existing = latestNotePerClient.get(client.id)
          const existingDate = existing ? new Date(existing.calendar_event?.scheduled_start_time || existing.created_at) : null
          if (!existingDate || noteDate > existingDate) {
            latestNotePerClient.set(client.id, note)
          }
        }
      }

      // Extract actions from ONLY the most recent note per client
      for (const [clientId, note] of latestNotePerClient) {
        if (!note.summary_markdown) continue
        const extracted = extractActionsFromMarkdown(note.summary_markdown)
        if (extracted.length === 0) continue
        const sessionDate = new Date(note.calendar_event?.scheduled_start_time || note.created_at)

        for (let idx = 0; idx < extracted.length; idx++) {
          const { title: actionTitle, description, assignee } = extracted[idx]

          let targetClientId = clientId
          if (assignee) {
            const key = assignee.toLowerCase()
            const matched = nameToClient.get(key) || nameToClient.get(key.split(/\s+/)[0])
            if (matched) targetClientId = matched.id
            else continue
          }

          rows.push({
            user_id, client_id: targetClientId, source: 'granola', source_id: `${note.id}-${idx}`,
            title: actionTitle, description, status: 'to_do',
            due_date: inferDueDate(actionTitle, sessionDate),
            created_date: sessionDate.toISOString(), note_title: note.title, workspace_name: null,
            source_url: note.web_url || null, synced_at: now,
          })
          granolaCount++
        }
      }
    }

    // --- Clean up stale Granola actions ---
    const granolaSourceIds = new Set(rows.filter(r => r.source === 'granola').map(r => r.source_id))
    const { data: existingGranola } = await supabase
      .from('client_actions').select('id, source_id').eq('user_id', user_id).eq('source', 'granola')
    if (existingGranola) {
      const staleIds = existingGranola.filter(e => !granolaSourceIds.has(e.source_id)).map(e => e.id)
      if (staleIds.length > 0) await supabase.from('client_actions').delete().in('id', staleIds)
    }

    // --- Upsert ---
    let upserted = 0
    for (let i = 0; i < rows.length; i += 50) {
      const chunk = rows.slice(i, i + 50)
      const { error } = await supabase.from('client_actions').upsert(chunk, { onConflict: 'user_id,source,source_id' })
      if (error) console.error('Upsert error:', error)
      else upserted += chunk.length
    }

    console.log(`Actions sync complete: ${defactoCount} defacto, ${granolaCount} granola, ${upserted} upserted`)

    return new Response(
      JSON.stringify({ success: true, message: `Synced ${upserted} actions`, stats: { defacto: defactoCount, granola: granolaCount, upserted } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('Sync actions error:', error)
    return new Response(
      JSON.stringify({ success: false, message: `Sync failed: ${error}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
