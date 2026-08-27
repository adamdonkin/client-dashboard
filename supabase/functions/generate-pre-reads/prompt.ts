// Pre-read prompt construction. Kept in its own module so it can be exercised without
// starting the function's HTTP server or writing to the database.

// Topics the client sent ahead of the session are their own words, usually pasted in from
// Slack. They pass through verbatim: the client's own framing of what they want to discuss
// is the useful part, and restating it loses it.
export const SESSION_TOPICS_TOKEN = '{{SESSION_TOPICS}}'

export function formatSessionDay(day: string): string {
  // `day` is already a Pacific calendar date, so parse as local noon to avoid re-shifting.
  const d = new Date(`${day}T12:00:00`)
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export function buildPreReadPrompt(context: {
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

  // Granola's write-up is source material, not output. Splicing it in verbatim left the
  // work of deciding what mattered to the moment Adam was walking into the session, which
  // is the one moment the pre-read exists to cover. Adam's notes fold into the same section
  // rather than a separate list, so the recap reads as a single account of the conversation.
  const lastSessionSpec = `**Where you left off — ${lastSessionLabel || 'date unknown'}**
Write the recap of that session here, from the sources above. This is the substance of the pre-read.
- Group by theme, usually four to seven themes. Open each theme with a bold sentence that states the point, then two to four sentences carrying the detail.
- Select rather than cover. Carry the threads Adam needs to walk in remembering; leave the rest out. A recap he can read is worth more than a complete one.
- Specifics are what make it useful: names, numbers, dates, commitments, and the exact distinctions the conversation drew.${granolaSummary ? '\n- The write-up above is already a note tree. Carry its content, not its shape.' : ''}`

  // Sits directly ahead of the recap so what the client wants to cover reads against what
  // they left off on. Dropped entirely when nothing was captured rather than printed as an
  // empty heading.
  const topicsSpec = sessionTopics
    ? `**Topics ${clientName} sent for this session**
${SESSION_TOPICS_TOKEN}

Output the token ${SESSION_TOPICS_TOKEN} on a line by itself, exactly as written, and nothing else on that line. The topics are inserted there automatically in ${clientName}'s own words. Do not restate, summarise, or comment on them, and do not repeat them in any later section.

`
    : ''

  return `You are writing a pre-read for Adam Donkin's upcoming coaching session with ${clientName}.

Adam reads this in the minutes before the session. It has one job: he walks in remembering
what matters from last time, so ${clientName} never has to recap and feels like Adam's only
client. Everything in it earns its place against that.

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

## Last session${lastSessionLabel ? ` (${lastSessionLabel})` : ''} — Granola's write-up, as source material
${granolaSummary || 'No session write-up available.'}

## Last session — Adam's own notes from the workspace
${coachNotes || 'No workspace notes for this session.'}

---

VOICE
- Write in your own voice, with confidence. Summarise what was said; never announce that you are reporting it. Do not open a sentence or bullet with "described", "noted", "flagged", "stated", "surfaced", "identified", or "developed" — just say the thing.
- Absorb ${clientName}'s phrasing into the writing rather than quoting it. Quote only where the exact words are the point, and no more than once or twice in the whole document.
- The recap section is written prose in short paragraphs. Quick context, connection reminders, and key people are bullets — keep those telegraphic, dropping articles and subject pronouns wherever the meaning survives.
- Never nest more than one level deep, in any section.
- Name things crisply where the conversation named them — a framework, a distinction, a decision.

DO NOT
- No judgements about ${clientName} as a person: mood, energy, defensiveness, readiness, motivation.
- No advice, coaching moves, or suggested questions for Adam.
- Never mention or cross-reference your sources. No "also captured above", "per the write-up", "as noted".
- Never output an actions, next steps, or to-do section. Actions live elsewhere in the app and are displayed separately.
- Never pad. Short is the correct length when there is little to say.

Produce exactly these sections, in this order:

### ${clientName} — Session prep for ${sessionDate}

**Quick context**
- Role, company, and what the company does — one or two lines
- Working together: use the "Working together" field above verbatim if present

**Connection reminders**
Personal details Adam can reference naturally, as bullets. Partner or spouse, children's names and ages, life events, hobbies, health, pets. Use "Known personal details" above as the baseline and add anything stated in the material below. Facts only — no suggestions about how to use them.

${topicsSpec}${lastSessionSpec}

**Key people**
People mentioned, with titles where known: name, title, relationship to ${clientName}. Nothing further.`
}
