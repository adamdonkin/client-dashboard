import type { ActionItem } from '@/components/ActionRow'

export const BLOCKED_QUESTION = 'What blocked you?'
export const AVOID_QUESTION = 'What will you do to avoid getting blocked again?'
export const BY_WHEN_QUESTION = 'By when?'

export interface ReviewEntry {
  date: string
  outcome: 'extended' | 'cancelled' | string
  previous_due_date?: string | null
  new_due_date?: string | null
  session_note_id?: string | null
  blocked_by?: string | null
  blocked_by_content?: any | null
  will_do?: string | null
  will_do_content?: any | null
  /** Free-text answers from before the questions were separate */
  notes?: string | null
}

/** One line per paragraph or bullet, empty ones dropped */
export function docLines(doc: any): string[] {
  const lines: string[] = []
  const walk = (node: any) => {
    if (!node) return
    if (node.type === 'paragraph' || node.type === 'heading') {
      const text = inlineText(node).trim()
      if (text) lines.push(text)
      return
    }
    for (const child of node.content ?? []) walk(child)
  }
  walk(doc)
  return lines
}

function inlineText(node: any): string {
  if (typeof node.text === 'string') return node.text
  if (node.type === 'hardBreak') return ' '
  return (node.content ?? []).map(inlineText).join('')
}

export function notDoneCount(action: Pick<ActionItem, 'review_history'>): number {
  return (action.review_history ?? []).filter((e: ReviewEntry) => e.outcome === 'extended').length
}

const LEGACY_BLOCKED = /what blocked you\?\s*([\s\S]*?)(?:\n\s*•?\s*what will you do differently\?|$)/i

/** The "What blocked you?" answer, including ones typed into the old free-text template */
export function blockedAnswer(entry: ReviewEntry): string | null {
  if (entry.blocked_by?.trim()) return entry.blocked_by.trim()
  const legacy = entry.notes?.match(LEGACY_BLOCKED)?.[1]
    ?.split('\n')
    .map(l => l.replace(/^\s*[•\-*]\s*/, '').trim())
    .filter(Boolean)
    .join('\n')
  return legacy || null
}

export interface Blocker {
  action: ActionItem
  date: string
  text: string
}

/** Every "What blocked you?" answer across the actions, newest first */
export function blockersOf(actions: ActionItem[]): Blocker[] {
  return actions
    .flatMap(action => (action.review_history ?? []).flatMap((entry: ReviewEntry) => {
      const text = blockedAnswer(entry)
      return text ? [{ action, date: entry.date, text }] : []
    }))
    .sort((a, b) => b.date.localeCompare(a.date))
}
