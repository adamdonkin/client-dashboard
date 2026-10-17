'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { X, Trash2, Check, Copy, MoreHorizontal, XCircle, User, ChevronRight, Target, Sparkles } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ActionDatePicker } from './ActionDatePicker'
import { SessionEditor } from './SessionEditor'
import { SourceBadge, goalBadgeLabel } from '@/components/ActionRow'
import type { ActionItem } from '@/components/ActionRow'
import { cn } from '@/lib/utils'
import { copyActionToClipboard } from '@/utils/copy-actions'
import { PANEL_MOBILE_CLASS, panelSlideClass, useDismissiblePanel } from '@/lib/dismissiblePanel'
import { AVOID_QUESTION, BLOCKED_QUESTION, type ReviewEntry } from '@/lib/actionReview'

function ReviewAnswer({ question, text }: { question: string, text: string }) {
  const lines = text.split('\n')
  return (
    <div className="mt-1.5">
      <p className="text-[12px]">{question}</p>
      {lines.length === 1 ? (
        <p className="text-[14px] text-foreground">{lines[0]}</p>
      ) : (
        <ul className="list-disc pl-5 text-[14px] text-foreground">
          {lines.map((line, i) => <li key={i}>{line}</li>)}
        </ul>
      )}
    </div>
  )
}

interface ActionDetailPanelProps {
  action: ActionItem
  clientName?: string | null
  onClose: () => void
  onUpdated?: (updated: ActionItem) => void
  onDeleted?: (id: string) => void
  onGoalSelect?: (goalId: string) => void
  onMagicQuestionsSelect?: (action: ActionItem) => void
}

