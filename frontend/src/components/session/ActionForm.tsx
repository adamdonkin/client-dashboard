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
  const titleRef = useRef<HTMLInputElement>(null)

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
        status: 'to_do',
        due_date: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
        session_note_id: sessionNoteId,
      })
      .select('id, title, description, due_date, status')
      .single()

    if (data) {
      onCreated(data)
    }
  }

  return (
    <div className="mt-3 rounded-md bg-muted/30 border border-primary/30 py-2 px-3">
      <div className="flex items-center gap-2">
        <div className="shrink-0 h-3.5 w-3.5 rounded-sm border border-muted-foreground/40" />
        <input
          ref={titleRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); submit() }
            if (e.key === 'Escape') onCancel()
          }}
          placeholder="Action title..."
          className="flex-1 text-[15px] bg-transparent outline-none"
          autoFocus
        />
        <button onClick={submit} className="text-[13px] text-primary font-medium hover:text-primary/80">Add</button>
      </div>
    </div>
  )
}
