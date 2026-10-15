import { addDays, addYears, endOfMonth, endOfQuarter, endOfYear, format, isValid, parse, parseISO, subDays } from 'date-fns'
import type { SupabaseClient } from '@supabase/supabase-js'
import { pacificToday } from '@/lib/sessionsByWeek'

export type GoalHealth = 'off_track' | 'at_risk' | 'on_track'
export type GoalStatus = 'open' | 'completed' | 'dropped'

export interface Goal {
  id: string
  client_id: string
  session_note_id: string | null
  priority: number | null
  title: string
  owner: string | null
  due_date: string | null
  status: GoalStatus
  last_reviewed_at: string | null
  created_at: string
  /** Status and date of the latest update, for lists */
  latest_update: { health: GoalHealth | null; created_at: string } | null
}

export interface GoalUpdate {
  id: string
  goal_id: string
  session_note_id: string | null
  created_at: string
  health: GoalHealth | null
  whats_good: any | null
  whats_not_good: any | null
  fix_plan: any | null
  from_notes: boolean
}

export const GOAL_COLUMNS = 'id, client_id, session_note_id, priority, title, owner, due_date, status, last_reviewed_at, created_at, goal_updates(health, created_at)'
export const GOAL_UPDATE_COLUMNS = 'id, goal_id, session_note_id, created_at, health, whats_good, whats_not_good, fix_plan, from_notes'

/** A goal row as selected with GOAL_COLUMNS, with its updates folded into latest_update */
export function toGoal(row: any): Goal {
  const { goal_updates, ...goal } = row
  const latest = [...(goal_updates ?? [])].sort((a: any, b: any) => b.created_at.localeCompare(a.created_at))[0]
  return { ...goal, latest_update: latest ?? null }
}

export async function fetchGoal(supabase: SupabaseClient, id: string): Promise<Goal | null> {
  const { data, error } = await supabase.from('client_goals').select(GOAL_COLUMNS).eq('id', id).single()
  if (error) console.error('Error loading goal:', error)
  return data ? toGoal(data) : null
}

export function latestUpdateOf(goal: Goal, updates: GoalUpdate[]): Goal {
  const latest = updates[0]
  return { ...goal, latest_update: latest ? { health: latest.health, created_at: latest.created_at } : null }
}

// Fallbacks for when get_enum_values is unavailable; the database is the source of truth
export const DEFAULT_GOAL_HEALTH: GoalHealth[] = ['off_track', 'at_risk', 'on_track']

export const GOAL_HEALTH_META: Record<GoalHealth, { emoji: string; label: string; dotClass: string }> = {
  off_track: { emoji: '🔴', label: 'Off track', dotClass: 'bg-danger' },
  at_risk: { emoji: '🟡', label: 'At risk', dotClass: 'bg-warning' },
  on_track: { emoji: '🟢', label: 'On track', dotClass: 'bg-success' },
}

export const GOAL_TITLE_PLACEHOLDER = 'Goal you intend to accomplish'

export const GOAL_QUESTIONS = [
  { key: 'whats_good', label: 'What’s good?' },
  { key: 'whats_not_good', label: 'What’s not good?' },
  { key: 'fix_plan', label: 'What will you do to fix the not good?' },
] as const

export type GoalAnswerKey = typeof GOAL_QUESTIONS[number]['key']

export function sortGoals(goals: Goal[]): Goal[] {
  return [...goals].sort((a, b) =>
    (a.priority ?? Number.MAX_SAFE_INTEGER) - (b.priority ?? Number.MAX_SAFE_INTEGER)
    || a.created_at.localeCompare(b.created_at)
  )
}

export function goalPrefix(priority: number | null): string {
  return priority ? `#${priority}. ` : ''
}

export function formatGoalDue(due: string | null): string {
  return due ? format(parseISO(due.slice(0, 10)), 'MMM d') : ''
}

