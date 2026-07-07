'use client'

import { useState, useEffect } from 'react'
import { NodeViewWrapper } from '@tiptap/react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { GripVertical } from 'lucide-react'
import { ActionRow } from '@/components/ActionRow'
import type { ActionItem } from '@/components/ActionRow'
import { ActionDetailPanel } from './ActionDetailPanel'
import { ActionCreateForm } from './ActionCreateForm'

export function ActionBlockView({ node, updateAttributes, deleteNode, extension }: any) {
  const supabase = createClientComponentClient()
  const { actionId, prefillTitle } = node.attrs
  const { clientId, sessionNoteId, onActionCreated, onActionDeleted } = extension.options

  const [action, setAction] = useState<ActionItem | null>(null)
  const [loading, setLoading] = useState(!!actionId)
  const [detailOpen, setDetailOpen] = useState(false)

  useEffect(() => {
    if (!actionId) return
    const fetchAction = async () => {
      const { data } = await supabase
        .from('client_actions')
        .select('id, title, description, due_date, status')
        .eq('id', actionId)
        .single()
      if (data) setAction(data)
      setLoading(false)
    }
    fetchAction()
  }, [actionId, supabase])

  const submitCreate = async (title: string, dueDate: string) => {
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
      .select('id, title, description, due_date, status')
      .single()

    if (data) {
      setAction(data)
      updateAttributes({ actionId: data.id, prefillTitle: '' })
      onActionCreated?.(data.id)
    }
  }

  if (!actionId) {
    return (
      <NodeViewWrapper className="my-2" data-drag-handle>
        <ActionCreateForm
          onSubmit={submitCreate}
          onCancel={deleteNode}
          prefillTitle={prefillTitle || ''}
        />
      </NodeViewWrapper>
    )
  }

  if (loading) {
    return (
      <NodeViewWrapper className="my-2">
        <div className="py-1.5 px-3 rounded-md bg-muted/30 border border-border/50 text-[13px] text-muted-foreground">
          Loading action...
        </div>
      </NodeViewWrapper>
    )
  }

  if (!action) {
    return (
      <NodeViewWrapper className="my-2">
        <div className="py-1.5 px-3 rounded-md bg-muted/30 border border-border/50 text-[13px] text-muted-foreground">
          Action not found
        </div>
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper className="my-2">
      <div className="relative group/drag">
        <div
          className="absolute -left-6 top-1/2 -translate-y-1/2 opacity-0 group-hover/drag:opacity-50 hover:!opacity-100 cursor-grab active:cursor-grabbing"
          contentEditable={false}
          data-drag-handle
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        <ActionRow
          action={action}
          onChanged={(updated) => setAction(updated)}
          onRemoved={(id) => {
            deleteNode()
            onActionDeleted?.(id)
          }}
          onSelect={() => setDetailOpen(true)}
        />
      </div>

      {detailOpen && (
        <ActionDetailPanel
          action={action}
          onClose={() => setDetailOpen(false)}
          onUpdated={(updated) => setAction(updated as ActionItem)}
        />
      )}
    </NodeViewWrapper>
  )
}
