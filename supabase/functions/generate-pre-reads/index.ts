import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GranolaNoteListItem {
  id: string
  title: string
  created_at: string
  updated_at: string
  web_url?: string
  summary_markdown?: string | null
  calendar_event?: { scheduled_start_time?: string | null } | null
  attendees?: { name: string; email: string }[]
}

// --- Granola helpers (reused from sync-actions) ---

async function fetchGranolaNotes(apiKey: string, since: Date): Promise<GranolaNoteListItem[]> {
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

function extractPlainText(content: any): string {
  if (!content) return ''
  const parts: string[] = []
  function walk(node: any) {
    if (node.type === 'text') {
      parts.push(node.text || '')
    } else if (node.content) {
      for (const child of node.content) walk(child)
      if (node.type === 'paragraph' || node.type === 'listItem') parts.push('\n')
    }
  }
  walk(content)
  return parts.join('').trim()
}

// --- Pre-read prompt ---

function buildPreReadPrompt(context: {
  clientName: string
  companyName: string | null
  role: string | null
  clientNotes: string | null
  sessionDate: string
  actions: any[]
  granolaSummary: string | null
  sessionNotes: any[]
}): string {
  const { clientName, companyName, role, clientNotes, sessionDate, actions, granolaSummary, sessionNotes } = context

  const actionsBlock = actions.length > 0
    ? actions.map(a => `- ${a.title} | Due: ${a.due_date || 'No date'} | Status: ${a.status === 'to_do' ? 'To Do' : 'Not Done'}`).join('\n')
    : 'No open actions.'

  const sessionNotesBlock = sessionNotes.length > 0
    ? sessionNotes.map(sn => {
        const connText = extractPlainText(sn.connection_notes)
        const topicsText = extractPlainText(sn.topics_content)
        const dateStr = sn.session_date ? new Date(sn.session_date).toLocaleDateString() : 'Unknown date'
        return `--- Session: ${dateStr} ---\nConnection notes:\n${connText || '(none)'}\n\nTopics:\n${topicsText || '(none)'}`
      }).join('\n\n')
    : 'No previous session notes available.'

  return `You are Adam Donkin's coaching session prep assistant. Generate a pre-read document for his upcoming session.

## Client information
- Name: ${clientName}
- Company: ${companyName || 'Unknown'}
- Role: ${role || 'Unknown'}
- Session date: ${sessionDate}
${clientNotes ? `- Coach notes: ${clientNotes}` : ''}

## Open actions (from coaching dashboard)
${actionsBlock}

## Most recent Granola session summary
${granolaSummary || 'No Granola summary available for this client.'}

## Previous session notes (Adam's notes)
${sessionNotesBlock}

---

Generate the pre-read in the following structure. Write in prose for narrative sections with **bold headers** on each paragraph for scanning. Use bullets only for reference lists. Be direct and conversational — like a sharp colleague briefing Adam, not a formal report.

FORMATTING: Use frequent paragraph breaks for readability — aim for 3-4 sentences per paragraph. Maintain full depth and detail.

### ${clientName} — Session prep for ${sessionDate}

**Quick context**
- Role, company, what the company does (1-2 lines)
- How long you've been working together (estimate from session history)
- Session cadence (estimate from dates)

**Connection reminders**
Bullet points of personal details Adam can reference naturally — partner/family, hobbies, health, anything mentioned in passing.

**Where you left off (last session)**
Prose paragraphs with bold headers. Put Adam back in the room. Include:
- What was discussed in detail
- Emotional texture — were they energized, stuck, anxious, relieved?
- Key decisions made or almost-made
- Problem-solution structures discussed
- Any frameworks introduced or referenced

**Patterns & arc**
2-4 coaching patterns, one paragraph each. Name each pattern plainly. Connect current themes to the long-running developmental arc.

**Actions accountability**
Show the open actions from the data above. Only show To Do or Not Done — omit completed items. Note any patterns in completion.

**Session intention**
- What would make this session a 5/5?
- Specific threads to pick up with lead-in questions
- 1-2 coaching moves Adam might consider
- What to watch for in the client's energy

**Key people**
Bullet list of direct reports and key relationships mentioned, with titles if known.

IMPORTANT: Only include information you can substantiate from the data provided. If data is sparse, say so briefly rather than inventing details. Flag what's missing.`
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
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
    const anthropicModel = Deno.env.get('ANTHROPIC_MODEL') || 'claude-sonnet-4-6'
    const granolaKey = Deno.env.get('GRANOLA_API_KEY') ?? ''

    if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY not configured')
    console.log(`Using model: ${anthropicModel}`)

    const { user_id, date, calendar_event_id } = await req.json()
    if (!user_id) throw new Error('user_id is required')
    if (!calendar_event_id) throw new Error('calendar_event_id is required')

    const targetDate = date || new Date().toISOString().slice(0, 10)
    console.log(`Generating pre-read for user ${user_id}, event ${calendar_event_id} on ${targetDate}`)

    // Fetch the specific event
    const { data: event, error: eventError } = await supabase
      .from('calendar_events')
      .select('id, title, start_time, client_id, clients(id, name, company_name, role, email, notes)')
      .eq('id', calendar_event_id)
      .single()

    if (eventError || !event) {
      throw new Error(`Failed to fetch event: ${eventError?.message || 'not found'}`)
    }

    const client = event.clients as any
    if (!client) {
      return new Response(
        JSON.stringify({ success: true, message: 'Event has no client', generated: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    console.log(`Generating pre-read for ${client.name}`)

    // Fetch Granola notes for matching
    let granolaNotes: GranolaNoteListItem[] = []
    if (granolaKey && client.email) {
      const since = new Date()
      since.setDate(since.getDate() - 90)
      const notesList = await fetchGranolaNotes(granolaKey, since)

      // Only fetch details for notes that might match this client (by title heuristic first)
      const clientFirstName = client.name.split(' ')[0].toLowerCase()
      const potentialMatches = notesList.filter(n =>
        n.title?.toLowerCase().includes(clientFirstName)
      ).slice(0, 10)

      for (const n of potentialMatches) {
        const detail = await fetchGranolaNoteDetail(granolaKey, n.id)
        if (detail) granolaNotes.push(detail)
      }

      // If no matches by title, fetch a broader set
      if (granolaNotes.length === 0) {
        for (let i = 0; i < Math.min(notesList.length, 30); i += 5) {
          const batch = notesList.slice(i, i + 5)
          const results = await Promise.all(batch.map(n => fetchGranolaNoteDetail(granolaKey, n.id)))
          for (const r of results) { if (r) granolaNotes.push(r) }
        }
      }
      console.log(`Fetched ${granolaNotes.length} Granola notes for matching`)
    }

    // Create or update pre_read row as 'generating'
    await supabase
      .from('pre_reads')
      .upsert({
        user_id,
        client_id: event.client_id,
        calendar_event_id: event.id,
        session_date: targetDate,
        status: 'generating',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,calendar_event_id' })

    // Fetch open actions for this client
    const { data: actions } = await supabase
      .from('client_actions')
      .select('title, due_date, status, review_history')
      .eq('client_id', event.client_id)
      .in('status', ['to_do'])
      .order('due_date', { ascending: true, nullsFirst: false })

    // Find most recent Granola note for this client by attendee email
    let granolaSummary: string | null = null
    if (client.email && granolaNotes.length > 0) {
      const clientEmail = client.email.toLowerCase()
      const matching = granolaNotes
        .filter(n => n.attendees?.some(a => a.email?.toLowerCase() === clientEmail))
        .sort((a, b) => {
          const da = new Date(a.calendar_event?.scheduled_start_time || a.created_at)
          const db = new Date(b.calendar_event?.scheduled_start_time || b.created_at)
          return db.getTime() - da.getTime()
        })

      if (matching.length > 0 && matching[0].summary_markdown) {
        granolaSummary = matching[0].summary_markdown
      }
    }

    // Fetch previous session notes (last 3 sessions)
    const { data: prevNotes } = await supabase
      .from('session_notes')
      .select('connection_notes, topics_content, session_date')
      .eq('client_id', event.client_id)
      .order('session_date', { ascending: false })
      .limit(3)

    // Build prompt
    const prompt = buildPreReadPrompt({
      clientName: client.name,
      companyName: client.company_name,
      role: client.role,
      clientNotes: client.notes,
      sessionDate: targetDate,
      actions: actions || [],
      granolaSummary,
      sessionNotes: prevNotes || [],
    })

    // Call Claude API
    console.log(`Calling Claude API for ${client.name}...`)
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: anthropicModel,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!claudeRes.ok) {
      const errText = await claudeRes.text()
      throw new Error(`Claude API error ${claudeRes.status}: ${errText}`)
    }

    const claudeData = await claudeRes.json()
    const content = claudeData.content?.[0]?.text || ''

    // Save the generated pre-read
    await supabase
      .from('pre_reads')
      .update({
        content,
        status: 'ready',
        generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user_id)
      .eq('calendar_event_id', event.id)

    console.log(`Generated pre-read for ${client.name}`)

    return new Response(
      JSON.stringify({ success: true, message: `Generated pre-read for ${client.name}` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('Generate pre-reads error:', error)

    // Try to mark as error if we have enough context
    try {
      const { user_id, calendar_event_id } = await req.clone().json()
      if (user_id && calendar_event_id) {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        )
        await supabase
          .from('pre_reads')
          .update({ status: 'error', error_message: String(error), updated_at: new Date().toISOString() })
          .eq('user_id', user_id)
          .eq('calendar_event_id', calendar_event_id)
      }
    } catch {}

    return new Response(
      JSON.stringify({ success: false, message: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
