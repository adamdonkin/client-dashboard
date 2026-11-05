'use client'

import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { ACTION_COLUMNS, ActionRow } from '@/components/ActionRow'
import type { ActionItem } from '@/components/ActionRow'

interface ActionReviewSectionProps {
  clientId: string
  /**
   * Set on the client record that stands for a real person using the app, so
   * their page also collects the actions they assigned themselves while
   * coaching someone else. Those actions stay on the other client too.
   */
  assignedToUserId?: string | null
  sessionNoteId?: string
  refreshKey?: number
  onActionSelect?: (action: ActionItem | null) => void
  onActionChanged?: (updated: ActionItem) => void
  onActionRemoved?: (id: string) => void
}

export interface ActionReviewSectionHandle {
  applyChanged: (updated: ActionItem) => void
  applyRemoved: (id: string) => void
  getActions: () => ActionItem[]
}

export const ActionReviewSection = forwardRef<ActionReviewSectionHandle, ActionReviewSectionProps>(function ActionReviewSection({ clientId, assignedToUserId, sessionNoteId, refreshKey, onActionSelect, onActionChanged, onActionRemoved }, ref) {
  const supabase = createClientComponentClient()
  const [actions, setActions] = useState<ActionItem[]>([])
  const [completedActions, setCompletedActions] = useState<ActionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showCompleted, setShowCompleted] = useState(false)

  // Borrowed actions need their own client's name, since it is not the one on screen
  const columns = assignedToUserId
    ? `${ACTION_COLUMNS}, client:clients!client_actions_client_id_fkey(name)`
    : ACTION_COLUMNS
  const scope = assignedToUserId
    ? `client_id.eq.${clientId},assigned_to.eq.${assignedToUserId}`
    : null

  const fetchActions = useCallback(async () => {
    let query = supabase
      .from('client_actions')
      .select(columns)
      .eq('status', 'to_do')

    query = scope ? query.or(scope) : query.eq('client_id', clientId)

    if (sessionNoteId) {
      query = query.or(`session_note_id.is.null,session_note_id.neq.${sessionNoteId}`)
    }

    const { data } = await query.order('due_date', { ascending: true, nullsFirst: false })

    // Actions ticked off during this review stay in place until the page is reloaded
    setActions(prev => {
      const next = [...((data as unknown as ActionItem[]) || [])]
      prev.forEach((action, index) => {
        if (action.status === 'completed' && !next.some(a => a.id === action.id)) {
          next.splice(Math.min(index, next.length), 0, action)
        }
      })
      return next
    })
    setLoading(false)
  }, [clientId, columns, scope, sessionNoteId, supabase])

  const fetchCompleted = useCallback(async () => {
    const since = new Date()
    since.setDate(since.getDate() - 7)

    let query = supabase
      .from('client_actions')
      .select(columns)
      .in('status', ['completed', 'cancelled'])
      .gte('updated_at', since.toISOString())

    query = scope ? query.or(scope) : query.eq('client_id', clientId)

    const { data } = await query.order('updated_at', { ascending: false })

    setCompletedActions((data as unknown as ActionItem[]) || [])
  }, [clientId, columns, scope, supabase])

  useEffect(() => {
    fetchActions()
    if (showCompleted) fetchCompleted()
  }, [fetchActions, refreshKey])

  useEffect(() => {
    if (showCompleted) fetchCompleted()
  }, [showCompleted, fetchCompleted])

  const handleChanged = (updated: ActionItem) => {
    const inOpenList = actions.some(a => a.id === updated.id)
    if (inOpenList && (updated.status === 'completed' || updated.status === 'to_do')) {
      setActions(prev => prev.map(a => a.id === updated.id ? { ...a, ...updated } : a))
      setCompletedActions(prev => updated.status === 'completed'
        ? [updated, ...prev.filter(a => a.id !== updated.id)]
        : prev.filter(a => a.id !== updated.id))
    } else if (updated.status === 'completed' || updated.status === 'cancelled') {
      setActions(prev => prev.filter(a => a.id !== updated.id))
      setCompletedActions(prev => [updated, ...prev.filter(a => a.id !== updated.id)])
    } else if (updated.status === 'to_do' && !(sessionNoteId && updated.session_note_id === sessionNoteId)) {
      setCompletedActions(prev => prev.filter(a => a.id !== updated.id))
      setActions(prev => [updated, ...prev.filter(a => a.id !== updated.id)])
    } else {
      setActions(prev => prev.map(a => a.id === updated.id ? { ...a, ...updated } : a))
    }
    onActionChanged?.(updated)
  }

  const handleRemoved = (id: string) => {
    setActions(prev => prev.filter(a => a.id !== id))
    setCompletedActions(prev => prev.filter(a => a.id !== id))
    onActionRemoved?.(id)
  }

  useImperativeHandle(ref, () => ({
    applyChanged: handleChanged,
    applyRemoved: handleRemoved,
    getActions: () => actions.filter(a => a.status === 'to_do'),
  }))

  if (loading) {
    return <p className="text-[15px] text-muted-foreground">Loading actions...</p>
  }

  const completedInSection = completedActions.filter(c => !actions.some(a => a.id === c.id))

  if (actions.length === 0 && completedActions.length === 0 && !showCompleted) {
    return <p className="text-[15px] text-muted-foreground">No open actions</p>
  }

  // An action picked up from another client reads as a non sequitur without saying whose session it came from
  const withOrigin = (action: ActionItem, row: React.ReactNode) =>
    action.client_id && action.client_id !== clientId && action.client?.name ? (
      <div key={action.id} className="flex items-center gap-2">
        <div className="flex-1 min-w-0">{row}</div>
        <span className="text-xs text-muted-foreground shrink-0">{action.client.name}</span>
      </div>
    ) : row

  return (
    <div className="space-y-1.5">
      {actions.map(action => withOrigin(action, (
        <ActionRow
          key={action.id}
          action={action}
          onChanged={handleChanged}
          onRemoved={handleRemoved}
          onSelect={onActionSelect}
          reviewSessionNoteId={sessionNoteId}
          highlightCompleted
        />
      )))}

      <button
        onClick={() => setShowCompleted(prev => !prev)}
        className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer pt-1"
      >
        {showCompleted ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {showCompleted
          ? 'Hide completed & cancelled'
          : `Show completed & cancelled`}
      </button>

      {showCompleted && completedInSection.length > 0 && (
        <div className="space-y-1.5 opacity-60">
          {completedInSection.map(action => withOrigin(action, (
            <ActionRow
              key={action.id}
              action={action}
              onChanged={handleChanged}
              onRemoved={handleRemoved}
              onSelect={onActionSelect}
            />
          )))}
        </div>
      )}

      {showCompleted && completedInSection.length === 0 && (
        <p className="text-[12px] text-muted-foreground pl-4">No actions completed this week</p>
      )}

    </div>
  )
})
