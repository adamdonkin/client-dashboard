'use client'

import { useState, useRef, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { format, addDays } from 'date-fns'

interface ActionFormProps {
  clientId: string
  sessionNoteId: string
  prefillTitle?: string
  onCreated: (action: { id: string; title: string; description: string | null; due_date: string | null; status: string }) => void
  onCancel: () => void
}

export function ActionForm({ clientId, sessionNoteId, prefillTitle, onCreated, onCancel }: ActionFormProps) {
  const supabase = createClientComponentClient()
  const [title, setTitle] = useState(prefillTitle || '')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState(format(addDays(new Date(), 7), 'yyyy-MM-dd'))
  const titleRef = useRef<HTMLInputElement>(null)
  const descRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  const submit = async () => {
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
      onCreated(data)
    }
  }

  const cancel = () => {
    onCancel()
  }

  return (
    <div className="mt-3 rounded-md bg-muted/30 border border-primary/30 py-2 px-3 space-y-2">
      <div className="flex items-center gap-2">
        <div className="shrink-0 h-4 w-4 rounded border border-muted-foreground/40" />
        <input
          ref={titleRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit() }
            else if (e.key === 'Enter') { e.preventDefault(); descRef.current?.focus() }
            if (e.key === 'Escape') cancel()
          }}
          placeholder="Action title..."
          className="flex-1 text-[15px] bg-transparent outline-none"
          autoFocus
        />
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="text-[13px] text-muted-foreground bg-transparent outline-none border border-border/50 rounded px-1.5 py-0.5"
        />
        <button onClick={submit} className="text-[13px] text-primary font-medium hover:text-primary/80">Add</button>
      </div>
      <input
        ref={descRef}
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); submit() }
          if (e.key === 'Escape') cancel()
        }}
        placeholder="Description (optional)"
        className="w-full text-[15px] text-muted-foreground bg-transparent outline-none pl-6"
      />
    </div>
  )
}
