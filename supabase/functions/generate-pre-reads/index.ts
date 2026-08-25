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

// Sessions are paired between Granola and the workspace by calendar day. Pacific is the
// project's canonical timezone; comparing raw UTC timestamps would split an evening
// session across two days and break the pairing.
function pacificDay(value: string | null | undefined): string | null {
  if (!value) return null
  const d = new Date(value)
  if (isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d)
}

function formatSessionDay(day: string): string {
  // `day` is already a Pacific calendar date, so parse as local noon to avoid re-shifting.
  const d = new Date(`${day}T12:00:00`)
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

// --- Pre-read prompt ---

// Notes are serialised and screened for emptiness before they reach the prompt, so the
// prompt only ever sees sessions that actually have content.
interface PreparedSessionNote {
  day: string | null
  connectionNotes: string
  topics: string
}

// The Granola summary is spliced in verbatim after generation. The model emits this token
// on its own line to mark where, rather than being asked to reproduce the summary itself —
// Granola's own write-up is the best-written part of the document and any attempt to
// restate it loses ground.
const LAST_SESSION_TOKEN = '{{LAST_SESSION}}'

// Topics the client sent ahead of the session are their own words, usually pasted in from
// Slack. They pass through verbatim for the same reason the write-up does.
const SESSION_TOPICS_TOKEN = '{{SESSION_TOPICS}}'

function buildPreReadPrompt(context: {
  clientName: string
  companyName: string | null
  role: string | null
  clientNotes: string | null
  personalDetails: Record<string, string> | null
  sessionDate: string
  engagementLength: string | null
  lastSessionDay: string | null
  granolaSummary: string | null
  coachNotes: string
  sessionTopics: string
}): string {
  const { clientName, companyName, role, clientNotes, personalDetails, sessionDate, engagementLength, lastSessionDay, granolaSummary, coachNotes, sessionTopics } = context

  const lastSessionLabel = lastSessionDay ? formatSessionDay(lastSessionDay) : null

  const personalBlock = personalDetails && Object.keys(personalDetails).length > 0
    ? Object.entries(personalDetails)
        .filter(([, v]) => v && v.trim())
        .map(([k, v]) => `- ${k}: ${v}`)
        .join('\n')
    : ''

  // Two shapes: when Granola captured the session its summary carries the narrative and
  // the model only adds what the coach's notes contain beyond it. Without a summary the
  // model has to write the session section itself, in the same voice.
  const lastSessionSpec = granolaSummary
    ? `**Last session — ${lastSessionLabel}**
${LAST_SESSION_TOKEN}

Output the token ${LAST_SESSION_TOKEN} on a line by itself, exactly as written, and nothing else on that line. The session write-up is inserted there automatically. Do not summarise the session yourself and do not describe what the write-up says.

**From your notes**
Only what Adam's own notes contain that the session write-up above does not. Bullets. Typical output is two to five bullets.
- Include topics, details, names, numbers, or commitments that are missing from the write-up.
- Include Adam's own observations, since the write-up cannot see his typed notes.
- Do not repeat anything already in the write-up, and do not restate it in different words.
- Never reference the write-up. No "also captured above", "as noted", "per the summary".
- If his notes add nothing substantive, write exactly: Nothing beyond the session write-up.`
    : `**Last session — ${lastSessionLabel || 'date unknown'}**
Write this section from Adam's notes below. Group by topic, with a short bold topic label per group and bullets under it. Nest supporting detail one level under the point it supports. This is the substance of the pre-read.`

  // What the client wants to cover is the first thing Adam reaches for when prepping, so it
  // leads. Dropped entirely when nothing was captured rather than printed as an empty heading.
  const topicsSpec = sessionTopics
    ? `**Topics ${clientName} sent for this session**
${SESSION_TOPICS_TOKEN}

Output the token ${SESSION_TOPICS_TOKEN} on a line by itself, exactly as written, and nothing else on that line. The topics are inserted there automatically in ${clientName}'s own words. Do not restate, summarise, or comment on them, and do not repeat them in any later section.

`
    : ''

  return `You are writing a pre-read for Adam Donkin's upcoming coaching session with ${clientName}.

## Client information
- Name: ${clientName}
- Company: ${companyName || 'Unknown'}
- Role: ${role || 'Unknown'}
- Upcoming session date: ${sessionDate}
${engagementLength ? `- Working together: ${engagementLength}` : ''}
${clientNotes ? `- Coach notes on file: ${clientNotes}` : ''}

## Known personal details
${personalBlock || 'No personal details on file yet.'}

## Topics ${clientName} sent for this upcoming session
${sessionTopics || 'None captured.'}

## Last session${lastSessionLabel ? ` (${lastSessionLabel})` : ''} — write-up already produced
${granolaSummary || 'No session write-up available.'}

## Last session — Adam's own notes from the workspace
${coachNotes || 'No workspace notes for this session.'}

---

VOICE
- Write in your own voice, with confidence. Summarise what was said; never announce that you are reporting it. Do not open a bullet with "described", "noted", "flagged", "stated", "surfaced", "identified", or "developed" — just say the thing.
- Absorb ${clientName}'s phrasing into the writing rather than quoting it. Quote only where the exact words are the point, and no more than once or twice in the whole document.
- Telegraphic bullets. Drop articles and subject pronouns wherever the meaning survives.
- Nest supporting detail one level under the point it supports.
- Name things crisply where the conversation named them — a framework, a distinction, a decision.

DO NOT
- No judgements about ${clientName} as a person: mood, energy, defensiveness, readiness, motivation.
- No advice, coaching moves, or suggested questions for Adam.
- Never mention or cross-reference your sources. No "also captured above", "per the summary", "as noted".
- Never output an actions, next steps, or to-do section. Actions live elsewhere in the app and are displayed separately.
- Never pad. Short is the correct length when there is little to say.

Produce exactly these sections, in this order:

### ${clientName} — Session prep for ${sessionDate}

${topicsSpec}**Quick context**
- Role, company, and what the company does — one or two lines
- Working together: use the "Working together" field above verbatim if present

**Connection reminders**
Personal details Adam can reference naturally, as bullets. Partner or spouse, children's names and ages, life events, hobbies, health, pets. Use "Known personal details" above as the baseline and add anything stated in the material below. Facts only — no suggestions about how to use them.

${lastSessionSpec}

**Key people**
People mentioned, with titles where known: name, title, relationship to ${clientName}. Nothing further.`
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

    // Actions are deliberately not fetched here. PreReadPanel renders them live from
    // client_actions, which is the system of record; having the model restate them
    // produced a stale copy that could contradict the list shown directly below it.

    // Find the most recent Granola note for this client. An attendee email match is the
    // only accepted link: a title or name match cannot tell two clients who share a first
    // name apart, and attaching the wrong client's history is worse than attaching none.
    let granolaNote: GranolaNoteListItem | null = null
    if (client.email) {
      const clientEmail = client.email.toLowerCase()
      const byEmail = granolaNotes
        .filter(n => n.attendees?.some(a => a.email?.toLowerCase() === clientEmail))
        .sort((a, b) => {
          const da = new Date(a.calendar_event?.scheduled_start_time || a.created_at)
          const db = new Date(b.calendar_event?.scheduled_start_time || b.created_at)
          return db.getTime() - da.getTime()
        })

      granolaNote = byEmail.find(n => n.summary_markdown) ?? null
    }

    if (!granolaNote) {
      console.log(
        `GRANOLA_NO_EMAIL_MATCH client=${client.name} email=${client.email || 'none'} ` +
        `candidates=${granolaNotes.length} - pre-read will fall back to workspace notes`,
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

    // Topics the client sends ahead of a session get pasted into the upcoming session's own
    // workspace row. That row is excluded from the recap above on purpose, so read it
    // separately and label it for what it is. Team members can each hold a row for the same
    // event, so prefer Adam's and fall back to whichever one has content.
    const { data: upcomingRows } = await supabase
      .from('session_notes')
      .select('connection_notes, topics_content, user_id')
      .eq('calendar_event_id', event.id)

    const sessionTopics = [
      ...(upcomingRows || []).filter((r: any) => r.user_id === user_id),
      ...(upcomingRows || []),
    ]
      .map((r: any) => [extractMarkdown(r.topics_content), extractMarkdown(r.connection_notes)]
        .filter(Boolean)
        .join('\n\n'))
      .find(Boolean) || ''

    const preparedNotes: PreparedSessionNote[] = (prevNotes || [])
      .map((sn: any) => ({
        day: pacificDay(sn.session_date),
        connectionNotes: extractMarkdown(sn.connection_notes),
        topics: extractMarkdown(sn.topics_content),
      }))
      .filter(sn => sn.day && (sn.connectionNotes || sn.topics))

    // The pre-read covers one session: the last one. Granola and the workspace are paired
    // by calendar day so the "what your notes add" comparison is always about the same
    // conversation — comparing a Granola note against notes from a different session would
    // make the difference between them meaningless.
    const granolaDay = pacificDay(
      granolaNote?.calendar_event?.scheduled_start_time || granolaNote?.created_at,
    )
    const notesDay = preparedNotes[0]?.day ?? null

    // Whichever source saw the most recent session decides which session this is about.
    const lastSessionDay = [granolaDay, notesDay].filter(Boolean).sort().pop() as string | undefined
      ?? null

    const pairedNote = lastSessionDay
      ? preparedNotes.find(sn => sn.day === lastSessionDay) ?? null
      : null
    const pairedSummary = lastSessionDay && granolaDay === lastSessionDay
      ? granolaNote?.summary_markdown ?? null
      : null

    const coachNotes = pairedNote
      ? [
          pairedNote.connectionNotes ? `Connection notes:\n${pairedNote.connectionNotes}` : '',
          pairedNote.topics ? `Topics:\n${pairedNote.topics}` : '',
        ].filter(Boolean).join('\n\n')
      : ''

    console.log(
      `LAST_SESSION client=${client.name} day=${lastSessionDay ?? 'none'} ` +
      `granola_day=${granolaDay ?? 'none'} notes_days=${preparedNotes.length} ` +
      `paired_summary=${pairedSummary ? 'yes' : 'no'} paired_notes=${coachNotes ? 'yes' : 'no'} ` +
      `session_topics=${sessionTopics ? 'yes' : 'no'}`,
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
      lastSessionDay,
      granolaSummary: pairedSummary,
      coachNotes,
      sessionTopics,
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
    const generated = claudeData.content?.[0]?.text || ''

    // Splice in Granola's write-up verbatim. If the model dropped the token, append the
    // write-up rather than losing it — a misplaced section beats a missing one.
    let content = generated
    if (pairedSummary) {
      if (generated.includes(LAST_SESSION_TOKEN)) {
        content = generated.replace(LAST_SESSION_TOKEN, pairedSummary.trim())
      } else {
        console.log(`LAST_SESSION_TOKEN_MISSING client=${client.name} - appending write-up`)
        content = `${generated.trim()}\n\n**Last session — ${formatSessionDay(lastSessionDay!)}**\n${pairedSummary.trim()}`
      }
    } else if (generated.includes(LAST_SESSION_TOKEN)) {
      // No write-up to splice: strip the token so it never reaches the panel.
      content = generated.replace(LAST_SESSION_TOKEN, '').replace(/\n{3,}/g, '\n\n')
    }

    // Same treatment for the client's own topics: verbatim, and never silently dropped.
    if (sessionTopics) {
      if (content.includes(SESSION_TOPICS_TOKEN)) {
        content = content.replace(SESSION_TOPICS_TOKEN, sessionTopics.trim())
      } else {
        console.log(`SESSION_TOPICS_TOKEN_MISSING client=${client.name} - inserting topics`)
        const block = `**Topics ${client.name} sent for this session**\n${sessionTopics.trim()}`
        const heading = content.match(/^#{1,6} .*$/m)
        content = heading
          ? content.replace(heading[0], () => `${heading[0]}\n\n${block}`)
          : `${block}\n\n${content.trim()}`
      }
    } else if (content.includes(SESSION_TOPICS_TOKEN)) {
      content = content.replace(SESSION_TOPICS_TOKEN, '').replace(/\n{3,}/g, '\n\n')
    }

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
${pairedSummary || ''}
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
