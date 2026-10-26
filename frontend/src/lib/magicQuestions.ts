import type { SupabaseClient } from '@supabase/supabase-js'

export const MAGIC_QUESTIONS_HEADING = 'Magic Questions'

export interface MagicQuestionsRound {
  sessionNoteId: string
  sessionDate: string
  /** The Magic Questions section as a Tiptap doc: the heading and everything up to the next heading */
  content: any
}

function nodeText(node: any): string {
  if (!node) return ''
  if (typeof node.text === 'string') return node.text
  return (node.content ?? []).map(nodeText).join('')
}

/** The first Magic Questions section in a note doc, or null */
export function magicQuestionsSection(doc: any): any | null {
  const nodes: any[] = doc?.content ?? []
  const start = nodes.findIndex(n => n.type === 'heading' && nodeText(n).trim() === MAGIC_QUESTIONS_HEADING)
  if (start < 0) return null
  let end = start + 1
  while (end < nodes.length && nodes[end].type !== 'heading') end++
  return { type: 'doc', content: nodes.slice(start, end) }
}

/** Whether a position sits in a Magic Questions section: under its heading, up to the next heading. Takes a ProseMirror doc. */
export function inMagicQuestionsAt(doc: any, pos: number): boolean {
  let inside = false
  doc.forEach((node: any, offset: number) => {
    if (offset < pos && node.type.name === 'heading') inside = node.textContent.trim() === MAGIC_QUESTIONS_HEADING
  })
  return inside
}

export const CAREER_VISION_QUESTION = 'What is your five-year career vision?'

/** The answer bullets under the career vision question in a round, or null if it wasn't answered */
export function careerVisionOf(section: any): any | null {
  for (const list of section?.content ?? []) {
    if (list.type !== 'bulletList') continue
    for (const item of list.content ?? []) {
      const [first, nested] = item.content ?? []
      if (!nodeText(first).trim().startsWith(CAREER_VISION_QUESTION)) continue
      return nested?.type === 'bulletList' && nodeText(nested).trim() ? nested : null
    }
  }
  return null
}

export type ScoreKey = 'vision' | 'work' | 'personal' | 'company' | 'peers'

/** The five rating questions, in template order */
export const SCORE_QUESTIONS: { key: ScoreKey; label: string; matches: RegExp }[] = [
  { key: 'vision', label: 'Heading toward your vision', matches: /toward your career vision/i },
  { key: 'work', label: 'Life at work', matches: /life at work/i },
  { key: 'personal', label: 'Personal life', matches: /personal life/i },
  { key: 'company', label: 'The company', matches: /performing as a company/i },
  { key: 'peers', label: 'Working with peers', matches: /work with your peers/i },
]

// Checked in order: "work with your peers" also mentions work
const LOWEST_MATCHES: [ScoreKey, RegExp][] = [
  ['peers', /peer/i],
  ['personal', /personal|home|family/i],
  ['company', /company/i],
  ['vision', /vision|career|toward/i],
  ['work', /work/i],
]

export type RoundScores = Record<ScoreKey, number | null>

export interface ParsedRound {
  vision: any | null
  scores: RoundScores
  lowest: ScoreKey | null
}

/** Scores, lowest pick and vision from a round's section */
export function parseRound(section: any): ParsedRound {
  const scores = Object.fromEntries(SCORE_QUESTIONS.map(q => [q.key, null])) as RoundScores
  let lowestText: string | null = null
  for (const list of section?.content ?? []) {
    if (list.type !== 'bulletList') continue
    for (const item of list.content ?? []) {
      const text = nodeText(item.content?.[0]).trim()
      const question = SCORE_QUESTIONS.find(q => q.matches.test(text))
      if (question) {
        const answer = text.slice(text.lastIndexOf('?') + 1).match(/\b([1-5](?:\.5)?)\b/)
        if (answer) scores[question.key] = Number(answer[1])
      } else if (/^lowest score:/i.test(text)) {
        lowestText = text.replace(/^lowest score:/i, '').trim()
      }
    }
  }

  let lowest = lowestText ? LOWEST_MATCHES.find(([, re]) => re.test(lowestText!))?.[0] ?? null : null
  if (!lowest) {
    // Nothing named: the single lowest score, if there's no tie
    const answered = SCORE_QUESTIONS.filter(q => scores[q.key] !== null)
    const min = Math.min(...answered.map(q => scores[q.key]!))
    const atMin = answered.filter(q => scores[q.key] === min)
    if (atMin.length === 1 && answered.length > 1) lowest = atMin[0].key
  }

  return { vision: careerVisionOf(section), scores, lowest }
}

