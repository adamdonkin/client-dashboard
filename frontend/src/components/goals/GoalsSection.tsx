'use client'

import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { GoalRow } from './GoalRow'
import { GOAL_COLUMNS, sortGoals, toGoal, type Goal } from '@/lib/goals'

interface GoalsSectionProps {
  clientId: string
  /** Goals written in this note are already on the page, so they are left out */
  excludeSessionNoteId?: string
  refreshKey?: number
  onGoalSelect?: (goal: Goal) => void
  /** Reports how many goals the list has, so the parent can hide an empty section */
  onCountChange?: (count: number) => void
  openOnly?: boolean
}

export interface GoalsSectionHandle {
  applyChanged: (updated: Goal) => void
  applyRemoved: (id: string) => void
  getGoals: () => Goal[]
}

export const GoalsSection = forwardRef<GoalsSectionHandle, GoalsSectionProps>(function GoalsSection(
  { clientId, excludeSessionNoteId, refreshKey, onGoalSelect, onCountChange, openOnly = false },
  ref,
) {
  const supabase = createClientComponentClient()
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [showClosed, setShowClosed] = useState(false)

  const fetchGoals = useCallback(async () => {
    let query = supabase.from('client_goals').select(GOAL_COLUMNS).eq('client_id', clientId)
    if (excludeSessionNoteId) {
      query = query.or(`session_note_id.is.null,session_note_id.neq.${excludeSessionNoteId}`)
    }
    if (openOnly) query = query.eq('status', 'open')
    const { data, error } = await query
    if (error) console.error('Error loading goals:', error)
    setGoals(sortGoals((data || []).map(toGoal)))
    setLoading(false)
  }, [clientId, excludeSessionNoteId, openOnly, supabase])

  useEffect(() => {
    fetchGoals()
  }, [fetchGoals, refreshKey])

  useEffect(() => {
    if (!loading) onCountChange?.(goals.length)
  }, [goals.length, loading, onCountChange])

  useImperativeHandle(ref, () => ({
    applyChanged: (updated) => setGoals(prev => sortGoals(
      prev.some(g => g.id === updated.id) ? prev.map(g => g.id === updated.id ? updated : g) : [...prev, updated]
    )),
    applyRemoved: (id) => setGoals(prev => prev.filter(g => g.id !== id)),
    getGoals: () => goals,
  }))

  if (loading) {
    return <p className="text-[15px] text-muted-foreground">Loading goals...</p>
  }

  const open = goals.filter(g => g.status === 'open')
  const closed = goals.filter(g => g.status !== 'open')

  return (
    <div className="space-y-1.5">
      {open.length === 0 && <p className="text-[15px] text-muted-foreground">No open goals</p>}
      {open.map(goal => (
        <GoalRow key={goal.id} goal={goal} onSelect={onGoalSelect} />
      ))}

      {closed.length > 0 && (
        <button
          onClick={() => setShowClosed(prev => !prev)}
          className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer pt-1"
        >
          {showClosed ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          {showClosed ? 'Hide completed & cancelled' : 'Show completed & cancelled'}
        </button>
      )}

      {showClosed && closed.map(goal => (
        <GoalRow key={goal.id} goal={goal} onSelect={onGoalSelect} />
      ))}
    </div>
  )
})
