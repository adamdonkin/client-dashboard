'use client'

import { useState, useRef, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Calendar, Check, Trash2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'

interface EditableActionRowProps {
  action: {
    id: string
    title: string
    description?: string | null
    due_date: string | null
    status: string
  }
  onDelete?: () => void
  onToggle?: () => void
  extra?: React.ReactNode
}

export function EditableActionRow({ action, onDelete, onToggle, extra }: EditableActionRowProps) {
  const supabase = createClientComponentClient()
  const [title, setTitle] = useState(action.title)
  const [description, setDescription] = useState(action.description || '')
  const [dueDate, setDueDate] = useState(action.due_date || '')
  const [editingTitle, setEditingTitle] = useState(false)
  const [editingDesc, setEditingDesc] = useState(false)
  const [editingDate, setEditingDate] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const descRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTitle(action.title)
    setDescription(action.description || '')
    setDueDate(action.due_date || '')
  }, [action.title, action.description, action.due_date])

  const saveField = async (field: string, value: string | null) => {
    await supabase
      .from('client_actions')
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq('id', action.id)
  }

  const commitTitle = () => {
    setEditingTitle(false)
    if (title.trim() !== action.title) {
      saveField('title', title.trim())
    }
  }

  const commitDesc = () => {
    setEditingDesc(false)
    const val = description.trim()
    if (val !== (action.description || '')) {
      saveField('description', val || null)
    }
  }

  const commitDate = (newDate: string) => {
    setDueDate(newDate)
    setEditingDate(false)
    if (newDate !== (action.due_date || '')) {
      saveField('due_date', newDate || null)
    }
  }

  useEffect(() => {
    if (editingTitle) titleRef.current?.focus()
  }, [editingTitle])

  useEffect(() => {
    if (editingDesc) descRef.current?.focus()
  }, [editingDesc])

  const [status, setStatus] = useState(action.status)

  useEffect(() => {
    setStatus(action.status)
  }, [action.status])

  const isCompleted = status === 'completed'

  const handleToggle = () => {
    if (onToggle) {
      onToggle()
    } else {
      const newStatus = isCompleted ? 'to_do' : 'completed'
      setStatus(newStatus)
      saveField('status', newStatus)
    }
  }

  const hasDescription = editingDesc || !!description

  return (
    <div className="group flex items-center gap-2 py-1.5 px-3 rounded-md bg-muted/30 border border-border/50">
      <button
        onClick={handleToggle}
        className={`shrink-0 h-3.5 w-3.5 rounded-sm border flex items-center justify-center transition-colors ${
          isCompleted
            ? 'bg-primary border-primary text-primary-foreground'
            : 'border-muted-foreground/40 hover:border-primary'
        }`}
      >
        {isCompleted && <Check className="h-2.5 w-2.5" />}
      </button>

      <div className="flex-1 min-w-0">
        {editingTitle ? (
          <input
            ref={titleRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commitTitle() }
              if (e.key === 'Escape') { setTitle(action.title); setEditingTitle(false) }
            }}
            className="w-full text-[15px] bg-transparent outline-none"
          />
        ) : (
          <span
            onClick={() => setEditingTitle(true)}
            className={`text-[15px] cursor-text ${
              isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'
            }`}
          >
            {title}
          </span>
        )}

        {editingDesc ? (
          <input
            ref={descRef}
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={commitDesc}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commitDesc() }
              if (e.key === 'Escape') { setDescription(action.description || ''); setEditingDesc(false) }
            }}
            placeholder="Add description..."
            className="w-full text-[13px] text-muted-foreground bg-transparent outline-none mt-0.5"
          />
        ) : description ? (
          <p
            onClick={() => setEditingDesc(true)}
            className="text-[13px] text-muted-foreground mt-0.5 cursor-text"
          >
            {description}
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {extra}
        {editingDate ? (
          <input
            type="date"
            value={dueDate ? (dueDate.length > 10 ? dueDate.slice(0, 10) : dueDate) : ''}
            onChange={(e) => commitDate(e.target.value)}
            onBlur={() => setEditingDate(false)}
            autoFocus
            className="text-[13px] text-muted-foreground bg-transparent outline-none border border-border/50 rounded px-1.5 py-0.5"
          />
        ) : (
          <span
            onClick={() => setEditingDate(true)}
            className="text-[13px] text-muted-foreground flex items-center gap-1 cursor-pointer hover:text-foreground"
          >
            <Calendar className="h-3 w-3" />
            {dueDate ? format(dueDate.length > 10 ? parseISO(dueDate) : new Date(dueDate + 'T00:00:00'), 'MMM d') : 'Set date'}
          </span>
        )}
        {onDelete && (
          <button
            onClick={onDelete}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
