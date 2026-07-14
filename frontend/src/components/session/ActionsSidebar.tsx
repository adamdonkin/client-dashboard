'use client'

import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Plus, Copy, Check } from 'lucide-react'
import { ActionRow } from '@/components/ActionRow'
import type { ActionItem } from '@/components/ActionRow'
import { copyActionsToClipboard } from '@/utils/copy-actions'
import { ActionCreateForm } from './ActionCreateForm'

interface ActionsSidebarProps {
  clientId: string
  sessionNoteId: string
  refreshKey?: number
  onActionSelect?: (action: ActionItem | null) => void
  onActionChanged?: (updated: ActionItem) => void
  onActionRemoved?: (id: string) => void
}

export interface ActionsSidebarHandle {
  applyChanged: (updated: ActionItem) => void
  applyRemoved: (id: string) => void
}

export const ActionsSidebar = forwardRef<ActionsSidebarHandle, ActionsSidebarProps>(function ActionsSidebar({ clientId, sessionNoteId, refreshKey, onActionSelect, onActionChanged, onActionRemoved }, ref) {
  const supabase = createClientComponentClient()
  const [sessionActions, setSessionActions] = useState<ActionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)

  const fetchSessionActions = useCallback(async () => {
    const { data } = await supabase
      .from('client_actions')
      .select('id, title, description, description_content, source, source_url, session_note_id, due_date, status, review_history, created_at')
      .eq('session_note_id', sessionNoteId)
      .order('created_at', { ascending: true })

    setSessionActions(data || [])
    setLoading(false)
  }, [sessionNoteId, supabase])

  useEffect(() => {
    fetchSessionActions()
  }, [fetchSessionActions])

  useEffect(() => {
    if (refreshKey && refreshKey > 0) fetchSessionActions()
  }, [refreshKey, fetchSessionActions])

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
      .select('id, title, description, due_date, status, source, review_history, created_at')
      .single()

    if (data) {
      setSessionActions(prev => [...prev, data])
      setShowCreateForm(false)
    }
  }

  const handleChanged = (updated: ActionItem) => {
    setSessionActions(prev => prev.map(a => a.id === updated.id ? { ...a, ...updated } : a))
    onActionChanged?.(updated)
  }

  const handleRemoved = (id: string) => {
    setSessionActions(prev => prev.filter(a => a.id !== id))
    onActionRemoved?.(id)
  }

  useImperativeHandle(ref, () => ({
    applyChanged: handleChanged,
    applyRemoved: handleRemoved,
  }))

  const [copied, setCopied] = useState(false)

  const copyActions = async () => {
    await copyActionsToClipboard(sessionActions)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
            Session Actions
          </h3>
          <div className="flex items-center gap-2">
            {sessionActions.filter(a => a.status === 'to_do').length > 0 && (
              <button
                onClick={copyActions}
                className="p-0.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="Copy actions to clipboard"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            )}
            <button
              onClick={() => setShowCreateForm(true)}
              className="p-0.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="Add action"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {showCreateForm && (
          <div className="mb-2">
            <ActionCreateForm
              onSubmit={handleCreateAction}
              onCancel={() => setShowCreateForm(false)}
            />
          </div>
        )}

        {loading ? (
          <p className="text-[13px] text-muted-foreground">Loading...</p>
        ) : sessionActions.length === 0 && !showCreateForm ? (
          <p className="text-[13px] text-muted-foreground/50">No actions yet</p>
        ) : (
          <div className="space-y-1.5">
            {sessionActions.map(action => (
              <ActionRow
                key={action.id}
                action={action}
                onChanged={handleChanged}
                onRemoved={handleRemoved}
                onSelect={onActionSelect}
              />
            ))}
          </div>
        )}
    </div>
  )
})

