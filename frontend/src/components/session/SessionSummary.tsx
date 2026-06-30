'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Calendar, Check, Plus } from 'lucide-react'
import { format } from 'date-fns'

interface SummaryAction {
  id: string
  title: string
  due_date: string | null
  status: string
  source: string
}

interface SessionSummaryProps {
  sessionNoteId: string
  actionsModified: string[]
}

export function SessionSummary({ sessionNoteId, actionsModified }: SessionSummaryProps) {
  const supabase = createClientComponentClient()
  const [createdActions, setCreatedActions] = useState<SummaryAction[]>([])
  const [completedActions, setCompletedActions] = useState<SummaryAction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      // Actions created in this session
      const { data: created } = await supabase
        .from('client_actions')
        .select('id, title, due_date, status, source')
        .eq('session_note_id', sessionNoteId)

      setCreatedActions(created || [])

      // Actions completed (toggled) during this session
      if (actionsModified.length > 0) {
        const { data: modified } = await supabase
          .from('client_actions')
          .select('id, title, due_date, status, source')
          .in('id', actionsModified)
          .eq('status', 'completed')

        setCompletedActions(modified || [])
      } else {
        setCompletedActions([])
      }

      setLoading(false)
    }
    fetch()
  }, [sessionNoteId, actionsModified, supabase])

  if (loading) {
    return <p className="text-lg text-muted-foreground">Loading summary...</p>
  }

  const hasContent = createdActions.length > 0 || completedActions.length > 0

  if (!hasContent) {
    return (
      <p className="text-lg text-muted-foreground">
        Actions created and completed during this session will appear here.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {createdActions.length > 0 && (
        <div>
          <p className="text-base font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
            <Plus className="h-3 w-3" />
            New actions ({createdActions.length})
          </p>
          <div className="space-y-1">
            {createdActions.map(action => (
              <div key={action.id} className="flex items-center gap-3 py-1.5 px-3 rounded bg-muted/30">
                <span className="text-lg flex-1">{action.title}</span>
                {action.due_date && (
                  <span className="text-base text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(action.due_date), 'MMM d')}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {completedActions.length > 0 && (
        <div>
          <p className="text-base font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
            <Check className="h-3 w-3" />
            Completed ({completedActions.length})
          </p>
          <div className="space-y-1">
            {completedActions.map(action => (
              <div key={action.id} className="flex items-center gap-3 py-1.5 px-3 rounded bg-muted/30">
                <span className="text-lg flex-1 line-through text-muted-foreground">{action.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
