'use client'

import { useState, useEffect, useRef } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { X } from 'lucide-react'
import { ActionDatePicker } from './ActionDatePicker'
import { cn } from '@/lib/utils'

interface ActionCreatePanelProps {
  clientId: string
  sessionNoteId: string
  onClose: () => void
  onCreated: (action: { id: string; title: string }) => void
}

export function ActionCreatePanel({
  clientId,
  sessionNoteId,
  onClose,
  onCreated,
}: ActionCreatePanelProps) {
  const supabase = createClientComponentClient()
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return d.toISOString().slice(0, 10)
  })
  const [submitting, setSubmitting] = useState(false)
  const titleRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleSubmit = async () => {
    if (!title.trim() || submitting) return
    setSubmitting(true)

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
        due_date: dueDate || null,
        session_note_id: sessionNoteId,
      })
      .select('id, title')
      .single()

    if (data) {
      onCreated(data)
    }
    setSubmitting(false)
  }

  return (
    <div
      className={cn(
        'fixed top-0 right-0 z-50 h-full w-[420px] max-w-[90vw] bg-background border-l border-border shadow-xl',
        'animate-in slide-in-from-right duration-200',
      )}
    >
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/50">
          <span className="text-[13px] font-medium text-muted-foreground">New Action</span>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 px-5 pt-4 pb-6 space-y-4">
          <textarea
            ref={titleRef}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = e.target.scrollHeight + 'px'
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleSubmit()
              }
            }}
            rows={1}
            className="w-full text-[17px] font-medium bg-transparent outline-none placeholder:text-muted-foreground resize-none overflow-hidden"
            placeholder="Action title..."
          />

          <div className="flex items-center gap-3 text-[13px]">
            <span className="text-muted-foreground">Due</span>
            <ActionDatePicker
              value={dueDate}
              onChange={setDueDate}
            />
          </div>
        </div>

        <div className="px-5 py-3 border-t border-border/50">
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || submitting}
            className="w-full py-2 px-4 text-[13px] font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Creating...' : 'Create action'}
          </button>
        </div>
      </div>
    </div>
  )
}
