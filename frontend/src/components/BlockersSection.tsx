'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { ACTION_COLUMNS, type ActionItem } from '@/components/ActionRow'
import { formatRoundDate } from '@/components/magic/MagicQuestionsPanel'
import { blockersOf, type Blocker } from '@/lib/actionReview'

const COLLAPSED_COUNT = 5

interface BlockersSectionProps {
  clientId: string
  refreshKey?: number
  onActionSelect?: (action: ActionItem) => void
  onCountChange?: (count: number) => void
}

/** Every "What blocked you?" answer for the client, so recurring blockers are easy to spot */
export function BlockersSection({ clientId, refreshKey, onActionSelect, onCountChange }: BlockersSectionProps) {
  const supabase = createClientComponentClient()
  const [blockers, setBlockers] = useState<Blocker[]>([])
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('client_actions')
      .select(ACTION_COLUMNS)
      .eq('client_id', clientId)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error('Error loading blockers:', error)
          return
        }
        const found = blockersOf((data ?? []) as unknown as ActionItem[])
        setBlockers(found)
        onCountChange?.(found.length)
      })
    return () => { cancelled = true }
  }, [clientId, refreshKey, supabase, onCountChange])

  const shown = showAll ? blockers : blockers.slice(0, COLLAPSED_COUNT)

  return (
    <div>
      {shown.map((b, i) => (
        <button
          key={`${b.action.id}-${b.date}`}
          onClick={() => onActionSelect?.(b.action)}
          className={`w-full text-left py-2.5 cursor-pointer group ${i > 0 ? 'border-t border-border/40' : 'pt-0'}`}
        >
          <p className="text-[14px] whitespace-pre-wrap">{b.text}</p>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            {formatRoundDate(b.date)}
            {' · '}
            <span className="group-hover:underline underline-offset-2">{b.action.title}</span>
          </p>
        </button>
      ))}
      {blockers.length > COLLAPSED_COUNT && (
        <button
          onClick={() => setShowAll(v => !v)}
          className="mt-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          {showAll ? 'Show fewer' : `Show all (${blockers.length})`}
        </button>
      )}
    </div>
  )
}