export function ActionDetailPanel({
  action,
  clientName,
  onClose,
  onUpdated,
  onDeleted,
  onGoalSelect,
  onMagicQuestionsSelect,
}: ActionDetailPanelProps) {
  const supabase = createClientComponentClient()
  const [title, setTitle] = useState(action.title)
  const [dueDate, setDueDate] = useState(action.due_date || '')
  const titleDebounceRef = useRef<NodeJS.Timeout | null>(null)
  const pendingTitleRef = useRef<string | null>(null)
  const actionRef = useRef(action)

  actionRef.current = action

  // The title box owns its text while the panel is open. Syncing it from the
  // saved action would clobber keystrokes typed during a save and move the cursor.
  useEffect(() => {
    setTitle(action.title)
  }, [action.id])

  useEffect(() => {
    setDueDate(action.due_date || '')
  }, [action.id, action.due_date])

  const initialContent = action.description_content || (
    action.description
      ? { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: action.description }] }] }
      : undefined
  )

  // Ahead of the save round trip, so copying right after typing includes the edit
  const latestDescriptionRef = useRef<any>(action.description_content ?? null)
  useEffect(() => {
    latestDescriptionRef.current = actionRef.current.description_content ?? null
  }, [action.id])

  const handleDescriptionUpdate = useCallback(async (content: any) => {
    latestDescriptionRef.current = content
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

  const writeTitle = useCallback(async (newTitle: string) => {
    await supabase
      .from('client_actions')
      .update({ title: newTitle.trim(), updated_at: new Date().toISOString() })
      .eq('id', actionRef.current.id)
  }, [supabase])
  const writeTitleRef = useRef(writeTitle)
  writeTitleRef.current = writeTitle

  const saveTitle = useCallback(async (newTitle: string) => {
    if (!newTitle.trim()) return
    pendingTitleRef.current = null
    await writeTitle(newTitle)
    onUpdated?.({ ...actionRef.current, title: newTitle.trim() })
  }, [writeTitle, onUpdated])

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value
    setTitle(newTitle)
    pendingTitleRef.current = newTitle
    if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current)
    titleDebounceRef.current = setTimeout(() => {
      saveTitle(newTitle)
    }, 500)
  }

  // Write a title that is still inside its debounce window. onUpdated fires up
  // front rather than after the round trip, because by then we may be unmounted
  // and the parent would read it as a request to re-open the panel.
  const flushTitle = useCallback(() => {
    if (titleDebounceRef.current) {
      clearTimeout(titleDebounceRef.current)
      titleDebounceRef.current = null
    }
    const pending = pendingTitleRef.current
    if (pending === null || !pending.trim()) return
    pendingTitleRef.current = null
    onUpdated?.({ ...actionRef.current, title: pending.trim() })
    writeTitle(pending)
  }, [writeTitle, onUpdated])

  // Safety net for unmounts that bypass requestClose, such as navigating away
  useEffect(() => {
    return () => {
      if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current)
      const pending = pendingTitleRef.current
      if (pending !== null && pending.trim()) writeTitleRef.current(pending)
    }
  }, [])

  const { panelRef, closing, requestClose } = useDismissiblePanel<HTMLDivElement>(onClose, flushTitle)

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
    await supabase
      .from('client_actions')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', action.id)
    const updated = { ...actionRef.current, status: newStatus }
    onUpdated?.(updated)
  }

  const handleCancel = async () => {
    await supabase
      .from('client_actions')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', action.id)
    const updated = { ...actionRef.current, status: 'cancelled' }
    onUpdated?.(updated)
    requestClose()
  }

  const handleDelete = async () => {
    requestClose()
    onDeleted?.(action.id)
    await supabase.from('client_actions').delete().eq('id', action.id)
    toast('Action deleted')
  }

  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await copyActionToClipboard({
      title: title.trim() || action.title,
      due_date: dueDate || null,
      description: action.description,
      description_content: latestDescriptionRef.current ?? initialContent,
    })
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const history = action.review_history || []

  return (
    <>
      <div
        ref={panelRef}
        className={cn(
          'fixed top-0 right-0 z-50 h-full w-[420px] max-w-[90vw] bg-background border-l border-border shadow-xl',
          PANEL_MOBILE_CLASS,
          panelSlideClass(closing),
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
              <button
                onClick={handleCopy}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                title="Copy to clipboard"
              >
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              </button>
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
                onClick={requestClose}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 flex flex-col overflow-hidden pb-6">
            {/* Title */}
            <div className="px-5 pt-4 pb-4">
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
                className="w-full text-[17px] font-medium bg-transparent outline-none placeholder:text-muted-foreground resize-none overflow-hidden"
                placeholder="Action title..."
              />
            </div>

            <div className="border-t border-border/40" />

            {/* Due date */}
            <div className="h-[48px] flex items-center gap-3 text-[13px] px-5">
              <span className="text-muted-foreground">Due</span>
              <ActionDatePicker
                value={dueDate ? (dueDate.length > 10 ? dueDate.slice(0, 10) : dueDate) : ''}
                onChange={handleDateChange}
              />
            </div>

            <div className="border-t border-border/40" />

            {/* Assignee */}
            <div className="h-[48px] flex items-center gap-3 text-[13px] px-5">
              <span className="text-muted-foreground">For</span>
              <button
                onClick={async () => {
                  const newVal = action.assigned_to ? null : action.assigned_to === null ? 'self' : null
                  const { data: { session } } = await supabase.auth.getSession()
                  if (!session) return
                  const assignedTo = action.assigned_to ? null : session.user.id
                  await supabase
                    .from('client_actions')
                    .update({ assigned_to: assignedTo, updated_at: new Date().toISOString() })
                    .eq('id', action.id)
                  const updated = { ...actionRef.current, assigned_to: assignedTo }
                  onUpdated?.(updated)
                }}
                className="flex items-center gap-1.5 text-[13px] px-2 py-0.5 rounded-md hover:bg-accent transition-colors cursor-pointer"
              >
                <User className="h-3 w-3 text-muted-foreground" />
                <span>{action.assigned_to ? 'Me (Adam)' : (clientName || 'Client')}</span>
              </button>
            </div>

            <div className="border-t border-border/40" />

            {/* Goal the action came from, if any */}
            {action.goal && (
              <>
                <div className="h-[48px] flex items-center gap-3 text-[13px] px-5">
                  <span className="text-muted-foreground">Goal</span>
                  {onGoalSelect ? (
                    <button
                      onClick={() => onGoalSelect(action.goal!.id)}
                      className="flex items-center gap-1.5 min-w-0 text-[13px] px-2 py-0.5 rounded-md hover:bg-accent transition-colors cursor-pointer"
                      title="Open goal"
                    >
                      <Target className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="truncate underline underline-offset-2 decoration-muted-foreground/40">{goalBadgeLabel(action.goal)}</span>
                      <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    </button>
                  ) : (
                    <span className="flex items-center gap-1.5 min-w-0 px-2">
                      <Target className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="truncate">{goalBadgeLabel(action.goal)}</span>
                    </span>
                  )}
                </div>

                <div className="border-t border-border/40" />
              </>
            )}

            {/* Magic Questions round the action came from */}
            {action.from_magic_questions && action.session_note_id && (
              <>
                <div className="h-[48px] flex items-center gap-3 text-[13px] px-5">
                  <span className="text-muted-foreground">From</span>
                  {onMagicQuestionsSelect ? (
                    <button
                      onClick={() => onMagicQuestionsSelect(action)}
                      className="flex items-center gap-1.5 min-w-0 text-[13px] px-2 py-0.5 rounded-md hover:bg-accent transition-colors cursor-pointer"
                      title="Open Magic Questions"
                    >
                      <Sparkles className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="underline underline-offset-2 decoration-muted-foreground/40">Magic Questions</span>
                      <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    </button>
                  ) : (
                    <span className="flex items-center gap-1.5 px-2">
                      <Sparkles className="h-3 w-3 text-muted-foreground shrink-0" />
                      Magic Questions
                    </span>
                  )}
                </div>

                <div className="border-t border-border/40" />
              </>
            )}

            {/* Created date & source */}
            <div className="h-[48px] flex items-center justify-between px-5">
              {action.created_at && (
                <span className="text-[11px] text-muted-foreground/60">
                  Created {format(parseISO(action.created_at), 'MMM d, yyyy')}
                </span>
              )}
              {action.source && (
                <SourceBadge source={action.source} sourceUrl={action.source_url} sessionNoteId={action.session_note_id} />
              )}
            </div>

            <div className="border-t border-border/40" />

            {/* Description */}
            <div className="flex-1 min-h-0 overflow-y-auto action-panel-editor px-5 pt-[24px]">
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
            <div className="px-5 pt-3 pb-5 border-t border-border/50 max-h-[280px] overflow-y-auto">
              <p className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Not done</p>
              {[...history].reverse().map((entry: ReviewEntry, i: number) => (
                <div key={i} className="py-2 border-t border-border/30 first-of-type:border-t-0 text-[13px] text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{format(new Date(entry.date), 'MMM d, yyyy')}</span>
                    {entry.outcome === 'cancelled' ? (
                      <span>Cancelled</span>
                    ) : entry.new_due_date ? (
                      <span>
                        {entry.previous_due_date ? `${format(parseISO(entry.previous_due_date.slice(0, 10)), 'MMM d')} → ` : '→ '}
                        {format(parseISO(entry.new_due_date), 'MMM d')}
                      </span>
                    ) : null}
                  </div>
                  {entry.notes && (
                    <p className="whitespace-pre-wrap text-[13px] mt-1">{entry.notes}</p>
                  )}
                  {entry.blocked_by && <ReviewAnswer question={BLOCKED_QUESTION} text={entry.blocked_by} />}
                  {entry.will_do && <ReviewAnswer question={AVOID_QUESTION} text={entry.will_do} />}
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
