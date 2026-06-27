'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Plus } from 'lucide-react'
import { ActionRow } from '@/components/ActionRow'
import type { ActionItem } from '@/components/ActionRow'
import { ActionCreateForm } from './ActionCreateForm'

interface ActionsSidebarProps {
  clientId: string
  sessionNoteId: string
}

export function ActionsSidebar({ clientId, sessionNoteId }: ActionsSidebarProps) {
  const supabase = createClientComponentClient()
  const [sessionActions, setSessionActions] = useState<ActionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)

  const fetchSessionActions = useCallback(async () => {
    const { data } = await supabase
      .from('client_actions')
      .select('id, title, description, source, due_date, status, review_history')
      .eq('session_note_id', sessionNoteId)
      .order('created_at', { ascending: true })

    setSessionActions(data || [])
    setLoading(false)
  }, [sessionNoteId, supabase])

  useEffect(() => {
    fetchSessionActions()
  }, [fetchSessionActions])

  // Poll for new session actions (created via inline editor blocks)
  useEffect(() => {
    const interval = setInterval(fetchSessionActions, 3000)
    return () => clearInterval(interval)
  }, [fetchSessionActions])

  const handleCreateAction = async (title: string, dueDate: string) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const { data } = await supabase
      .from('client_actions')
      .insert({
        user_id: session.user.id,
        client_id: clientId,
        source: 'session',
        source_id: `session-${sessionNoteId}-${Date.now()}`,
        title,
        status: 'to_do',
        due_date: dueDate,
        session_note_id: sessionNoteId,
      })
      .select('id, title, description, due_date, status, source, review_history')
      .single()

    if (data) {
      setSessionActions(prev => [...prev, data])
      setShowCreateForm(false)
    }
  }

  return (
    <div className="px-4 py-4">
        <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          Session Actions
        </h3>

        {loading ? (
          <p className="text-[13px] text-muted-foreground">Loading...</p>
        ) : sessionActions.length === 0 && !showCreateForm ? (
          <p className="text-[13px] text-muted-foreground">No actions yet</p>
        ) : (
          <div className="space-y-1.5">
            {sessionActions.map(action => (
              <ActionRow
                key={action.id}
                action={action}
                onChanged={(updated) => setSessionActions(prev => prev.map(a => a.id === updated.id ? { ...a, ...updated } : a))}
                onRemoved={(id) => setSessionActions(prev => prev.filter(a => a.id !== id))}
              />
            ))}
          </div>
        )}

        {showCreateForm ? (
          <div className="mt-2">
            <ActionCreateForm
              onSubmit={handleCreateAction}
              onCancel={() => setShowCreateForm(false)}
            />
          </div>
        ) : (
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-1 mt-3 text-[13px] text-primary hover:text-primary/80 transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Add action
          </button>
        )}
    </div>
  )
}
