'use client'

import { useRef, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'
import { SessionEditor } from './SessionEditor'
import { ActionDatePicker } from './ActionDatePicker'
import { ACTION_COLUMNS, type ActionItem } from '@/components/ActionRow'
import { emptySubBullet, parseGoalDue } from '@/lib/goals'
import {
  AVOID_QUESTION,
  BLOCKED_QUESTION,
  BY_WHEN_QUESTION,
  docLines,
  type ReviewEntry,
} from '@/lib/actionReview'

interface NotDoneReviewProps {
  action: ActionItem
  sessionNoteId?: string
  onUpdated: (updated: ActionItem) => void
  onClose: () => void
}

const emptyAnswer = () => ({ type: 'doc', content: [emptySubBullet()] })

export function NotDoneReview({ action, sessionNoteId, onUpdated, onClose }: NotDoneReviewProps) {
  const supabase = createClientComponentClient()
  const [step, setStep] = useState<'ask' | 'questions'>('ask')
  const [byWhen, setByWhen] = useState('')
  const [saving, setSaving] = useState(false)
  const blockedEditorRef = useRef<any>(null)
  const avoidEditorRef = useRef<any>(null)
  const initialBlocked = useRef(emptyAnswer()).current
  const initialAvoid = useRef(emptyAnswer()).current

  const newDueDate = parseGoalDue(byWhen)

  const save = async (fields: Record<string, any>, entry: ReviewEntry) => {
    setSaving(true)
    const { data, error } = await supabase
      .from('client_actions')
      .update({
        ...fields,
        review_history: [...(action.review_history ?? []), entry],
        updated_at: new Date().toISOString(),
      })
      .eq('id', action.id)
      .select(ACTION_COLUMNS)
      .single()
    setSaving(false)
    if (error || !data) {
      console.error('Error saving action review:', error)
      toast.error('Could not save the review. Try again.')
      return null
    }
    return data as unknown as ActionItem
  }

  const cancelAction = async () => {
    const before = action
    const updated = await save({ status: 'cancelled' }, { date: new Date().toISOString(), outcome: 'cancelled' })
    if (!updated) return
    onUpdated(updated)
    onClose()
    toast('Action cancelled', {
      action: {
        label: 'Undo',
        onClick: async () => {
          const { data, error } = await supabase
            .from('client_actions')
            .update({ status: before.status, review_history: before.review_history ?? [], updated_at: new Date().toISOString() })
            .eq('id', before.id)
            .select(ACTION_COLUMNS)
            .single()
          if (error || !data) {
            console.error('Error undoing cancel:', error)
            toast.error('Could not undo. Try again.')
            return
          }
          onUpdated(data as unknown as ActionItem)
        },
      },
    })
  }

  const saveAnswers = async () => {
    if (!newDueDate || saving) return
    const blocked = blockedEditorRef.current?.getJSON() ?? initialBlocked
    const avoid = avoidEditorRef.current?.getJSON() ?? initialAvoid
    const blockedLines = docLines(blocked)
    const avoidLines = docLines(avoid)
    const entry: ReviewEntry = {
      date: new Date().toISOString(),
      outcome: 'extended',
      previous_due_date: action.due_date,
      new_due_date: newDueDate,
      session_note_id: sessionNoteId ?? null,
      blocked_by: blockedLines.length ? blockedLines.join('\n') : null,
      blocked_by_content: blockedLines.length ? blocked : null,
      will_do: avoidLines.length ? avoidLines.join('\n') : null,
      will_do_content: avoidLines.length ? avoid : null,
    }
    const updated = await save(
      { due_date: newDueDate, ...(sessionNoteId ? { session_note_id: sessionNoteId } : {}) },
      entry,
    )
    if (!updated) return
    onUpdated(updated)
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && step === 'questions') {
      e.preventDefault()
      saveAnswers()
    }
  }

  return (
    <div
      onKeyDown={handleKeyDown}
      onClick={(e) => e.stopPropagation()}
      className="rounded-b-md border border-t-0 border-border bg-background px-4 py-4 shadow-sm"
    >
      {step === 'ask' ? (
        <>
          <p className="text-[15px] font-semibold">Do you still want to do it?</p>
          <p className="text-[12px] text-muted-foreground mt-1">
            An authentic cancel beats an action that rolls forward out of obligation.
          </p>
          <div className="flex items-center gap-2 mt-4">
            <button
              autoFocus
              onClick={() => setStep('questions')}
              className="text-[13px] px-3 py-1 rounded-md bg-foreground text-background hover:bg-foreground/90 transition-colors cursor-pointer"
            >
              Yes, still want to
            </button>
            <button
              onClick={cancelAction}
              disabled={saving}
              className="text-[13px] px-3 py-1 rounded-md border border-border hover:bg-accent transition-colors cursor-pointer disabled:opacity-50"
            >
              No, cancel it
            </button>
            <button
              onClick={onClose}
              className="ml-auto text-[13px] px-2.5 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="action-panel-editor">
            <p className="text-[13px] font-semibold text-foreground mb-0.5">{BLOCKED_QUESTION}</p>
            <SessionEditor
              content={initialBlocked}
              onUpdate={async () => {}}
              onEditorReady={(ed) => { blockedEditorRef.current = ed }}
              autofocus
              placeholder=""
              showActionButtons={false}
              trailingParagraph={false}
            />
          </div>
          <div className="action-panel-editor mt-3">
            <p className="text-[13px] font-semibold text-foreground mb-0.5">{AVOID_QUESTION}</p>
            <SessionEditor
              content={initialAvoid}
              onUpdate={async () => {}}
              onEditorReady={(ed) => { avoidEditorRef.current = ed }}
              placeholder=""
              showActionButtons={false}
              trailingParagraph={false}
            />
          </div>
          <div className="mt-3">
            <p className="text-[13px] font-semibold text-foreground mb-1">{BY_WHEN_QUESTION}</p>
            <div className="flex items-center gap-2">
              <input
                value={byWhen}
                onChange={(e) => setByWhen(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); saveAnswers() } }}
                placeholder="Friday, next week, Oct 30"
                className="w-[180px] text-[14px] px-2 py-1 rounded-md border border-border bg-background outline-none focus:border-foreground/40"
              />
              <ActionDatePicker
                value={newDueDate ?? ''}
                onChange={(date) => setByWhen(format(parseISO(`${date}T12:00:00`), 'MMM d, yyyy'))}
                placeholder="Pick date"
              />
              {byWhen.trim() && !newDueDate && (
                <span className="text-[12px] text-danger">Not a date</span>
              )}
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 mt-4">
            <button
              onClick={() => setStep('ask')}
              className="text-[13px] px-2.5 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
            >
              Back
            </button>
            <button
              onClick={saveAnswers}
              disabled={!newDueDate || saving}
              className="text-[13px] px-3 py-1 rounded-md bg-foreground text-background hover:bg-foreground/90 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
