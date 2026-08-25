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

// The session workspace stores notes as TipTap JSON using headings, bullet and ordered
// lists, and blockquotes. Serialising to markdown rather than bare text keeps that
// structure legible to the model: a topic heading stays separable from its bullets, and a
// blockquote of the client's own words stays distinguishable from Adam's commentary.
function renderInline(node: any): string {
  if (!node) return ''
  if (node.type === 'text') {
    let text = node.text || ''
    const marks: string[] = (node.marks || []).map((m: any) => m.type)
    if (marks.includes('code')) text = `\`${text}\``
    if (marks.includes('bold')) text = `**${text}**`
    if (marks.includes('italic')) text = `*${text}*`
    const link = (node.marks || []).find((m: any) => m.type === 'link')
    if (link?.attrs?.href) text = `[${text}](${link.attrs.href})`
    return text
  }
  if (node.type === 'hardBreak') return '\n'
  if (Array.isArray(node.content)) return node.content.map(renderInline).join('')
  return ''
}

function renderBlocks(nodes: any[], indent: string): string[] {
  const out: string[] = []
  for (const node of nodes || []) {
    if (!node) continue
    switch (node.type) {
      case 'heading': {
        const level = Math.min(Math.max(Number(node.attrs?.level) || 3, 1), 6)
        const text = renderInline(node).trim()
        if (text) out.push(`${indent}${'#'.repeat(level)} ${text}`)
        break
      }
      case 'paragraph': {
        const text = renderInline(node).trim()
        if (text) out.push(`${indent}${text}`)
        break
      }
      case 'bulletList':
      case 'orderedList': {
        const ordered = node.type === 'orderedList'
        let counter = Number(node.attrs?.start) || 1
        for (const item of node.content || []) {
          const marker = ordered ? `${counter++}. ` : '- '
          const inner = renderBlocks(item?.content || [], '')
          if (inner.length === 0) continue
          out.push(`${indent}${marker}${inner[0]}`)
          for (const line of inner.slice(1)) {
            out.push(`${indent}${' '.repeat(marker.length)}${line}`)
          }
        }
        break
      }
      case 'blockquote': {
        for (const line of renderBlocks(node.content || [], '')) {
          out.push(`${indent}> ${line}`)
        }
        break
      }
      case 'codeBlock': {
        const text = renderInline(node)
        if (text.trim()) out.push(`${indent}\`\`\`\n${text}\n${indent}\`\`\``)
        break
      }
      case 'horizontalRule': {
        out.push(`${indent}---`)
        break
      }
      // Atom node with no children: without an explicit case it would vanish silently.
      case 'actionBlock': {
        const title = (node.attrs?.prefillTitle || '').trim()
        out.push(`${indent}- [action] ${title || '(linked action item)'}`)
        break
      }
      case 'image': {
        break
      }
      default: {
        if (Array.isArray(node.content)) {
          out.push(...renderBlocks(node.content, indent))
        } else {
          const text = renderInline(node).trim()
          if (text) out.push(`${indent}${text}`)
        }
      }
    }
  }
  return out
}

