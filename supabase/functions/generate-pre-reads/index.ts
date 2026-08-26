import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { buildPreReadPrompt, SESSION_TOPICS_TOKEN } from './prompt.ts'

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

// Granola rate-limits well within the volume a single morning's pre-reads generate, since
// every session prepared re-reads the whole note list. A 429 is not an answer about what
// notes exist, so it must never be mistaken for one: treating it as the end of the list is
// what silently produced pre-reads with the session write-up missing and no error anywhere.
const GRANOLA_MAX_ATTEMPTS = 5

async function granolaRequest(apiKey: string, url: string): Promise<Response> {
  let attempt = 0
  while (true) {
    attempt++
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${apiKey}` } })
    if (res.ok) return res

    // A missing or forbidden note is a real answer about that note; only rate limits and
    // outages are worth waiting out.
    if (res.status !== 429 && res.status < 500) return res

    if (attempt >= GRANOLA_MAX_ATTEMPTS) {
      throw new Error(`Granola unavailable: status ${res.status} after ${attempt} attempts`)
    }

    // Honour Retry-After when Granola sends it. The jitter matters because several sessions
    // are prepared at once and lockstep retries would collide all over again.
    const retryAfter = Number(res.headers.get('retry-after'))
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : 2 ** (attempt - 1) * 500 + Math.random() * 400
    console.log(`GRANOLA_RETRY status=${res.status} attempt=${attempt} wait=${Math.round(waitMs)}ms`)
    await new Promise(resolve => setTimeout(resolve, waitMs))
  }
}

async function fetchGranolaNotes(apiKey: string, since: Date, until: Date): Promise<GranolaNoteListItem[]> {
  const all: GranolaNoteListItem[] = []
  let cursor: string | undefined
  let hasMore = true

  while (hasMore) {
    const params = new URLSearchParams({
      created_after: since.toISOString(),
      created_before: until.toISOString(),
    })
    if (cursor) params.set('cursor', cursor)
    const res = await granolaRequest(apiKey, `https://public-api.granola.ai/v1/notes?${params}`)
    // Abandoning the list mid-way would hand the model a partial history that looks whole,
    // so fail loudly and let the pre-read be marked as errored instead.
    if (!res.ok) throw new Error(`Granola note list failed with status ${res.status}`)
    const data = await res.json()
    all.push(...(data.notes || []))
    hasMore = data.hasMore === true
    cursor = data.cursor
    if (!cursor) break
  }
  return all
}