/** The vision as comparable text, so an unchanged prefill doesn't count as a new version */
export function visionText(vision: any | null): string {
  return vision ? nodeText(vision).replace(/\s+/g, ' ').trim() : ''
}

function roundRow(parsed: ParsedRound) {
  return {
    vision: parsed.vision,
    score_vision: parsed.scores.vision,
    score_work: parsed.scores.work,
    score_personal: parsed.scores.personal,
    score_company: parsed.scores.company,
    score_peers: parsed.scores.peers,
    lowest: parsed.lowest,
  }
}

const ROUND_COLUMNS = 'session_note_id, vision, score_vision, score_work, score_personal, score_company, score_peers, lowest'

/** Saves a session note's round, or removes it when the note no longer has one */
export async function saveMagicRound(
  supabase: SupabaseClient,
  { clientId, sessionNoteId, sessionDate, section }: { clientId: string; sessionNoteId: string; sessionDate: string; section: any | null },
) {
  if (!section) {
    const { error } = await supabase.from('magic_question_rounds').delete().eq('session_note_id', sessionNoteId)
    if (error) console.error('Error removing Magic Questions round:', error)
    return
  }
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return
  const { error } = await supabase.from('magic_question_rounds').upsert(
    {
      user_id: session.user.id,
      client_id: clientId,
      session_note_id: sessionNoteId,
      session_date: sessionDate,
      ...roundRow(parseRound(section)),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'session_note_id' },
  )
  if (error) console.error('Error saving Magic Questions round:', error)
}

/** The latest saved vision from another session, for prefilling /magic */
export async function latestSavedVision(supabase: SupabaseClient, clientId: string, excludeSessionNoteId: string): Promise<any | null> {
  const { data, error } = await supabase
    .from('magic_question_rounds')
    .select('vision')
    .eq('client_id', clientId)
    .neq('session_note_id', excludeSessionNoteId)
    .not('vision', 'is', null)
    .order('session_date', { ascending: false })
    .limit(1)
  if (error) console.error('Error loading saved vision:', error)
  return data?.[0]?.vision ?? null
}

export interface MagicRoundWithScores extends MagicQuestionsRound, ParsedRound {}

/**
 * Rounds from session notes with their scores, newest first. Saves any round
 * that isn't saved yet or has changed since, and drops saved rounds whose
 * note no longer has a Magic Questions section.
 */
export async function loadMagicHistory(supabase: SupabaseClient, clientId: string): Promise<MagicRoundWithScores[]> {
  const [rounds, saved] = await Promise.all([
    fetchMagicQuestions(supabase, clientId),
    supabase.from('magic_question_rounds').select(ROUND_COLUMNS).eq('client_id', clientId),
  ])
  if (saved.error) console.error('Error loading saved Magic Questions:', saved.error)
  const savedByNote = new Map((saved.data ?? []).map((r: any) => [r.session_note_id, r]))

  const withScores = rounds.map(r => ({ ...r, ...parseRound(r.content) }))

  const stale = withScores.filter(r => {
    const row = savedByNote.get(r.sessionNoteId)
    if (!row) return true
    const current = roundRow(r)
    return (Object.keys(current) as (keyof typeof current)[]).some(k =>
      k === 'vision'
        ? visionText(row.vision) !== visionText(current.vision)
        : (row[k] === null ? null : k === 'lowest' ? row[k] : Number(row[k])) !== current[k])
  })
  const orphans = [...savedByNote.keys()].filter(id => !rounds.some(r => r.sessionNoteId === id))

  if (saved.data && (stale.length || orphans.length)) {
    await Promise.all([
      ...stale.map(r => saveMagicRound(supabase, { clientId, sessionNoteId: r.sessionNoteId, sessionDate: r.sessionDate, section: r.content })),
      ...orphans.map(id => saveMagicRound(supabase, { clientId, sessionNoteId: id, sessionDate: '', section: null })),
    ])
  }
  return withScores
}

export interface VisionVersion {
  vision: any
  /** The round the version was first written in */
  sessionNoteId: string
  from: string
  /** When the next version replaced it; null for the current one */
  to: string | null
}

