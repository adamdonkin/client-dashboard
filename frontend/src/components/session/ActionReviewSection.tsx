'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
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
  const [loading, setLoading] = useState(true)

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

  useEffect(() => {
    fetchActions()
  }, [fetchActions])

  const handleChanged = (updated: ActionItem) => {
    setActions(prev => prev.map(a => a.id === updated.id ? { ...a, ...updated } : a))
    if (updated.status !== 'to_do') onActionToggled(updated.id)
  }

  const handleRemoved = (id: string) => {
    setActions(prev => prev.filter(a => a.id !== id))
  }

  if (loading) {
    return <p className="text-[15px] text-muted-foreground">Loading actions...</p>
  }

  if (actions.length === 0) {
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
    </div>
  )
}