async function fetchGranolaNoteDetail(apiKey: string, noteId: string): Promise<GranolaNoteListItem | null> {
  const res = await granolaRequest(apiKey, `https://public-api.granola.ai/v1/notes/${noteId}`)
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

// Notes are serialised and screened for emptiness before they reach the prompt, so the
// prompt only ever sees sessions that actually have content.
interface PreparedSessionNote {
  day: string | null
  eventId: string | null
  connectionNotes: string
  topics: string
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

    // dry_run generates the pre-read and returns it without touching pre_reads, so a prompt
    // change can be read against real client data before it replaces anything Adam relies on.
    const { user_id, date, calendar_event_id, dry_run } = await req.json()
    if (!user_id) throw new Error('user_id is required')
    if (!calendar_event_id) throw new Error('calendar_event_id is required')
    const dryRun = dry_run === true

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

    // Which session the pre-read looks back on is the calendar's answer, not Granola's and
    // not the workspace's: the most recent booked session before this one. Deriving it from
    // whichever source happened to have the newest material meant a Granola note for the
    // session being prepped for could be read as the previous one, and a session Adam had
    // not typed notes for could go missing entirely. Cancelled events are excluded to match
    // how the dashboard RPCs compute last_session_date.
    const { data: pastEvents } = await supabase
      .from('calendar_events')
      .select('id, start_time, status')
      .eq('client_id', event.client_id)
      .eq('user_id', user_id)
      .lt('start_time', event.start_time)
      .order('start_time', { ascending: false })
      .limit(5)

    const lastSessionEvent = (pastEvents || [])
      .find((e: any) => !e.status || e.status !== 'cancelled') ?? null

    // Granola pages newest-first across the whole account, so scanning 90 days and guessing
    // from note titles was both expensive and lossy — common words in an invite title could
    // crowd the real note out of the candidate list. Bracketing the request around the known
    // session instead is one page, and the attendee email is what confirms the match.
    let granolaNote: GranolaNoteListItem | null = null
    if (granolaKey && client.email && lastSessionEvent) {
      const sessionStart = new Date(lastSessionEvent.start_time).getTime()
      const DAY_MS = 24 * 60 * 60 * 1000
      const granolaCandidates = await fetchGranolaNotes(
        granolaKey,
        new Date(sessionStart - DAY_MS),
        new Date(sessionStart + DAY_MS),
      )

      const clientEmail = client.email.toLowerCase()
      const matched: { note: GranolaNoteListItem; distanceMs: number }[] = []
      for (const n of granolaCandidates) {
        const detail = await fetchGranolaNoteDetail(granolaKey, n.id)
        if (!detail?.summary_markdown) continue
        if (!detail.attendees?.some(a => a.email?.toLowerCase() === clientEmail)) continue
        const noteTime = new Date(
          detail.calendar_event?.scheduled_start_time || detail.created_at,
        ).getTime()
        matched.push({ note: detail, distanceMs: Math.abs(noteTime - sessionStart) })
      }

      // A note written up the next morning still belongs to that session, so take the
      // closest in time rather than requiring the calendar days to line up exactly.
      matched.sort((a, b) => a.distanceMs - b.distanceMs)
      granolaNote = matched[0]?.note ?? null

      console.log(
        `GRANOLA_LOOKUP client=${client.name} session=${lastSessionEvent.start_time} ` +
        `candidates=${granolaCandidates.length} email_matched=${matched.length} ` +
        `chosen=${granolaNote ? JSON.stringify(granolaNote.title) : 'none'}`,
      )
    } else if (!lastSessionEvent) {
      console.log(`NO_PAST_SESSION client=${client.name} - no booked session before this one`)
    }

    // Create or update pre_read row as 'generating'
    if (!dryRun) await supabase
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
      .select('connection_notes, topics_content, session_date, calendar_event_id')
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
        eventId: sn.calendar_event_id ?? null,
        connectionNotes: extractMarkdown(sn.connection_notes),
        topics: extractMarkdown(sn.topics_content),
      }))
      .filter(sn => sn.day && (sn.connectionNotes || sn.topics))

    // Both sources for the recap are read against the session the calendar identified, so
    // they always describe the same conversation. Sessions that predate calendar sync have
    // no event to anchor to, so fall back to the newest notes rather than dropping the
    // section.
    const lastSessionDay = lastSessionEvent
      ? pacificDay(lastSessionEvent.start_time)
      : preparedNotes[0]?.day ?? null

    const pairedNote = lastSessionEvent
      ? preparedNotes.find(sn => sn.eventId === lastSessionEvent.id)
        ?? preparedNotes.find(sn => sn.day === lastSessionDay)
        ?? null
      : preparedNotes[0] ?? null

    // Granola was already looked up for this exact session, so the write-up needs no further
    // gating — the old day comparison here is what used to discard it.
    const pairedSummary = granolaNote?.summary_markdown ?? null

    const coachNotes = pairedNote
      ? [
          pairedNote.connectionNotes ? `Connection notes:\n${pairedNote.connectionNotes}` : '',
          pairedNote.topics ? `Topics:\n${pairedNote.topics}` : '',
        ].filter(Boolean).join('\n\n')
      : ''

    console.log(
      `LAST_SESSION client=${client.name} day=${lastSessionDay ?? 'none'} ` +
      `from_event=${lastSessionEvent ? lastSessionEvent.id : 'none'} notes_rows=${preparedNotes.length} ` +
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

    let content = generated

    // The client's own topics pass through verbatim, and are never silently dropped.
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

    if (dryRun) {
      console.log(`DRY_RUN client=${client.name} - returning pre-read without saving`)
      return new Response(
        JSON.stringify({ success: true, dry_run: true, client: client.name, content }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
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
      const { user_id, calendar_event_id, dry_run } = await req.clone().json()
      if (user_id && calendar_event_id && dry_run !== true) {
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