/** Each distinct vision, newest first. Rounds that repeat the previous vision or skip it aren't new versions. */
export function visionVersions(rounds: MagicRoundWithScores[]): VisionVersion[] {
  const versions: VisionVersion[] = []
  for (const round of [...rounds].reverse()) {
    if (!round.vision) continue
    const last = versions[versions.length - 1]
    if (last && visionText(last.vision) === visionText(round.vision)) continue
    if (last) last.to = round.sessionDate
    versions.push({ vision: round.vision, sessionNoteId: round.sessionNoteId, from: round.sessionDate, to: null })
  }
  return versions.reverse()
}

/** The vision bullets from an edited doc: its lists' items, plus any loose paragraphs as items */
export function visionFromDoc(doc: any): any | null {
  const items = (doc?.content ?? []).flatMap((node: any) => {
    if (node.type === 'bulletList') return node.content ?? []
    return nodeText(node).trim() ? [{ type: 'listItem', content: [node] }] : []
  })
  const vision = { type: 'bulletList', content: items }
  return nodeText(vision).trim() ? vision : null
}

/** A copy of a note doc with the first Magic Questions section's vision replaced, or null if it has no vision question */
function withCareerVision(doc: any, vision: any): any | null {
  const nodes: any[] = doc?.content ?? []
  const start = nodes.findIndex(n => n.type === 'heading' && nodeText(n).trim() === MAGIC_QUESTIONS_HEADING)
  if (start < 0) return null
  const copy = structuredClone(doc)
  for (let i = start + 1; i < nodes.length && nodes[i].type !== 'heading'; i++) {
    if (nodes[i].type !== 'bulletList') continue
    const items: any[] = copy.content[i].content ?? []
    const at = items.findIndex(item => nodeText(item.content?.[0]).trim().startsWith(CAREER_VISION_QUESTION))
    if (at < 0) continue
    const [first, nested, ...rest] = items[at].content
    items[at].content = nested?.type === 'bulletList' ? [first, vision, ...rest] : [first, vision, ...[nested, ...rest].filter(Boolean)]
    return copy
  }
  return null
}

const NOTE_FIELDS = ['connection_notes', 'topics_content', 'feedback_content'] as const

/**
 * Rewrites the current vision in place: in every session note that carries it,
 * so later rounds that repeated it don't show up as the old wording.
 */
export async function editCurrentVision(
  supabase: SupabaseClient,
  clientId: string,
  rounds: MagicRoundWithScores[],
  vision: any,
): Promise<boolean> {
  const current = visionVersions(rounds)[0]
  if (!current) return false
  const currentText = visionText(current.vision)
  const since = new Date(current.from).getTime()
  const carrying = rounds.filter(r => new Date(r.sessionDate).getTime() >= since && visionText(r.vision) === currentText)

  const results = await Promise.all(carrying.map(async round => {
    const { data: note, error } = await supabase
      .from('session_notes')
      .select(NOTE_FIELDS.join(', '))
      .eq('id', round.sessionNoteId)
      .single()
    if (error || !note) {
      console.error('Error loading note to edit vision:', error)
      return false
    }
    const field = NOTE_FIELDS.find(f => magicQuestionsSection((note as any)[f]))
    const updated = field && withCareerVision((note as any)[field], vision)
    if (!field || !updated) return false
    const { error: saveError } = await supabase
      .from('session_notes')
      .update({ [field]: updated, updated_at: new Date().toISOString() })
      .eq('id', round.sessionNoteId)
    if (saveError) {
      console.error('Error saving edited vision:', saveError)
      return false
    }
    await saveMagicRound(supabase, {
      clientId,
      sessionNoteId: round.sessionNoteId,
      sessionDate: round.sessionDate,
      section: magicQuestionsSection(updated),
    })
    return true
  }))
  return results.every(Boolean)
}

export async function fetchMagicQuestions(supabase: SupabaseClient, clientId: string): Promise<MagicQuestionsRound[]> {
  const { data, error } = await supabase.rpc('get_magic_questions_by_client', { p_client_id: clientId })
  if (error) {
    console.error('Error loading Magic Questions:', error.message || error)
    return []
  }
  return (data ?? []).flatMap((row: any) => {
    const content = [row.connection_notes, row.topics_content, row.feedback_content]
      .map(magicQuestionsSection)
      .find(Boolean)
    return content ? [{ sessionNoteId: row.session_note_id, sessionDate: row.session_date, content }] : []
  })
}