const statusLine = (health: GoalHealth | null) =>
  health
    ? `${GOAL_HEALTH_META[health].emoji} ${GOAL_HEALTH_META[health].label}`
    : DEFAULT_GOAL_HEALTH.map(h => `${GOAL_HEALTH_META[h].emoji} ${GOAL_HEALTH_META[h].label}`).join('  |  ')

export const emptySubBullet = () => ({ type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] })

/** The Goal template as Tiptap nodes, filled in from a goal. */
export function goalNodes(goal: {
  id?: string
  priority: number | null
  title: string
  owner?: string | null
  due_date?: string | null
  health?: GoalHealth | null
  whats_good?: any
  whats_not_good?: any
  fix_plan?: any
}): any[] {
  const bold = (text: string, extra: any[] = []) => ({ type: 'text', marks: [{ type: 'bold' }, ...extra], text })
  const answer = (doc: any) => docHasText(doc) ? doc.content : [emptySubBullet()]
  const item = (content: any[], nested?: any[]) => ({
    type: 'listItem',
    content: [{ type: 'paragraph', content }, ...(nested ?? [])],
  })
  return [
    {
      type: 'heading',
      attrs: { level: 3, ...(goal.id ? { goalId: goal.id } : {}) },
      content: [{ type: 'text', text: `${goalPrefix(goal.priority)}${goal.title}` }],
    },
    { type: 'bulletList', content: [
      item([{ type: 'text', text: `Owner: ${goal.owner ?? ''}` }]),
      item([{ type: 'text', text: `Due: ${formatGoalDue(goal.due_date ?? null)}` }]),
      item([{ type: 'text', text: `Status: ${statusLine(goal.health ?? null)}` }]),
      item([bold('What’s good?')], answer(goal.whats_good)),
      item([bold('What’s not good?')], answer(goal.whats_not_good)),
      item([bold('What will you do to fix the '), bold('not good', [{ type: 'italic' }]), bold('?')], answer(goal.fix_plan)),
    ]},
  ]
}

export function docHasText(node: any): boolean {
  if (!node) return false
  if (typeof node.text === 'string' && node.text.trim()) return true
  if (node.type === 'image') return true
  return Array.isArray(node.content) && node.content.some(docHasText)
}

function nodeText(node: any): string {
  if (!node) return ''
  if (typeof node.text === 'string') return node.text
  return (node.content ?? []).map(nodeText).join('')
}

const DUE_FORMATS = ['MMM d, yyyy', 'MMMM d, yyyy', 'MMM d', 'MMMM d', 'M/d/yyyy', 'M/d/yy', 'M/d', 'yyyy-MM-dd']

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

/** "today", "tomorrow", "Friday", "next Friday", "next week", "end of month" */
function parseRelativeDue(text: string, today: Date): Date | null {
  const t = text.toLowerCase().replace(/\s+/g, ' ')
  if (t === 'today' || t === 'tonight' || t === 'eod') return today
  if (t === 'tomorrow') return addDays(today, 1)
  if (t === 'next week') return addDays(today, 7)
  if (t === 'end of week' || t === 'eow') return addDays(today, (5 - today.getDay() + 7) % 7)
  if (t === 'end of month' || t === 'eom') return endOfMonth(today)
  if (t === 'end of quarter' || t === 'eoq') return endOfQuarter(today)
  if (t === 'end of year' || t === 'eoy') return endOfYear(today)

  const weekday = t.match(/^(next |this )?([a-z]+)$/)
  const index = weekday ? WEEKDAYS.findIndex(d => d === weekday[2] || d.slice(0, 3) === weekday[2]) : -1
  if (index >= 0) {
    // "Friday" is the coming Friday, today if it's Friday; "next Friday" is the one after
    const ahead = (index - today.getDay() + 7) % 7
    return addDays(today, ahead + (weekday![1] === 'next ' ? 7 : 0))
  }
  return null
}

