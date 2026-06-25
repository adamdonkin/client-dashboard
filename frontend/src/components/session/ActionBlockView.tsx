'use client'

import { useState, useEffect, useRef } from 'react'
import { NodeViewWrapper } from '@tiptap/react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { GripVertical } from 'lucide-react'
import { format, addDays } from 'date-fns'
import { toast } from 'sonner'
import { EditableActionRow } from './EditableActionRow'

interface ActionData {
  id: string
  title: string
  description: string | null
  due_date: string | null
  status: string
}

export function ActionBlockView({ node, updateAttributes, deleteNode, extension }: any) {
  const supabase = createClientComponentClient()
  const { actionId, prefillTitle } = node.attrs
  const { clientId, sessionNoteId, onActionCreated, onActionDeleted } = extension.options

  const [action, setAction] = useState<ActionData | null>(null)
  const [loading, setLoading] = useState(!!actionId)

  const [title, setTitle] = useState(prefillTitle || '')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState(format(addDays(new Date(), 7), 'yyyy-MM-dd'))
  const titleRef = useRef<HTMLInputElement>(null)
  const descRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!actionId) {
      setTimeout(() => titleRef.current?.focus(), 50)
      return
    }
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

  const submitCreate = async () => {
    if (!title.trim()) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const { data } = await supabase
      .from('client_actions')
      .insert({
        user_id: session.user.id,
        client_id: clientId,
        source: 'session',
        source_id: `session-${sessionNoteId}-${Date.now()}`,
        title: title.trim(),
        description: description.trim() || null,
        status: 'to_do',
        due_date: dueDate || null,
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

  const cancelCreate = () => {
    deleteNode()
  }

  const handleDelete = () => {
    if (!action) return
    const deletedAction = { ...action }
    deleteNode()
    const timeoutId = setTimeout(async () => {
      await supabase.from('client_actions').delete().eq('id', deletedAction.id)
    }, 5000)
    toast('Action deleted', {
      action: {
        label: 'Undo',
        onClick: () => {
          clearTimeout(timeoutId)
        },
      },
      duration: 5000,
    })
    onActionDeleted?.(deletedAction.id)
  }

  if (!actionId) {
    return (
      <NodeViewWrapper className="my-2" data-drag-handle>
        <div className="rounded-md bg-muted/30 border border-primary/30 py-2 px-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="shrink-0 h-3.5 w-3.5 rounded-sm border border-muted-foreground/40" />
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submitCreate() }
                else if (e.key === 'Enter') { e.preventDefault(); descRef.current?.focus() }
                if (e.key === 'Escape') cancelCreate()
              }}
              placeholder="Action title..."
              className="flex-1 text-[15px] bg-transparent outline-none"
            />
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="text-[13px] text-muted-foreground bg-transparent outline-none border border-border/50 rounded px-1.5 py-0.5"
            />
            <button onClick={submitCreate} className="text-[13px] text-primary font-medium hover:text-primary/80">Add</button>
          </div>
          <input
            ref={descRef}
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); submitCreate() }
              if (e.key === 'Escape') cancelCreate()
            }}
            placeholder="Description (optional)"
            className="w-full text-[15px] text-muted-foreground bg-transparent outline-none pl-5.5"
          />
        </div>
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
        <EditableActionRow
          action={action}
          onDelete={handleDelete}
        />
      </div>
    </NodeViewWrapper>
  )
}
