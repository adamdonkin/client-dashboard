import type { SupabaseClient } from '@supabase/supabase-js'

const TIME_ZONE = 'America/Los_Angeles'

// The Avg Sessions card and the default panel range both average this many
// full weeks, so their figures always agree.
export const AVERAGE_WEEKS = 12

export interface WeekCounts {
  week_start: string // Monday, YYYY-MM-DD, Pacific time
  completed: number
  scheduled: number
  cancelled: number
}

export function pacificToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TIME_ZONE })
}

// Dates are handled as UTC midnight so adding days never crosses a DST shift.
function parseDay(key: string): Date {
  return new Date(`${key}T00:00:00Z`)
}

export function addDays(key: string, days: number): string {
  const d = parseDay(key)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function mondayOf(key: string): string {
  const dow = parseDay(key).getUTCDay()
  return addDays(key, -((dow + 6) % 7))
}

export function weekLabel(key: string): string {
  return parseDay(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export async function fetchSessionsByWeek(supabase: SupabaseClient, start: string) {
  const { data, error } = await supabase.rpc('get_sessions_by_week', { p_start: start })
  return { weeks: (data || []) as WeekCounts[], error }
}

/** Average completed sessions over the full weeks in `weeks`; the current week is skipped. */
export function averageCompleted(weeks: WeekCounts[], currentMonday: string): number {
  const full = weeks.filter(w => w.week_start < currentMonday)
  if (full.length === 0) return 0
  return Math.round((full.reduce((sum, w) => sum + w.completed, 0) / full.length) * 10) / 10
}
