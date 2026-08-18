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

// --- Granola helpers ---

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
  personalDetails: Record<string, string> | null
  sessionDate: string
  engagementLength: string | null
  actions: any[]
  granolaSummary: string | null
  sessionNotes: any[]
}): string {
  const { clientName, companyName, role, clientNotes, personalDetails, sessionDate, engagementLength, actions, granolaSummary, sessionNotes } = context

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

  const personalBlock = personalDetails && Object.keys(personalDetails).length > 0
    ? Object.entries(personalDetails)
        .filter(([, v]) => v && v.trim())
        .map(([k, v]) => `- ${k}: ${v}`)
        .join('\n')
    : ''

  return `You are Adam Donkin's coaching session prep assistant. Generate a pre-read document for his upcoming session.

## Client information
- Name: ${clientName}
- Company: ${companyName || 'Unknown'}
- Role: ${role || 'Unknown'}
- Session date: ${sessionDate}
${engagementLength ? `- Working together: ${engagementLength}` : ''}
${clientNotes ? `- Coach notes: ${clientNotes}` : ''}

## Known personal details
${personalBlock || 'No personal details on file yet.'}

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
- How long they've been working together (use the "Working together" field from client information above)
- Session cadence (estimate from dates)

**Connection reminders**
Bullet points of personal details Adam can reference naturally. Always include partner/spouse name, children's names and ages, and any life events mentioned. Also include hobbies, health updates, and anything personal mentioned in passing. Use the "Known personal details" section above as the baseline and add anything new found in the session notes or Granola summaries.

**Where you left off (last session)**
Prose paragraphs with bold headers. Put Adam back in the room. Include:
- What was discussed in detail
- Emotional texture — were they energized, stuck, anxious, relieved?
- Key decisions made or almost-made
- Problem-solution structures discussed
- Any frameworks introduced or referenced

**Patterns & arc**
2-4 coaching patterns, one paragraph each. Name each pattern plainly. Connect current themes to the long-running developmental arc.

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
    const personalDetailsEnabled = Deno.env.get('ENABLE_PERSONAL_DETAILS_EXTRACTION') === 'true'

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
      .select('id, title, start_time, client_id, clients(id, name, company_name, role, email, notes, personal_details)')
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

      // Title match is only a cheap pre-filter to limit detail fetches: the list endpoint
      // omits attendees, so emails are available per note only. Over-inclusion here is
      // harmless because the attendee email check below is what decides the match.
      const nameParts = client.name.toLowerCase().split(/\s+/)
      const calendarTitle = (event.title || '').toLowerCase()
      const calendarWords = calendarTitle.split(/[\s<>/\-]+/).filter((w: string) => w.length >= 3 && w !== 'adam' && w !== 'coaching')
      const searchTerms = [...new Set([...nameParts, ...calendarWords])]
      const potentialMatches = notesList.filter(n => {
        const t = n.title?.toLowerCase() || ''
        return searchTerms.some(term => t.includes(term))
      }).slice(0, 10)

      for (const n of potentialMatches) {
        const detail = await fetchGranolaNoteDetail(granolaKey, n.id)
        if (detail) granolaNotes.push(detail)
      }
      console.log(`Fetched ${granolaNotes.length} Granola candidate notes for ${client.name}`)
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

    // Find the most recent Granola note for this client. An attendee email match is the
    // only accepted link: a title or name match cannot tell two clients who share a first
    // name apart, and attaching the wrong client's history is worse than attaching none.
    let granolaSummary: string | null = null
    if (client.email) {
      const clientEmail = client.email.toLowerCase()
      const byEmail = granolaNotes
        .filter(n => n.attendees?.some(a => a.email?.toLowerCase() === clientEmail))
        .sort((a, b) => {
          const da = new Date(a.calendar_event?.scheduled_start_time || a.created_at)
          const db = new Date(b.calendar_event?.scheduled_start_time || b.created_at)
          return db.getTime() - da.getTime()
        })

      granolaSummary = byEmail.find(n => n.summary_markdown)?.summary_markdown ?? null
    }

    if (!granolaSummary) {
      console.log(
        `GRANOLA_NO_EMAIL_MATCH client=${client.name} email=${client.email || 'none'} ` +
        `candidates=${granolaNotes.length} - pre-read will omit the session summary`,
      )
    }

    // Calculate engagement length from earliest session or calendar event
    let engagementLength: string | null = null

    const [{ data: firstSessionRecord }, { data: firstCalEvent }] = await Promise.all([
      supabase
        .from('sessions')
        .select('date')
        .eq('client_id', event.client_id)
        .not('date', 'is', null)
        .order('date', { ascending: true })
        .limit(1)
        .single(),
      supabase
        .from('calendar_events')
        .select('start_time')
        .eq('client_id', event.client_id)
        .eq('user_id', user_id)
        .order('start_time', { ascending: true })
        .limit(1)
        .single(),
    ])

    const candidates: Date[] = []
    if (firstSessionRecord?.date) candidates.push(new Date(firstSessionRecord.date))
    if (firstCalEvent?.start_time) candidates.push(new Date(firstCalEvent.start_time))
    const earliestDate = candidates.length > 0
      ? candidates.reduce((a, b) => a < b ? a : b)
      : null

    if (earliestDate) {
      const firstDate = earliestDate
      const now = new Date()
      const totalMonths = Math.floor((now.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
      if (totalMonths < 1) {
        engagementLength = 'less than a month'
      } else if (totalMonths < 12) {
        engagementLength = `${totalMonths} month${totalMonths === 1 ? '' : 's'}`
      } else {
        const years = Math.floor(totalMonths / 12)
        const months = totalMonths % 12
        engagementLength = months > 0
          ? `${years} year${years === 1 ? '' : 's'}, ${months} month${months === 1 ? '' : 's'}`
          : `${years} year${years === 1 ? '' : 's'}`
      }
      engagementLength += ` (since ${firstDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })})`
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
      personalDetails: client.personal_details,
      sessionDate: targetDate,
      engagementLength,
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

    // Extract and update personal details from the generated content.
    // Off unless ENABLE_PERSONAL_DETAILS_EXTRACTION=true: this merges inferred details
    // straight into clients.personal_details with no review step, and the prompt feeds the
    // stored values back in as established fact, so anything wrong persists and compounds.
    if (!personalDetailsEnabled) {
      console.log(`Personal details extraction disabled, skipping for ${client.name}`)
    } else try {
      const existingDetails = client.personal_details || {}
      const extractPrompt = `Extract personal details about ${client.name} from the following coaching session data. Return ONLY a JSON object with these keys (omit any key where you have no information):

