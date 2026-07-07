'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Check, Ban } from 'lucide-react'
import { format, isPast, isToday, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { ActionDatePicker } from '@/components/session/ActionDatePicker'
import { ActionReviewDialog } from '@/components/session/ActionReviewDialog'

export interface ActionItem {
  id: string
  title: string
  description?: string | null
  description_content?: any | null
  source?: string | null
  due_date: string | null
  status: string
  source_url?: string | null
  session_note_id?: string | null
  review_history?: any[]
}

export function formatDueDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return format(parseISO(dateStr), 'MMM d')
}

export function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false
  return isPast(parseISO(dateStr))
}

function isDueOrOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false
  const d = parseISO(dateStr)
  return isToday(d) || isPast(d)
}

export function SourceBadge({ source, sourceUrl, sessionNoteId }: { source: string | null, sourceUrl?: string | null, sessionNoteId?: string | null }) {
  const router = useRouter()

  const handleClick = (e: React.MouseEvent, href: string, external?: boolean) => {
    e.stopPropagation()
    if (external) {
      window.open(href, '_blank', 'noopener')
    } else {
      router.push(href)
    }
  }

  if (source === 'defacto') {
    return (
      <Badge
        variant="outline"
        className={cn('text-[10px] px-1.5 py-0 border-chart-3/30 text-chart-3 font-medium', sourceUrl && 'cursor-pointer hover:bg-chart-3/10')}
        onClick={sourceUrl ? (e) => handleClick(e, sourceUrl, true) : undefined}
      >
        Defacto
      </Badge>
    )
  }
  if (source === 'session') {
    return (
      <Badge
        variant="outline"
        className={cn('text-[10px] px-1.5 py-0 border-primary/30 text-primary font-medium', sessionNoteId && 'cursor-pointer hover:bg-primary/10')}
        onClick={sessionNoteId ? (e) => handleClick(e, `/sessions/${sessionNoteId}`) : undefined}
      >
        Session
      </Badge>
    )
  }
  if (source === 'granola') {
    return (
      <Badge
        variant="outline"
        className={cn('text-[10px] px-1.5 py-0 border-success/30 text-success font-medium', sourceUrl && 'cursor-pointer hover:bg-success/10')}
        onClick={sourceUrl ? (e) => handleClick(e, sourceUrl, true) : undefined}
      >
        Granola
      </Badge>
    )
  }
  return null
}

interface ActionRowProps {
  action: ActionItem
  onChanged?: (updated: ActionItem) => void
  onRemoved?: (id: string) => void
  onSelect?: (action: ActionItem) => void
  showSource?: boolean
  className?: string
}

export function ActionRow({
  action: initialAction,
  onChanged,
  onRemoved,
  onSelect,
  showSource = false,
  className,
}: ActionRowProps) {
  const supabase = createClientComponentClient()
  const [action, setAction] = useState(initialAction)
  const [reviewOpen, setReviewOpen] = useState(false)

  // Keep in sync if parent passes new data
  if (initialAction.id !== action.id || initialAction.status !== action.status || initialAction.due_date !== action.due_date || initialAction.title !== action.title || initialAction.description !== action.description || JSON.stringify(initialAction.description_content) !== JSON.stringify(action.description_content)) {
    setAction(initialAction)
  }

  const overdue = isOverdue(action.due_date)
  const showReviewButtons = isDueOrOverdue(action.due_date) && action.status === 'to_do'
  const isResolved = action.status === 'completed' || action.status === 'cancelled'

  const handleRowClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, [data-slot="popover-content"], [data-radix-popper-content-wrapper]')) return
    onSelect?.(action)
  }

  const toggleDone = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const newStatus = action.status === 'completed' ? 'to_do' : 'completed'
    const updated = { ...action, status: newStatus }
    setAction(updated)
    onChanged?.(updated)
    await supabase
      .from('client_actions')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', action.id)
  }

  const handleDateChange = (newDate: string) => {
    const updated = { ...action, due_date: newDate || null }
    setAction(updated)
    onChanged?.(updated)
    supabase
      .from('client_actions')
      .update({ due_date: newDate || null, updated_at: new Date().toISOString() })
      .eq('id', action.id)
      .then()
  }

  const handleNotDone = (e: React.MouseEvent) => {
    e.stopPropagation()
    setReviewOpen(true)
  }

  const handleReviewUpdated = async () => {
    const { data } = await supabase
      .from('client_actions')
      .select('id, title, description, description_content, source, source_url, session_note_id, due_date, status, review_history')
      .eq('id', action.id)
      .single()

    if (data) {
      setAction(data)
      onChanged?.(data)
    }
  }

  return (
    <>
      <div
        onClick={handleRowClick}
        className={cn(
          'group flex items-center gap-2 py-1.5 px-3 rounded-md bg-muted/30 border border-border/50 transition-colors cursor-pointer hover:bg-muted/50',
          isResolved && 'opacity-50',
          className,
        )}
      >
        <button
          onClick={toggleDone}
          className={cn(
            'shrink-0 h-3.5 w-3.5 rounded-sm border flex items-center justify-center transition-colors cursor-pointer',
            isResolved
              ? 'bg-primary border-primary text-primary-foreground'
              : 'border-muted-foreground/40 hover:border-primary',
          )}
        >
          {isResolved && <Check className="h-2.5 w-2.5" />}
        </button>

        <div className="flex-1 min-w-0">
          <span
            className={cn(
              'action-row-title text-[14px] !leading-[16px]',
              isResolved ? 'line-through text-muted-foreground' : 'text-foreground',
            )}
          >
            {action.title}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {showSource && action.source && (
            <SourceBadge source={action.source} sourceUrl={action.source_url} sessionNoteId={action.session_note_id} />
          )}

          {isResolved && action.status === 'cancelled' && (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Cancelled</span>
          )}

          <div onClick={(e) => e.stopPropagation()}>
            <ActionDatePicker
              value={action.due_date ? (action.due_date.length > 10 ? action.due_date.slice(0, 10) : action.due_date) : ''}
              onChange={handleDateChange}
              className={overdue ? 'text-danger' : undefined}
            />
          </div>

          {showReviewButtons && (
            <div className="flex items-center gap-0.5">
              <button
                onClick={toggleDone}
                className="p-1 rounded hover:bg-green-100 dark:hover:bg-green-900/30 text-muted-foreground hover:text-success transition-colors cursor-pointer"
                title="Done"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={handleNotDone}
                className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-muted-foreground hover:text-danger transition-colors cursor-pointer"
                title="Not done"
              >
                <Ban className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {reviewOpen && (
        <ActionReviewDialog
          action={action}
          open={reviewOpen}
          onOpenChange={setReviewOpen}
          onActionUpdated={handleReviewUpdated}
        />
      )}
    </>
  )
}
