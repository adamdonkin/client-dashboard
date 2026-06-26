'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Check, X, Trash2 } from 'lucide-react'
import { format, isPast, isToday, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { toast } from 'sonner'
import { ActionDatePicker } from '@/components/session/ActionDatePicker'
import { ActionDetailDialog } from '@/components/session/ActionDetailDialog'
import { ActionReviewDialog } from '@/components/session/ActionReviewDialog'

export interface ActionItem {
  id: string
  title: string
  description?: string | null
  source?: 'defacto' | 'granola' | 'session'
  due_date: string | null
  status: string
  source_url?: string | null
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

export function SourceBadge({ source }: { source: 'defacto' | 'granola' | 'session' }) {
  if (source === 'defacto') {
    return (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-chart-3/30 text-chart-3 font-medium">
        Defacto
      </Badge>
    )
  }
  if (source === 'session') {
    return (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary font-medium">
        Session
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-success/30 text-success font-medium">
      Granola
    </Badge>
  )
}

interface ActionRowProps {
  action: ActionItem
  onChanged?: (updated: ActionItem) => void
  onRemoved?: (id: string) => void
  showSource?: boolean
  className?: string
}

export function ActionRow({
  action: initialAction,
  onChanged,
  onRemoved,
  showSource = false,
  className,
}: ActionRowProps) {
  const supabase = createClientComponentClient()
  const [action, setAction] = useState(initialAction)
  const [detailOpen, setDetailOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)

  // Keep in sync if parent passes new data
  if (initialAction.id !== action.id || initialAction.status !== action.status || initialAction.due_date !== action.due_date || initialAction.title !== action.title) {
    setAction(initialAction)
  }

  const overdue = isOverdue(action.due_date)
  const showReviewButtons = isDueOrOverdue(action.due_date) && action.status === 'to_do'
  const isResolved = action.status === 'completed' || action.status === 'cancelled'

  const handleRowClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, [data-slot="popover-content"], [data-radix-popper-content-wrapper]')) return
    setDetailOpen(true)
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

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    const deletedAction = { ...action }

    onRemoved?.(action.id)

    const timeoutId = setTimeout(async () => {
      await supabase.from('client_actions').delete().eq('id', deletedAction.id)
    }, 5000)

    toast('Action deleted', {
      action: {
        label: 'Undo',
        onClick: () => {
          clearTimeout(timeoutId)
          onChanged?.(deletedAction)
        },
      },
      duration: 5000,
    })
  }

  const handleNotDone = (e: React.MouseEvent) => {
    e.stopPropagation()
    setReviewOpen(true)
  }

  const handleReviewUpdated = async () => {
    const { data } = await supabase
      .from('client_actions')
      .select('id, title, description, source, due_date, status, review_history')
      .eq('id', action.id)
      .single()

    if (data) {
      setAction(data)
      onChanged?.(data)
    }
  }

  const handleDetailUpdated = (updated: ActionItem) => {
    setAction(updated)
    onChanged?.(updated)
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
              'text-[14px] leading-snug',
              isResolved ? 'line-through text-muted-foreground' : 'text-foreground',
            )}
          >
            {action.title}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {showSource && action.source && (
            <SourceBadge source={action.source} />
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

          {!isResolved && (
            <button
              onClick={handleDelete}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}

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
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {detailOpen && (
        <ActionDetailDialog
          action={action}
          open={detailOpen}
          onOpenChange={setDetailOpen}
          onUpdated={handleDetailUpdated}
        />
      )}

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
