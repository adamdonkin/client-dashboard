'use client'

import { useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { format, addDays, parseISO } from 'date-fns'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ActionDatePicker } from './ActionDatePicker'

interface ReviewAction {
  id: string
  title: string
  description: string | null
  due_date: string | null
  status: string
  review_history?: any[]
}

interface ActionReviewDialogProps {
  action: ReviewAction
  open: boolean
  onOpenChange: (open: boolean) => void
  onActionUpdated: () => void
}

const REVIEW_TEMPLATE = `• What blocked you?\n• What will you do differently?`

export function ActionReviewDialog({
  action,
  open,
  onOpenChange,
  onActionUpdated,
}: ActionReviewDialogProps) {
  const supabase = createClientComponentClient()
  const [stillWant, setStillWant] = useState<boolean | null>(null)
  const [newDueDate, setNewDueDate] = useState(
    format(addDays(new Date(), 7), 'yyyy-MM-dd')
  )
  const [notes, setNotes] = useState(REVIEW_TEMPLATE)
  const [saving, setSaving] = useState(false)

  const reset = () => {
    setStillWant(null)
    setNotes(REVIEW_TEMPLATE)
    setNewDueDate(format(addDays(new Date(), 7), 'yyyy-MM-dd'))
  }

  const handleCancel = async () => {
    setSaving(true)

    const reviewEntry = {
      date: new Date().toISOString(),
      outcome: 'cancelled',
    }

    const history = [...(action.review_history || []), reviewEntry]

    await supabase
      .from('client_actions')
      .update({
        status: 'cancelled',
        review_history: history,
        updated_at: new Date().toISOString(),
      })
      .eq('id', action.id)

    setSaving(false)
    reset()
    onOpenChange(false)
    onActionUpdated()
  }

  const handleExtend = async () => {
    setSaving(true)

    const trimmedNotes = notes.trim()
    const hasNotes = trimmedNotes && trimmedNotes !== REVIEW_TEMPLATE.trim()

    const reviewEntry = {
      date: new Date().toISOString(),
      outcome: 'extended',
      previous_due_date: action.due_date,
      new_due_date: newDueDate,
      notes: hasNotes ? trimmedNotes : null,
    }

    const history = [...(action.review_history || []), reviewEntry]

    await supabase
      .from('client_actions')
      .update({
        due_date: newDueDate,
        review_history: history,
        updated_at: new Date().toISOString(),
      })
      .eq('id', action.id)

    setSaving(false)
    reset()
    onOpenChange(false)
    onActionUpdated()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-ui-lg font-medium">{action.title}</DialogTitle>
          {action.due_date && (
            <p className="text-ui-base text-muted-foreground">
              Due: {format(new Date(action.due_date + (action.due_date.length <= 10 ? 'T00:00:00' : '')), 'MMM d, yyyy')}
            </p>
          )}
        </DialogHeader>

        {stillWant === null ? (
          <div className="space-y-3 pt-2">
            <p className="text-ui-md text-muted-foreground">Do you still want to do this?</p>
            <div className="flex gap-3">
              <Button
                onClick={() => setStillWant(true)}
                className="flex-1"
              >
                Yes, extend it
              </Button>
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={saving}
                className="flex-1"
              >
                No, cancel it
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2">
              <span className="text-ui-base text-muted-foreground">New due date</span>
              <ActionDatePicker
                value={newDueDate}
                onChange={setNewDueDate}
              />
            </div>

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-ui-md border rounded-md bg-background min-h-[100px] resize-none"
            />

            <div className="flex gap-3">
              <Button
                onClick={handleExtend}
                disabled={saving}
                className="flex-1"
              >
                {saving ? 'Saving...' : 'Save & extend'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => { reset(); onOpenChange(false) }}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
