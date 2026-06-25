'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { toast } from 'sonner'
import { SourceBadge } from '@/components/ActionRow'
import { EditableActionRow } from './EditableActionRow'

interface ReviewAction {
  id: string
  title: string
  description: string | null
  source: 'defacto' | 'granola' | 'session'
  due_date: string | null
  status: string
}

interface ActionReviewSectionProps {
  clientId: string
  sessionNoteId: string
  onActionToggled: (actionId: string) => void
}

export function ActionReviewSection({ clientId, sessionNoteId, onActionToggled }: ActionReviewSectionProps) {
  const supabase = createClientComponentClient()
  const [actions, setActions] = useState<ReviewAction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('client_actions')
        .select('id, title, description, source, due_date, status')
        .eq('client_id', clientId)
        .eq('status', 'to_do')
        .neq('session_note_id', sessionNoteId)
        .order('due_date', { ascending: true, nullsFirst: false })

      setActions(data || [])
      setLoading(false)
    }
    fetch()
  }, [clientId, sessionNoteId, supabase])

  const toggleAction = async (actionId: string) => {
    const action = actions.find(a => a.id === actionId)
    if (!action) return

    const newStatus = action.status === 'to_do' ? 'completed' : 'to_do'

    setActions(prev =>
      prev.map(a => a.id === actionId ? { ...a, status: newStatus } : a)
    )

    await supabase
      .from('client_actions')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', actionId)

    onActionToggled(actionId)
  }

  const deleteAction = (action: ReviewAction) => {
    setActions(prev => prev.filter(a => a.id !== action.id))

    const timeoutId = setTimeout(async () => {
      await supabase.from('client_actions').delete().eq('id', action.id)
    }, 5000)

    toast('Action deleted', {
      action: {
        label: 'Undo',
        onClick: () => {
          clearTimeout(timeoutId)
          setActions(prev => [...prev, action].sort((a, b) => {
            if (!a.due_date) return 1
            if (!b.due_date) return -1
            return a.due_date.localeCompare(b.due_date)
          }))
        },
      },
      duration: 5000,
    })
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
        <EditableActionRow
          key={action.id}
          action={action}
          onToggle={() => toggleAction(action.id)}
          onDelete={() => deleteAction(action)}
          extra={<SourceBadge source={action.source} />}
        />
      ))}
    </div>
  )
}
