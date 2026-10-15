'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { toast } from 'sonner'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { SessionEditor } from '@/components/session/SessionEditor'
import { cn } from '@/lib/utils'
import { PANEL_MOBILE_CLASS, panelSlideClass, useDismissiblePanel } from '@/lib/dismissiblePanel'
import { fetchMagicQuestions, type MagicQuestionsRound } from '@/lib/magicQuestions'

export function formatRoundDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    timeZone: 'America/Los_Angeles',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

interface MagicQuestionsPanelProps {
  /** Newest first */
  rounds: MagicQuestionsRound[]
  index: number
  onIndexChange: (index: number) => void
  onClose: () => void
}

/** Opens on the round from one session, as from an action written in it; the arrows still reach the others */
export function MagicQuestionsRoundPanel({ clientId, sessionNoteId, onClose }: { clientId: string; sessionNoteId: string; onClose: () => void }) {
  const supabase = createClientComponentClient()
  const [rounds, setRounds] = useState<MagicQuestionsRound[] | null>(null)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    fetchMagicQuestions(supabase, clientId).then(found => {
      const at = found.findIndex(r => r.sessionNoteId === sessionNoteId)
      if (at < 0) {
        toast('That session no longer has a Magic Questions section')
        onClose()
        return
      }
      setRounds(found)
      setIndex(at)
    })
  }, [clientId, sessionNoteId, supabase])

  if (!rounds) return null
  return <MagicQuestionsPanel rounds={rounds} index={index} onIndexChange={setIndex} onClose={onClose} />
}

export function MagicQuestionsPanel({ rounds, index, onIndexChange, onClose }: MagicQuestionsPanelProps) {
  const { panelRef, closing, requestClose } = useDismissiblePanel<HTMLDivElement>(onClose)
  const round = rounds[index]
  if (!round) return null

  const navButton = 'p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-30 disabled:pointer-events-none'

  return (
    <div
      ref={panelRef}
      className={cn(
        'fixed top-0 right-0 z-50 h-full w-[480px] max-w-[90vw] bg-background border-l border-border shadow-xl',
        PANEL_MOBILE_CLASS,
        panelSlideClass(closing),
      )}
    >
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/50">
          <div className="flex items-center gap-1">
            <button onClick={() => onIndexChange(index + 1)} disabled={index >= rounds.length - 1} className={navButton} title="Earlier">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-[14px] font-medium px-1">{formatRoundDate(round.sessionDate)}</span>
            <button onClick={() => onIndexChange(index - 1)} disabled={index <= 0} className={navButton} title="Later">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={`/sessions/${round.sessionNoteId}`}
              className="text-[13px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Session
            </a>
            <button onClick={requestClose} className={navButton}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pt-2 pb-8">
          <SessionEditor
            key={round.sessionNoteId}
            content={round.content}
            onUpdate={async () => {}}
            readOnly
            dimWhenReadOnly={false}
            placeholder=""
            showActionButtons={false}
            trailingParagraph={false}
          />
        </div>
      </div>
    </div>
  )
}
