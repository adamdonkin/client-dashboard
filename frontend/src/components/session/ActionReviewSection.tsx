'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { ActionRow } from '@/components/ActionRow'
import type { ActionItem } from '@/components/ActionRow'

interface ActionReviewSectionProps {
  clientId: string
  sessionNoteId: string
  onActionToggled: (actionId: string) => void
}

export function ActionReviewSection({ clientId, sessionNoteId, onActionToggled }: ActionReviewSectionProps) {
  const supabase = createClientComponentClient()
  const [actions, setActions] = useState<ActionItem[]>([])
  const [completedActions, setCompletedActions] = useState<ActionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showCompleted, setShowCompleted] = useState(false)

  const fetchActions = useCallback(async () => {
    const { data } = await supabase
      .from('client_actions')
      .select('id, title, description, source, due_date, status, review_history')
      .eq('client_id', clientId)
      .eq('status', 'to_do')
      .or(`session_note_id.is.null,session_note_id.neq.${sessionNoteId}`)
      .order('due_date', { ascending: true, nullsFirst: false })

    setActions(data || [])
    setLoading(false)
  }, [clientId, sessionNoteId, supabase])

  const fetchCompleted = useCallback(async () => {
    const since = new Date()
    since.setDate(since.getDate() - 7)

    const { data } = await supabase
      .from('client_actions')
      .select('id, title, description, source, due_date, status, review_history')
      .eq('client_id', clientId)
      .eq('status', 'completed')
      .gte('updated_at', since.toISOString())
      .order('updated_at', { ascending: false })

    setCompletedActions(data || [])
  }, [clientId, supabase])

  useEffect(() => {
    fetchActions()
  }, [fetchActions])

  useEffect(() => {
    if (showCompleted) fetchCompleted()
  }, [showCompleted, fetchCompleted])

  const handleChanged = (updated: ActionItem) => {
    if (updated.status === 'completed') {
      setActions(prev => prev.filter(a => a.id !== updated.id))
      setCompletedActions(prev => [updated, ...prev.filter(a => a.id !== updated.id)])
      onActionToggled(updated.id)
    } else if (updated.status === 'to_do') {
      setCompletedActions(prev => prev.filter(a => a.id !== updated.id))
      setActions(prev => [updated, ...prev.filter(a => a.id !== updated.id)])
    } else {
      setActions(prev => prev.map(a => a.id === updated.id ? { ...a, ...updated } : a))
    }
  }

  const handleRemoved = (id: string) => {
    setActions(prev => prev.filter(a => a.id !== id))
    setCompletedActions(prev => prev.filter(a => a.id !== id))
  }

  if (loading) {
    return <p className="text-[15px] text-muted-foreground">Loading actions...</p>
  }

  if (actions.length === 0 && completedActions.length === 0 && !showCompleted) {
    return <p className="text-[15px] text-muted-foreground">No open actions</p>
  }

  return (
    <div className="space-y-1.5">
      {actions.map(action => (
        <ActionRow
          key={action.id}
          action={action}
          onChanged={handleChanged}
          onRemoved={handleRemoved}
          showSource
        />
      ))}

      <button
        onClick={() => setShowCompleted(prev => !prev)}
        className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer pt-1"
      >
        {showCompleted ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {showCompleted
          ? 'Hide completed'
          : `Show completed this week`}
      </button>

      {showCompleted && completedActions.length > 0 && (
        <div className="space-y-1.5 opacity-60">
          {completedActions.map(action => (
            <ActionRow
              key={action.id}
              action={action}
              onChanged={handleChanged}
              onRemoved={handleRemoved}
              showSource
            />
          ))}
        </div>
      )}

      {showCompleted && completedActions.length === 0 && (
        <p className="text-[12px] text-muted-foreground pl-4">No actions completed this week</p>
      )}
    </div>
  )
}