- "partner": Partner/spouse name and any relevant notes
- "children": Children's names, ages, and any notes
- "family": Other family details (parents, siblings, etc.)
- "hobbies": Interests, hobbies, sports
- "health": Health-related notes
- "pets": Pets
- "milestones": Upcoming life milestones (wedding, move, etc.)
- "other": Anything else personal worth remembering

Here are the existing personal details on file (keep these unless contradicted by newer information):
${JSON.stringify(existingDetails)}

Source data:
${granolaSummary || ''}
${(prevNotes || []).map((sn: any) => extractPlainText(sn.connection_notes)).filter(Boolean).join('\n')}
${client.notes || ''}

Return ONLY valid JSON, no explanation.`

      const extractRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: anthropicModel,
          max_tokens: 1024,
          messages: [{ role: 'user', content: extractPrompt }],
        }),
      })

      if (extractRes.ok) {
        const extractData = await extractRes.json()
        const rawText = extractData.content?.[0]?.text || ''
        const jsonMatch = rawText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const newDetails = JSON.parse(jsonMatch[0])
          const merged = { ...existingDetails }
          for (const [key, value] of Object.entries(newDetails)) {
            if (value && typeof value === 'string' && value.trim()) {
              merged[key] = value
            }
          }
          await supabase
            .from('clients')
            .update({ personal_details: merged })
            .eq('id', client.id)
          console.log(`Updated personal details for ${client.name}`)
        }
      }
    } catch (extractErr) {
      console.error(`Failed to extract personal details for ${client.name}:`, extractErr)
    }

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
