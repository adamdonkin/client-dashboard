'use client'

import { useState, useRef, useEffect } from 'react'
import { format, addDays } from 'date-fns'
import { X } from 'lucide-react'
import { ActionDatePicker } from './ActionDatePicker'

interface ActionCreateFormProps {
  onSubmit: (title: string, dueDate: string) => void
  onCancel: () => void
  prefillTitle?: string
  autoFocus?: boolean
}

export function ActionCreateForm({ onSubmit, onCancel, prefillTitle = '', autoFocus = true }: ActionCreateFormProps) {
  const [title, setTitle] = useState(prefillTitle)
  const [dueDate, setDueDate] = useState(format(addDays(new Date(), 7), 'yyyy-MM-dd'))
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [autoFocus])

  const handleSubmit = () => {
    if (!title.trim()) return
    onSubmit(title.trim(), dueDate)
  }

  return (
    <div className="rounded-md bg-muted/30 border border-primary/30 py-2 px-3">
      <div className="flex items-center gap-2">
        <div className="shrink-0 h-3.5 w-3.5 rounded-sm border border-muted-foreground/40" />
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); handleSubmit() }
            if (e.key === 'Escape') onCancel()
          }}
          placeholder="Action title..."
          className="flex-1 text-[13px] bg-transparent outline-none"
        />
        <ActionDatePicker value={dueDate} onChange={setDueDate} />
        <button onClick={handleSubmit} className="text-[13px] text-primary font-medium hover:text-primary/80 cursor-pointer">Add</button>
        <button onClick={onCancel} className="p-0.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer" title="Cancel">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