/** "Oct 30", "October 30, 2026", "10/30", "today", "Friday" → "2026-10-30". A date with no year is the next one coming up. */
export function parseGoalDue(text: string): string | null {
  const clean = text.trim().replace(/(\d)(st|nd|rd|th)\b/i, '$1').replace(/\.$/, '')
  if (!clean) return null
  // Pacific calendar day, at noon so date arithmetic never slips across midnight
  const today = parseISO(`${pacificToday()}T12:00:00`)
  const relative = parseRelativeDue(clean, today)
  if (relative) return format(relative, 'yyyy-MM-dd')
  for (const f of DUE_FORMATS) {
    let d = parse(clean, f, today)
    if (!isValid(d)) continue
    if (!f.includes('y') && d < subDays(today, 60)) d = addYears(d, 1)
    return format(d, 'yyyy-MM-dd')
  }
  return null
}

function parseHealth(text: string): GoalHealth | null {
  const found = DEFAULT_GOAL_HEALTH.filter(h => text.includes(GOAL_HEALTH_META[h].emoji))
  return found.length === 1 ? found[0] : null
}

export interface GoalFromNote {
  priority: number | null
  title: string
  owner: string | null
  due_date: string | null
  health: GoalHealth | null
  whats_good: any | null
  whats_not_good: any | null
  fix_plan: any | null
}

/**
 * Reads every goal written in a note: a top-level heading linked to a goal,
 * and the template bullets that follow it. A goal heading pasted twice only
 * counts once.
 */
export function goalsInNote(doc: any): Map<string, GoalFromNote> {
  const goals = new Map<string, GoalFromNote>()
  const nodes: any[] = doc?.content ?? []
  nodes.forEach((node, i) => {
    const goalId = node.type === 'heading' ? node.attrs?.goalId : null
    if (!goalId || goals.has(goalId)) return

    const headingText = nodeText(node).trim()
    const match = headingText.match(/^#(\d+)\.\s*(.*)$/)
    const goal: GoalFromNote = {
      priority: match ? Number(match[1]) : null,
      title: (match ? match[2] : headingText).trim() || GOAL_TITLE_PLACEHOLDER,
      owner: null,
      due_date: null,
      health: null,
      whats_good: null,
      whats_not_good: null,
      fix_plan: null,
    }

    for (let j = i + 1; j < nodes.length && nodes[j].type !== 'heading'; j++) {
      if (nodes[j].type !== 'bulletList') continue
      for (const item of nodes[j].content ?? []) {
        const [first, ...rest] = item.content ?? []
        const text = nodeText(first).trim().replace(/’/g, "'")
        const answer = docHasText({ content: rest }) ? { type: 'doc', content: rest } : null
        if (/^owner:/i.test(text)) goal.owner = text.replace(/^owner:\s*/i, '') || null
        else if (/^due:/i.test(text)) goal.due_date = parseGoalDue(text.replace(/^due:\s*/i, ''))
        else if (/^status:/i.test(text)) goal.health = parseHealth(text)
        else if (/^what's good/i.test(text)) goal.whats_good = answer
        else if (/^what's not good/i.test(text)) goal.whats_not_good = answer
        else if (/^what will you do to fix/i.test(text)) goal.fix_plan = answer
      }
      break
    }

    goals.set(goalId, goal)
  })
  return goals
}

/**
 * The goal whose template a position sits in: the goal heading it falls under,
 * up to the next heading. Same reach as goalsInNote. Takes a ProseMirror doc.
 */
export function goalIdAt(doc: any, pos: number): string | null {
  let goalId: string | null = null
  doc.forEach((node: any, offset: number) => {
    if (offset < pos && node.type.name === 'heading') goalId = node.attrs.goalId ?? null
  })
  return goalId
}

export function goalNumbersInDoc(doc: any): number[] {
  return (doc?.content ?? [])
    .filter((n: any) => n.type === 'heading')
    .map((n: any) => nodeText(n).match(/^#(\d+)\./))
    .filter(Boolean)
    .map((m: RegExpMatchArray) => Number(m[1]))
}
