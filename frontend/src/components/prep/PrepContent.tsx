'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { format, parseISO, addDays, subDays } from 'date-fns'
import { ChevronLeft, ChevronRight, Loader2, RefreshCw, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PreReadPanel } from './PreReadPanel'
import { cn } from '@/lib/utils'

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

  const fetchSessions = useCallback(async () => {
    setLoading(true)

    const startLocal = new Date(`${date}T00:00:00`)
    const endLocal = new Date(`${date}T23:59:59`)
    const pacificRef = new Date(startLocal.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
    const offsetMs = startLocal.getTime() - pacificRef.getTime()
    const dayStart = new Date(startLocal.getTime() + offsetMs).toISOString()
    const dayEnd = new Date(endLocal.getTime() + offsetMs).toISOString()

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
      .select('id, calendar_event_id, status, content')
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
      }
    })

    setSessions(merged)
    setLoading(false)
  }, [date, supabase])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const allAlreadyReady = sessions.every(s => s.pre_read_status === 'ready')
      setSessions(prev => prev.map(s => {
        if (!allAlreadyReady && s.pre_read_status === 'ready') return s
        return { ...s, pre_read_status: 'generating' }
      }))

      for (const s of sessions) {
        if (!allAlreadyReady && s.pre_read_status === 'ready') continue
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
  const allReady = sessions.length > 0 && sessions.every(s => s.pre_read_status === 'ready')

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
              onClick={() => setSelectedSession(session)}
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
                  <span className="text-[11px] font-medium text-success px-2 py-0.5 rounded-full bg-success/10">
                    Ready
                  </span>
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

      {selectedSession && (
        <PreReadPanel
          key={selectedSession.id}
          clientName={selectedSession.client_name}
          companyName={selectedSession.company_name}
          clientId={selectedSession.client_id}
          sessionDate={format(parseISO(date), 'MMMM d, yyyy')}
          content={selectedSession.pre_read_content}
          status={selectedSession.pre_read_status === 'none' ? 'pending' : selectedSession.pre_read_status}
          onClose={() => setSelectedSession(null)}
        />
      )}
    </div>
  )
}
