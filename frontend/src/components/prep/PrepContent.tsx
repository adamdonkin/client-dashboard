'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { format, parseISO, addDays, subDays } from 'date-fns'
import { ChevronLeft, ChevronRight, Loader2, RefreshCw, Clock, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PreReadPanel } from './PreReadPanel'
import { CheckInPanel } from './CheckInPanel'
import { cn } from '@/lib/utils'

const CHECK_IN_DAYS = 7

// Both the session list and the check-in list need the same Pacific day window,
// and a drift between the two would silently shift who counts as a week out.
function pacificDayBounds(day: string) {
  const startLocal = new Date(`${day}T00:00:00`)
  const endLocal = new Date(`${day}T23:59:59`)
  const pacificRef = new Date(startLocal.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
  const offsetMs = startLocal.getTime() - pacificRef.getTime()
  return {
    start: new Date(startLocal.getTime() + offsetMs).toISOString(),
    end: new Date(endLocal.getTime() + offsetMs).toISOString(),
  }
}

interface SessionWithPreRead {
  id: string
  title: string
  start_time: string
  client_id: string
  client_name: string
  company_name: string | null
  role: string | null
  pre_read_id: string | null
  pre_read_status: string
  pre_read_content: string | null
  pre_read_session_date: string | null
}

interface CheckIn {
  // Null when the workspace was never opened, in which case the calendar event
  // id is the only thing that can be linked to.
  note_id: string | null
  event_id: string
  event_title: string
  client_id: string
  client_name: string
  company_name: string | null
  role: string | null
  last_session: string
  last_session_end: string
}

// A pre-read is only trustworthy for the day it was written for. A rescheduled session
// keeps its calendar event id, so an older document can still be attached to it.
function isCurrent(s: SessionWithPreRead, date: string) {
  return s.pre_read_status === 'ready' && s.pre_read_session_date === date
}

export function PrepContent() {
  const supabase = createClientComponentClient()
  const [date, setDate] = useState(() => {
    const now = new Date()
    return format(now, 'yyyy-MM-dd')
  })
  const [sessions, setSessions] = useState<SessionWithPreRead[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [selectedSession, setSelectedSession] = useState<SessionWithPreRead | null>(null)
  const [checkIns, setCheckIns] = useState<CheckIn[]>([])
  const [selectedCheckIn, setSelectedCheckIn] = useState<CheckIn | null>(null)

  const fetchSessions = useCallback(async () => {
    setLoading(true)

    const { start: dayStart, end: dayEnd } = pacificDayBounds(date)

    const { data: events } = await supabase
      .from('calendar_events')
      .select('id, title, start_time, client_id, status, clients(id, name, company_name, role)')
      .gte('start_time', dayStart)
      .lte('start_time', dayEnd)
      .not('client_id', 'is', null)
      .or('status.is.null,status.neq.cancelled')
      .order('start_time', { ascending: true })

    if (!events || events.length === 0) {
      setSessions([])
      setLoading(false)
      return
    }

    const eventIds = events.map(e => e.id)
    const { data: preReads } = await supabase
      .from('pre_reads')
      .select('id, calendar_event_id, status, content, session_date')
      .in('calendar_event_id', eventIds)

    const preReadMap = new Map(
      (preReads || []).map(pr => [pr.calendar_event_id, pr])
    )

    const merged: SessionWithPreRead[] = events.map((e: any) => {
      const pr = preReadMap.get(e.id)
      return {
        id: e.id,
        title: e.title,
        start_time: e.start_time,
        client_id: e.client_id,
        client_name: e.clients?.name || e.title,
        company_name: e.clients?.company_name || null,
        role: e.clients?.role || null,
        pre_read_id: pr?.id || null,
        pre_read_status: pr?.status || 'none',
        pre_read_content: pr?.content || null,
        pre_read_session_date: pr?.session_date || null,
      }
    })

    setSessions(merged)
    setLoading(false)
  }, [date, supabase])

  const fetchCheckIns = useCallback(async () => {
    const weekAgo = format(subDays(parseISO(date), CHECK_IN_DAYS), 'yyyy-MM-dd')
    const { start, end } = pacificDayBounds(weekAgo)

    const { data: events } = await supabase
      .from('calendar_events')
      .select('id, title, start_time, end_time, client_id, clients(id, name, company_name, role, status, is_active)')
      .gte('start_time', start)
      .lte('start_time', end)
      .not('client_id', 'is', null)
      .or('status.is.null,status.neq.cancelled')
      .order('start_time', { ascending: true })

    if (!events || events.length === 0) {
      setCheckIns([])
      return
    }

    const active = events.filter((e: any) =>
      e.clients &&
      (e.clients.is_active === null || e.clients.is_active === true) &&
      (e.clients.status === null || !['inactive', 'staff'].includes(e.clients.status))
    )

    if (active.length === 0) {
      setCheckIns([])
      return
    }

    // Anything scheduled between that session and the end of the day being viewed
    // means the week-old session is no longer the last time we spoke. This also
    // drops anyone already sitting in the list above, since seeing them today
    // makes a check-in moot.
    const { end: viewedEnd } = pacificDayBounds(date)
    const { data: since } = await supabase
      .from('calendar_events')
      .select('client_id')
      .in('client_id', active.map((e: any) => e.client_id))
      .gt('start_time', end)
      .lte('start_time', viewedEnd)
      .or('status.is.null,status.neq.cancelled')

    const seenSince = new Set((since || []).map((r: any) => r.client_id))
    const eligible = active.filter((e: any) => !seenSince.has(e.client_id))

    if (eligible.length === 0) {
      setCheckIns([])
      return
    }

    const { data: notes } = await supabase
      .from('session_notes')
      .select('id, calendar_event_id')
      .in('calendar_event_id', eligible.map((e: any) => e.id))

    const noteMap = new Map((notes || []).map(n => [n.calendar_event_id, n.id]))

    const seenClients = new Set<string>()
    setCheckIns(
      eligible.reduce((acc: CheckIn[], e: any) => {
        if (seenClients.has(e.client_id)) return acc
        seenClients.add(e.client_id)
        acc.push({
          note_id: noteMap.get(e.id) || null,
          event_id: e.id,
          event_title: e.title,
          client_id: e.client_id,
          client_name: e.clients?.name || 'Unknown',
          company_name: e.clients?.company_name || null,
          role: e.clients?.role || null,
          last_session: e.start_time,
          last_session_end: e.end_time,
        })
        return acc
      }, [])
    )
  }, [date, supabase])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  useEffect(() => {
    fetchCheckIns()
  }, [fetchCheckIns])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const allAlreadyReady = sessions.every(s => isCurrent(s, date))
      setSessions(prev => prev.map(s => {
        if (!allAlreadyReady && isCurrent(s, date)) return s
        return { ...s, pre_read_status: 'generating' }
      }))

      for (const s of sessions) {
        if (!allAlreadyReady && isCurrent(s, date)) continue
        await generateOne(session.user.id, s.id)
      }
    } finally {
      setGenerating(false)
    }
  }

  const generateOne = async (userId: string, eventId: string) => {
    const res = await fetch('/api/generate-pre-reads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        date,
        calendar_event_id: eventId,
      }),
    })

    if (!res.ok) {
      console.error(`Generate failed:`, await res.text())
    }

    await fetchSessions()
  }

  const handleGenerateOne = async (eventId: string) => {
    setGenerating(true)
    setSessions(prev => prev.map(p => p.id === eventId ? { ...p, pre_read_status: 'generating' } : p))
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      await generateOne(session.user.id, eventId)
    } finally {
      setGenerating(false)
    }
  }

  useEffect(() => {
    if (selectedSession) {
      const updated = sessions.find(s => s.id === selectedSession.id)
      if (updated) setSelectedSession(updated)
    }
  }, [sessions])

  const displayDate = (() => {
    const today = format(new Date(), 'yyyy-MM-dd')
    const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd')
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')
    if (date === today) return `Today, ${format(parseISO(date), 'MMM d')}`
    if (date === tomorrow) return `Tomorrow, ${format(parseISO(date), 'MMM d')}`
    if (date === yesterday) return `Yesterday, ${format(parseISO(date), 'MMM d')}`
    return format(parseISO(date), 'EEEE, MMM d')
  })()

  const hasAnyPreReads = sessions.some(s => s.pre_read_status === 'ready')
  const allReady = sessions.length > 0 && sessions.every(s => isCurrent(s, date))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDate(format(subDays(parseISO(date), 1), 'yyyy-MM-dd'))}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-[14px] font-medium text-foreground min-w-[140px] text-center">
            {displayDate}
          </span>
          <button
            onClick={() => setDate(format(addDays(parseISO(date), 1), 'yyyy-MM-dd'))}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {sessions.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {generating ? 'Generating...' : allReady ? 'Regenerate All' : 'Generate All'}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-3 text-[14px] text-muted-foreground">Loading sessions...</span>
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground">No coaching sessions on this day</p>
        </div>
      ) : (
        <div className="space-y-1">
          {sessions.map(session => (
            <div
              key={session.id}
              onClick={() => { setSelectedSession(session); setSelectedCheckIn(null) }}
              className={cn(
                'w-full flex items-center gap-4 px-4 py-3 rounded-lg border transition-colors text-left cursor-pointer',
                selectedSession?.id === session.id
                  ? 'border-primary/30 bg-accent'
                  : 'border-border/50 hover:bg-muted/50',
              )}
            >
              <div className="text-[13px] text-muted-foreground shrink-0 w-[90px]">
                <Clock className="h-3 w-3 inline mr-1 -mt-0.5" />
                {format(parseISO(session.start_time), 'h:mm a')}
              </div>

              <div className="flex-1 min-w-0">
                <span className="text-[14px] font-medium text-foreground">
                  {session.client_name}
                </span>
                {(session.company_name || session.role) && (
                  <span className="text-[13px] text-muted-foreground ml-2">
                    {[session.company_name, session.role].filter(Boolean).join(' · ')}
                  </span>
                )}
              </div>

              <div className="shrink-0 flex items-center gap-2">
                {session.pre_read_status === 'ready' && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleGenerateOne(session.id) }}
                      disabled={generating}
                      className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50"
                      title="Regenerate"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </button>
                    {isCurrent(session, date) ? (
                      <span className="text-[11px] font-medium text-success px-2 py-0.5 rounded-full bg-success/10">
                        Ready
                      </span>
                    ) : (
                      <span
                        className="text-[11px] font-medium text-warning px-2 py-0.5 rounded-full bg-warning/10"
                        title={`Written for ${session.pre_read_session_date ?? 'another date'} — regenerate for this session`}
                      >
                        Out of date
                      </span>
                    )}
                  </div>
                )}
                {session.pre_read_status === 'generating' && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                )}
                {(session.pre_read_status === 'none' || session.pre_read_status === 'pending' || session.pre_read_status === 'error') && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleGenerateOne(session.id) }}
                    disabled={generating}
                    className="text-[11px] font-medium text-primary hover:text-primary/80 px-2 py-0.5 rounded-full border border-primary/30 hover:bg-primary/5 transition-colors disabled:opacity-50"
                  >
                    Generate
                  </button>
                )}
                {session.pre_read_status === 'error' && (
                  <span className="text-[11px] font-medium text-danger px-2 py-0.5 rounded-full bg-danger/10">
                    Error
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {checkIns.length > 0 && (
        <div className="pt-2">
          <div className="flex items-center gap-2 mb-2 px-4">
            <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
            <h2 className="text-[13px] font-medium text-muted-foreground">Check-ins</h2>
          </div>

          <div className="space-y-1">
            {checkIns.map(c => (
              <div
                key={c.client_id}
                onClick={() => { setSelectedCheckIn(c); setSelectedSession(null) }}
                className={cn(
                  'w-full flex items-center gap-4 px-4 py-3 rounded-lg border transition-colors cursor-pointer',
                  selectedCheckIn?.client_id === c.client_id
                    ? 'border-primary/30 bg-accent'
                    : 'border-border/50 hover:bg-muted/50',
                )}
              >
                <div className="text-[13px] text-muted-foreground shrink-0 w-[90px]">
                  {format(parseISO(c.last_session), 'MMM d')}
                </div>

                <div className="flex-1 min-w-0">
                  <span className="text-[14px] font-medium text-foreground">
                    {c.client_name}
                  </span>
                  {(c.company_name || c.role) && (
                    <span className="text-[13px] text-muted-foreground ml-2">
                      {[c.company_name, c.role].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </div>

                <div className="shrink-0 flex items-center gap-1 text-[13px] text-muted-foreground">
                  <span>{CHECK_IN_DAYS} days ago</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedSession && (
        <PreReadPanel
          key={selectedSession.id}
          clientName={selectedSession.client_name}
          companyName={selectedSession.company_name}
          clientId={selectedSession.client_id}
          sessionDate={format(parseISO(date), 'MMMM d, yyyy')}
          content={selectedSession.pre_read_content}
          status={selectedSession.pre_read_status === 'none' ? 'pending' : selectedSession.pre_read_status}
          staleFrom={
            selectedSession.pre_read_status === 'ready' && !isCurrent(selectedSession, date)
              ? selectedSession.pre_read_session_date
                ? format(parseISO(selectedSession.pre_read_session_date), 'MMMM d, yyyy')
                : 'an earlier session'
              : null
          }
          onClose={() => setSelectedSession(null)}
          onRegenerate={() => handleGenerateOne(selectedSession.id)}
        />
      )}

      {selectedCheckIn && (
        <CheckInPanel
          key={selectedCheckIn.client_id}
          calendarEvent={{
            id: selectedCheckIn.event_id,
            client_id: selectedCheckIn.client_id,
            start_time: selectedCheckIn.last_session,
            end_time: selectedCheckIn.last_session_end,
            title: selectedCheckIn.event_title,
          }}
          client={{
            id: selectedCheckIn.client_id,
            name: selectedCheckIn.client_name,
            company_name: selectedCheckIn.company_name,
            role: selectedCheckIn.role,
          }}
          sessionNoteId={selectedCheckIn.note_id}
          onClose={() => setSelectedCheckIn(null)}
        />
      )}
    </div>
  )
}
