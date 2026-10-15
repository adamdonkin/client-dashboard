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
