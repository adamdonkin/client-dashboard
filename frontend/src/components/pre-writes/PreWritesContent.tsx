'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { format, parseISO, startOfWeek, addDays } from 'date-fns'
import { Loader2, Copy, Check, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { ActionItem } from '@/components/ActionRow'
import { extractDescriptionLines } from '@/utils/copy-actions'

interface ClientSession {
  eventId: string
  clientId: string
  clientName: string
  firstName: string
  companyName: string | null
  email: string | null
  slack: string | null
  startTime: string
  dayLabel: string
}

interface UnmatchedEvent {
  id: string
  title: string
  startTime: string
  dayLabel: string
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

function getWeekRange(): { start: Date; end: Date; label: string } {
  const now = new Date()
  const monday = startOfWeek(now, { weekStartsOn: 1 })
  const friday = addDays(monday, 4)
  return {
    start: monday,
    end: friday,
    label: `Week of ${format(monday, 'MMMM d')} – ${format(friday, 'd, yyyy')}`,
  }
}

function formatActionLines(actions: ActionItem[]): string {
  const open = actions.filter(a => a.status === 'to_do')
  if (open.length === 0) return ''

  const lines: string[] = []
  for (const a of open) {
    const date = a.due_date
      ? ` by ${format(parseISO(a.due_date.length > 10 ? a.due_date.slice(0, 10) : a.due_date), 'MMM d')}`
      : ''
    lines.push(`• ${a.title}${date}`)
    const desc = extractDescriptionLines(a.description_content, a.description)
    for (const d of desc) {
      lines.push(`  ◦ ${d}`)
    }
  }
  return lines.join('\n')
}

function buildMessage(
  firstName: string,
  dayLabel: string,
  channel: 'slack' | 'email',
  actionText: string,
): string {
  const actionsBlock = actionText
    ? `\n\nYour current actions:\n${actionText}`
    : ''

  if (channel === 'slack') {
    return `Hi ${firstName}. Looking forward to our session on ${dayLabel}. Please send the topic(s) you'd like to discuss. Thanks!${actionsBlock}`
  }

  return `Hi ${firstName},\n\nLooking forward to our session on ${dayLabel}. Please send the topic(s) you'd like to discuss. Thanks!${actionsBlock}\n\nBest,\nAdam`
}

export function PreWritesContent() {
  const supabase = createClientComponentClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [sessionsByDay, setSessionsByDay] = useState<Map<string, ClientSession[]>>(new Map())
  const [unmatchedEvents, setUnmatchedEvents] = useState<UnmatchedEvent[]>([])
  const [actionsMap, setActionsMap] = useState<Map<string, ActionItem[]>>(new Map())
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [copiedSlackId, setCopiedSlackId] = useState<string | null>(null)
  const [sentSet, setSentSet] = useState<Set<string>>(new Set())

  const weekRange = getWeekRange()

  const fetchData = useCallback(async () => {
    setLoading(true)

    const monday = weekRange.start
    const fridayEnd = addDays(weekRange.end, 1)

    const pacificRef = new Date(monday.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
    const offsetMs = monday.getTime() - pacificRef.getTime()
    const weekStart = new Date(monday.getTime() + offsetMs).toISOString()
    const weekEnd = new Date(fridayEnd.getTime() + offsetMs).toISOString()

    const [eventsRes, clientsRes, sentRes] = await Promise.all([
      supabase
        .from('calendar_events')
        .select('id, title, start_time, client_id, status, clients(id, name, email, slack, company_name)')
        .gte('start_time', weekStart)
        .lt('start_time', weekEnd)
        .or('status.is.null,status.neq.cancelled')
        .order('start_time', { ascending: true }),
      supabase
        .from('clients')
        .select('id, name, email, slack, company_name')
        .eq('is_active', true),
      supabase
        .from('pre_write_sent')
        .select('calendar_event_id'),
    ])

    setSentSet(new Set((sentRes.data || []).map((r: any) => r.calendar_event_id)))

    const events = eventsRes.data || []
    const activeClients = new Set((clientsRes.data || []).map((c: any) => c.id))

    const matched: ClientSession[] = []
    const unmatched: UnmatchedEvent[] = []

    for (const e of events as any[]) {
      const eventDate = parseISO(e.start_time)
      const dayLabel = format(eventDate, 'EEEE')

      if (e.client_id && activeClients.has(e.client_id) && e.clients) {
        const fullName: string = e.clients.name || e.title
        const nameParts = fullName.split(' ')
        matched.push({
          eventId: e.id,
          clientId: e.client_id,
          clientName: fullName,
          firstName: nameParts[0],
          companyName: e.clients.company_name || null,
          email: e.clients.email || null,
          slack: e.clients.slack || null,
          startTime: e.start_time,
          dayLabel,
        })
      } else if (!e.client_id) {
        unmatched.push({
          id: e.id,
          title: e.title,
          startTime: e.start_time,
          dayLabel,
        })
      }
    }

    const byDay = new Map<string, ClientSession[]>()
    for (const day of DAY_NAMES) {
      const daySessions = matched.filter(s => s.dayLabel === day)
      if (daySessions.length > 0) {
        byDay.set(day, daySessions)
      }
    }

    setSessionsByDay(byDay)
    setUnmatchedEvents(unmatched)

    const clientIds = [...new Set(matched.map(s => s.clientId))]
    if (clientIds.length > 0) {
      const { data: actions } = await supabase
        .from('client_actions')
        .select('id, title, description, description_content, source, source_url, session_note_id, due_date, status, review_history, created_at, client_id')
        .in('client_id', clientIds)
        .eq('status', 'to_do')
        .order('due_date', { ascending: true, nullsFirst: false })

      const aMap = new Map<string, ActionItem[]>()
      for (const a of (actions || []) as any[]) {
        const list = aMap.get(a.client_id) || []
        list.push(a)
        aMap.set(a.client_id, list)
      }
      setActionsMap(aMap)
    }

    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const toggleSent = async (eventId: string) => {
    const isSent = sentSet.has(eventId)
    const next = new Set(sentSet)

    if (isSent) {
      next.delete(eventId)
      setSentSet(next)
      await supabase.from('pre_write_sent').delete().eq('calendar_event_id', eventId)
    } else {
      next.add(eventId)
      setSentSet(next)
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        await supabase.from('pre_write_sent').insert({
          calendar_event_id: eventId,
          sent_by: session.user.id,
        })
      }
    }
  }

  const handleCopy = async (session: ClientSession) => {
    const channel: 'slack' | 'email' = session.slack ? 'slack' : 'email'
    const actions = actionsMap.get(session.clientId) || []
    const actionText = formatActionLines(actions)
    const message = buildMessage(session.firstName, session.dayLabel, channel, actionText)

    await navigator.clipboard.writeText(message)
    setCopiedId(session.eventId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const totalClients = Array.from(sessionsByDay.values()).reduce((sum, arr) => sum + arr.length, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-medium text-foreground">
          {weekRange.label}
        </span>
        {!loading && totalClients > 0 && (
          <span className="text-[13px] text-muted-foreground">
            {sentSet.size}/{totalClients} sent
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-3 text-[14px] text-muted-foreground">Loading sessions...</span>
        </div>
      ) : totalClients === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground">No coaching sessions this week</p>
        </div>
      ) : (
        <div className="space-y-6">
          {DAY_NAMES.map(day => {
            const daySessions = sessionsByDay.get(day)
            if (!daySessions) return null

            return (
              <div key={day}>
                <h2 className="text-[12px] font-medium text-muted-foreground uppercase tracking-widest mb-2 px-1">
                  {day}
                </h2>
                <div className="space-y-1">
                  {daySessions.map(session => {
                    const channel: 'slack' | 'email' = session.slack ? 'slack' : 'email'
                    const isCopied = copiedId === session.eventId
                    const isSent = sentSet.has(session.eventId)
                    const actions = actionsMap.get(session.clientId) || []
                    const actionCount = actions.filter(a => a.status === 'to_do').length

                    return (
                      <div
                        key={session.eventId}
                        className={cn(
                          'flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors',
                          isSent
                            ? 'border-border/30 bg-muted/30'
                            : 'border-border/50 hover:bg-muted/50',
                        )}
                      >
                        <button
                          onClick={() => toggleSent(session.eventId)}
                          className={cn(
                            'shrink-0 h-4 w-4 rounded-full border flex items-center justify-center transition-colors cursor-pointer',
                            isSent
                              ? 'bg-muted-foreground/40 border-transparent text-background'
                              : 'border-border hover:border-muted-foreground',
                          )}
                          title={isSent ? 'Mark as not sent' : 'Mark as sent'}
                        >
                          {isSent && <Check className="h-2.5 w-2.5" />}
                        </button>

                        <div className={cn('flex-1 min-w-0', isSent && 'opacity-50')}>
                          <div className="flex items-center gap-2">
                            <span
                              className="text-[14px] font-medium text-foreground hover:underline cursor-pointer"
                              onClick={() => router.push(`/clients/${session.clientId}`)}
                            >
                              {session.clientName}
                            </span>
                            {session.companyName && (
                              <span className="text-[13px] text-muted-foreground">
                                {session.companyName}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-[12px] text-muted-foreground">
                              {format(parseISO(session.startTime), 'h:mm a')}
                            </span>
                            {actionCount > 0 && (
                              <span className="text-[11px] text-muted-foreground">
                                {actionCount} {actionCount === 1 ? 'action' : 'actions'}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {channel === 'slack' ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 border-chart-3/30 text-chart-3 font-medium cursor-pointer hover:bg-chart-3/10"
                              onClick={async () => {
                                await navigator.clipboard.writeText(session.slack!)
                                setCopiedSlackId(session.eventId)
                                setTimeout(() => setCopiedSlackId(null), 2000)
                              }}
                              title="Copy Slack ID"
                            >
                              {copiedSlackId === session.eventId ? 'Copied!' : 'Slack'}
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 border-primary/30 text-primary font-medium"
                              title={session.email || undefined}
                            >
                              Email
                            </Badge>
                          )}

                          <button
                            onClick={() => handleCopy(session)}
                            className={cn(
                              'p-1.5 rounded-md transition-colors cursor-pointer',
                              isCopied
                                ? 'text-success'
                                : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                            )}
                            title="Copy message to clipboard"
                          >
                            {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {unmatchedEvents.length > 0 && (
            <div>
              <h2 className="text-[12px] font-medium text-muted-foreground uppercase tracking-widest mb-2 px-1 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" />
                Unmatched events
              </h2>
              <div className="space-y-1">
                {unmatchedEvents.map(event => (
                  <div
                    key={event.id}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border/50 bg-muted/30"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-[14px] text-muted-foreground">{event.title}</span>
                      <div className="text-[12px] text-muted-foreground/70 mt-0.5">
                        {event.dayLabel} · {format(parseISO(event.startTime), 'h:mm a')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
