'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { X, Trash2, Check, MoreHorizontal, XCircle } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ActionDatePicker } from './ActionDatePicker'
import { SessionEditor } from './SessionEditor'
import { SourceBadge } from '@/components/ActionRow'
import type { ActionItem } from '@/components/ActionRow'
import { cn } from '@/lib/utils'

interface ActionDetailPanelProps {
  action: ActionItem
  onClose: () => void
  onUpdated?: (updated: ActionItem) => void
  onDeleted?: (id: string) => void
}

export function ActionDetailPanel({
  action,
  onClose,
  onUpdated,
  onDeleted,
}: ActionDetailPanelProps) {
  const supabase = createClientComponentClient()
  const [title, setTitle] = useState(action.title)
  const [dueDate, setDueDate] = useState(action.due_date || '')
  const titleDebounceRef = useRef<NodeJS.Timeout | null>(null)
  const actionRef = useRef(action)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    actionRef.current = action
    setTitle(action.title)
    setDueDate(action.due_date || '')
  }, [action.id, action.title, action.due_date])

  const initialContent = action.description_content || (
    action.description
      ? { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: action.description }] }] }
      : undefined
  )

  const handleDescriptionUpdate = useCallback(async (content: any) => {
    const plainText = extractPlainText(content)
    await supabase
      .from('client_actions')
      .update({
        description_content: content,
        description: plainText || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', actionRef.current.id)

    onUpdated?.({
      ...actionRef.current,
      description_content: content,
      description: plainText || null,
    })
  }, [supabase, onUpdated])

  useEffect(() => {
    return () => {
      if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current)
    }
  }, [])

  const saveTitle = useCallback(async (newTitle: string) => {
    if (!newTitle.trim()) return
    await supabase
      .from('client_actions')
      .update({ title: newTitle.trim(), updated_at: new Date().toISOString() })
      .eq('id', actionRef.current.id)

    onUpdated?.({ ...actionRef.current, title: newTitle.trim() })
  }, [supabase, onUpdated])

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value
    setTitle(newTitle)
    if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current)
    titleDebounceRef.current = setTimeout(() => {
      saveTitle(newTitle)
    }, 500)
  }

  const handleDateChange = async (newDate: string) => {
    setDueDate(newDate)
    await supabase
      .from('client_actions')
      .update({ due_date: newDate || null, updated_at: new Date().toISOString() })
      .eq('id', actionRef.current.id)

    onUpdated?.({ ...actionRef.current, due_date: newDate || null })
  }

  const isCompleted = action.status === 'completed'

  const toggleDone = async () => {
    const newStatus = isCompleted ? 'to_do' : 'completed'
    const updated = { ...actionRef.current, status: newStatus }
    onUpdated?.(updated)
    await supabase
      .from('client_actions')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', action.id)
  }

  const handleCancel = async () => {
    const updated = { ...actionRef.current, status: 'cancelled' }
    onUpdated?.(updated)
    await supabase
      .from('client_actions')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', action.id)
  }

  const handleDelete = () => {
    onClose()
    onDeleted?.(action.id)

    const timeoutId = setTimeout(async () => {
      await supabase.from('client_actions').delete().eq('id', action.id)
    }, 5000)

    toast('Action deleted', {
      action: {
        label: 'Undo',
        onClick: () => clearTimeout(timeoutId),
      },
      duration: 5000,
    })
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const history = action.review_history || []

  return (
    <>
      <div
        ref={panelRef}
        className={cn(
          'fixed top-0 right-0 z-50 h-full w-[420px] max-w-[90vw] bg-background border-l border-border shadow-xl',
          'animate-in slide-in-from-right duration-200',
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border/50">
            <button
              onClick={toggleDone}
              className={cn(
                'flex items-center gap-1.5 text-[13px] px-2.5 py-1 rounded-md border transition-colors',
                isCompleted
                  ? 'border-success/40 bg-success/15 text-success'
                  : 'border-foreground/20 text-foreground/70 hover:text-foreground hover:border-foreground/40',
              )}
            >
              <Check className="h-3.5 w-3.5" />
              {isCompleted ? 'Completed' : 'Mark complete'}
            </button>
            <div className="flex items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleCancel}>
                    <XCircle className="h-3.5 w-3.5 mr-2" />
                    Cancel action
                  </DropdownMenuItem>
                  {onDeleted && (
                    <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
                      <Trash2 className="h-3.5 w-3.5 mr-2" />
                      Delete action
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <button
                onClick={onClose}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 flex flex-col overflow-hidden px-5 pt-4 pb-6">
            {/* Title */}
            <textarea
              value={title}
              onChange={(e) => {
                handleTitleChange(e as any)
                e.target.style.height = 'auto'
                e.target.style.height = e.target.scrollHeight + 'px'
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }}
              ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }}
              rows={1}
              className="w-full text-[17px] font-medium bg-transparent outline-none placeholder:text-muted-foreground mb-4 resize-none overflow-hidden"
              placeholder="Action title..."
            />

            {/* Due date */}
            <div className="flex items-center gap-3 text-[13px]">
              <span className="text-muted-foreground">Due</span>
              <ActionDatePicker
                value={dueDate ? (dueDate.length > 10 ? dueDate.slice(0, 10) : dueDate) : ''}
                onChange={handleDateChange}
              />
            </div>

            {/* Source */}
            {action.source && (
              <div className="mt-2 mb-6">
                <SourceBadge source={action.source} sourceUrl={action.source_url} sessionNoteId={action.session_note_id} />
              </div>
            )}
            {!action.source && <div className="mb-6" />}

            {/* Description */}
            <div className="flex-1 min-h-0 overflow-y-auto action-panel-editor">
              <SessionEditor
                key={action.id}
                content={initialContent || undefined}
                onUpdate={handleDescriptionUpdate}
                placeholder="Add notes…"
                showActionButtons={false}
              />
            </div>
          </div>

          {/* Review history */}
          {history.length > 0 && (
            <div className="px-5 pt-3 pb-5 border-t border-border/50 max-h-[200px] overflow-y-auto space-y-2">
              <p className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">Review History</p>
              {history.map((entry: any, i: number) => (
                <div key={i} className="text-[13px] text-muted-foreground space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">
                      {entry.outcome === 'extended' ? 'Extended' : entry.outcome === 'cancelled' ? 'Cancelled' : entry.outcome}
                    </span>
                    <span>{format(new Date(entry.date), 'MMM d, yyyy')}</span>
                    {entry.new_due_date && (
                      <span>→ {format(parseISO(entry.new_due_date), 'MMM d')}</span>
                    )}
                  </div>
                  {entry.notes && (
                    <p className="whitespace-pre-wrap text-[13px] text-muted-foreground">{entry.notes}</p>
                  )}
                  {entry.blocked_by && (
                    <p className="text-[13px]">Blocked: {entry.blocked_by}</p>
                  )}
                  {entry.will_do && (
                    <p className="text-[13px]">Will do: {entry.will_do}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function extractPlainText(content: any): string {
  if (!content) return ''
  const parts: string[] = []
  function walk(node: any) {
    if (node.type === 'text') {
      parts.push(node.text || '')
    } else if (node.content) {
      for (const child of node.content) {
        walk(child)
      }
      if (node.type === 'paragraph' || node.type === 'listItem') {
        parts.push('\n')
      }
    }
  }
  walk(content)
  return parts.join('').trim()
}
