'use client'

import { Badge } from '@/components/ui/badge'
import { Calendar } from 'lucide-react'
import { format, isPast, parseISO } from 'date-fns'

export interface ActionItem {
  id: string
  title: string
  description: string | null
  source: 'defacto' | 'granola' | 'session'
  due_date: string | null
  source_url: string | null
}

export function formatDueDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return format(parseISO(dateStr), 'MMM d')
}

export function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false
  return isPast(parseISO(dateStr))
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

export function ActionRow({ action }: { action: ActionItem }) {
  const overdue = isOverdue(action.due_date)
  const clickable = !!action.source_url

  function handleClick() {
    if (action.source_url) {
      window.open(action.source_url, '_blank', 'noopener')
    }
  }

  return (
    <div
      className={`py-2.5 px-4 hover:bg-muted/50 rounded-md transition-colors ${clickable ? 'cursor-pointer' : ''}`}
      onClick={handleClick}
    >
      <div className="flex items-center gap-3">
        <div className="shrink-0 w-[52px]">
          <SourceBadge source={action.source} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground leading-snug">{action.title}</p>
          {action.description && (
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{action.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {action.due_date && (
            <span className={`text-xs flex items-center gap-1 ${overdue ? 'text-danger' : 'text-muted-foreground'}`}>
              <Calendar className="h-3 w-3" />
              {formatDueDate(action.due_date)}
            </span>
          )}
          {!action.due_date && (
            <span className="text-xs text-muted-foreground w-[60px] text-right">—</span>
          )}
        </div>
      </div>
    </div>
  )
}
