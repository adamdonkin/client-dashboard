'use client'

import { Check, Ban } from 'lucide-react'
import { format, isToday, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'
import { GOAL_HEALTH_META, formatGoalDue, type Goal, type GoalHealth } from '@/lib/goals'

export function GoalHealthDot({ health, className }: { health: GoalHealth | null | undefined; className?: string }) {
  return (
    <span
      className={cn(
        'shrink-0 h-2.5 w-2.5 rounded-full',
        health ? GOAL_HEALTH_META[health].dotClass : 'border border-muted-foreground/40',
        className,
      )}
      title={health ? GOAL_HEALTH_META[health].label : 'No status yet'}
    />
  )
}

interface GoalRowProps {
  goal: Goal
  onSelect?: (goal: Goal) => void
}

export function GoalRow({ goal, onSelect }: GoalRowProps) {
  const isClosed = goal.status !== 'open'
  const due = formatGoalDue(goal.due_date)
  const updatedAt = goal.latest_update ? parseISO(goal.latest_update.created_at) : null
  const updatedToday = updatedAt ? isToday(updatedAt) : false

  return (
    <div
      onClick={onSelect ? () => onSelect(goal) : undefined}
      className={cn(
        'flex items-center gap-2 py-1.5 px-3 rounded-md bg-muted/30 border border-border/50 transition-colors',
        onSelect && 'cursor-pointer hover:bg-muted/50',
        isClosed && 'opacity-50',
      )}
    >
      {goal.status === 'completed' ? (
        <Check className="h-3.5 w-3.5 shrink-0 text-success" />
      ) : goal.status === 'dropped' ? (
        <Ban className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      ) : (
        <GoalHealthDot health={goal.latest_update?.health} />
      )}

      <div className="flex-1 min-w-0 flex items-center gap-1.5">
        {goal.priority !== null && (
          <span className="text-[14px] !leading-[16px] text-muted-foreground tabular-nums shrink-0">#{goal.priority}</span>
        )}
        <span className={cn(
          'text-[14px] !leading-[16px] truncate',
          goal.status === 'completed' ? 'line-through text-muted-foreground' : 'text-foreground',
        )}>
          {goal.title}
        </span>
      </div>

      <div className="flex items-center gap-3 shrink-0 text-[13px] text-muted-foreground">
        {goal.status === 'dropped' && (
          <span className="text-[10px] font-semibold uppercase tracking-wider">Cancelled</span>
        )}
        {updatedAt && goal.status === 'open' && (
          <span className={cn('max-sm:hidden', updatedToday && 'text-success')}>
            {updatedToday ? 'Updated today' : `Updated ${format(updatedAt, 'MMM d')}`}
          </span>
        )}
        {goal.owner && <span className="max-sm:hidden">{goal.owner}</span>}
        {due && <span>{due}</span>}
      </div>
    </div>
  )
}