function extractMarkdown(content: any): string {
  if (!content) return ''
  if (typeof content === 'string') return content.trim()
  const root = Array.isArray(content.content) ? content.content : [content]
  return renderBlocks(root, '').join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

// --- Pre-read prompt ---

// Notes are serialised and screened for emptiness before they reach the prompt, so the
// prompt only ever sees sessions that actually have content.
interface PreparedSessionNote {
  sessionDate: string | null
  connectionNotes: string
  topics: string
}

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
  sessionNotes: PreparedSessionNote[]
}): string {
  const { clientName, companyName, role, clientNotes, personalDetails, sessionDate, engagementLength, actions, granolaSummary, sessionNotes } = context

  const actionsBlock = actions.length > 0
    ? actions.map(a => `- ${a.title} | Due: ${a.due_date || 'No date'} | Status: ${a.status === 'to_do' ? 'To Do' : 'Not Done'}`).join('\n')
    : 'No open actions.'

  const sessionNotesBlock = sessionNotes.length > 0
    ? sessionNotes.map(sn => {
        const dateStr = sn.sessionDate
          ? new Date(sn.sessionDate).toLocaleDateString('en-US', {
              month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles',
            })
          : 'Unknown date'
        const parts = [`--- Session: ${dateStr} ---`]
        if (sn.connectionNotes) parts.push(`Connection notes:\n${sn.connectionNotes}`)
        if (sn.topics) parts.push(`Topics:\n${sn.topics}`)
        return parts.join('\n\n')
      }).join('\n\n')
    : 'No previous session notes available.'

  const personalBlock = personalDetails && Object.keys(personalDetails).length > 0
    ? Object.entries(personalDetails)
        .filter(([, v]) => v && v.trim())
        .map(([k, v]) => `- ${k}: ${v}`)
        .join('\n')
    : ''

  return `You are preparing a factual pre-read for Adam Donkin's upcoming coaching session. Your job is to report what is on record, not to interpret it.

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

RULES — these override any instinct to be helpful or thorough:
- Report only what is in the data above. Never infer, diagnose, or conclude.
- No advice, suggestions, coaching moves, or questions for Adam to ask.
- No characterisation of mood, energy, or emotional state unless the client said it themselves — in which case quote them.
- No meaning-making. Never write that something "signals", "suggests", "reflects", "points to", or "is really about" anything.
- Prefer the client's own words. Quote short phrases verbatim where the notes contain them.
- Bullets, not prose. One fact per bullet. No connective narration between bullets.
- Attribute anything non-obvious to its session date, e.g. "(Mar 4)".
- If a section has no supporting data, write "Nothing on record." and move on. Do not pad. A short pre-read is the correct output when the inputs are thin — length is never a goal.

### ${clientName} — Session prep for ${sessionDate}

**Quick context**
- Role, company, and what the company does — 1-2 lines
- Working together: use the "Working together" field above verbatim if present

**Connection reminders**
Personal details Adam can reference naturally, as bullets. Partner/spouse name, children's names and ages, life events, hobbies, health, pets. Use "Known personal details" above as the baseline and add anything stated in the session notes or Granola summary. Facts as recorded — no advice about how to use them.

**Where you left off**
The recent sessions, most recent first, each under its own date subheading. This is the substance of the pre-read, so put everything load-bearing here as bullets:
- What was discussed
- What was decided
- What the client said they would do, quoted where the notes allow
- Anything raised and left unresolved, with the date it was raised
- Any framework or model referenced by name

**Open actions**
The open actions listed above, verbatim, with due dates and status. Do not editorialise on progress.

**Key people**
Direct reports and key relationships mentioned, with titles where known. Name, title, relationship. Nothing further.`
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

    // Fetch the most recent sessions that actually have notes.
    //
    // Three filters matter here, and without them the model routinely receives nothing.
    // `user_id`: this function runs with the service role, so RLS does not scope the query,
    // and a team member opening the same session creates a second row for it.
    // `session_date < event.start_time`: opening the workspace for an upcoming session
    // inserts an empty row stamped with that session's start time, which would otherwise
    // sort first and present the session being prepped for as "where you left off".
    // The non-null check drops the placeholder rows that the calendar backfill created for
    // every past event.
    //
    // Over-fetching then screening in JS is deliberate: a note column can hold an empty
    // TipTap document, which is non-null but serialises to nothing.
    const { data: prevNotes } = await supabase
      .from('session_notes')
      .select('connection_notes, topics_content, session_date')
      .eq('client_id', event.client_id)
      .eq('user_id', user_id)
      .lt('session_date', event.start_time)
      .or('connection_notes.not.is.null,topics_content.not.is.null')
      .order('session_date', { ascending: false })
      .limit(12)

    const preparedNotes: PreparedSessionNote[] = (prevNotes || [])
      .map((sn: any) => ({
        sessionDate: sn.session_date,
        connectionNotes: extractMarkdown(sn.connection_notes),
        topics: extractMarkdown(sn.topics_content),
      }))
      .filter(sn => sn.connectionNotes || sn.topics)
      .slice(0, 3)

    console.log(
      `SESSION_NOTES client=${client.name} rows_matched=${prevNotes?.length ?? 0} ` +
      `with_content=${preparedNotes.length}`,
    )

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
      sessionNotes: preparedNotes,
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
${preparedNotes.map(sn => sn.connectionNotes).filter(Boolean).join('\n')}
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
