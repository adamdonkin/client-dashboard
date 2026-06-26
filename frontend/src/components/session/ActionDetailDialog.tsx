'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { format, parseISO } from 'date-fns'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ActionDatePicker } from './ActionDatePicker'
import { SourceBadge } from '@/components/ActionRow'

interface ActionDetailAction {
  id: string
  title: string
  description?: string | null
  due_date: string | null
  status: string
  source?: 'defacto' | 'granola' | 'session'
  review_history?: any[]
}

interface ActionDetailDialogProps {
  action: ActionDetailAction
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated?: (updated: ActionDetailAction) => void
}

export function ActionDetailDialog({
  action,
  open,
  onOpenChange,
  onUpdated,
}: ActionDetailDialogProps) {
  const supabase = createClientComponentClient()
  const [title, setTitle] = useState(action.title)
  const [description, setDescription] = useState(action.description || '')
  const [dueDate, setDueDate] = useState(action.due_date || '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setTitle(action.title)
    setDescription(action.description || '')
    setDueDate(action.due_date || '')
  }, [action])

  const hasChanges =
    title.trim() !== action.title ||
    (description.trim() || null) !== (action.description || null) ||
    (dueDate || null) !== (action.due_date || null)

  const handleSave = async () => {
    if (!title.trim()) return
    setSaving(true)

    const updates: Record<string, any> = {
      title: title.trim(),
      description: description.trim() || null,
      due_date: dueDate || null,
      updated_at: new Date().toISOString(),
    }

    await supabase
      .from('client_actions')
      .update(updates)
      .eq('id', action.id)

    const updated = { ...action, ...updates }
    onUpdated?.(updated)
    setSaving(false)
    onOpenChange(false)
  }

  const history = action.review_history || []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="sr-only">Edit action</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-[15px] font-medium bg-transparent outline-none border-b border-transparent focus:border-border pb-1"
              placeholder="Action title..."
            />
          </div>

          <div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add notes or context..."
              className="w-full px-0 py-1 text-[14px] bg-transparent outline-none min-h-[80px] resize-none text-foreground placeholder:text-muted-foreground/50"
            />
          </div>

          <div className="flex items-center gap-3 text-[13px]">
            <span className="text-muted-foreground">Due</span>
            <ActionDatePicker
              value={dueDate ? (dueDate.length > 10 ? dueDate.slice(0, 10) : dueDate) : ''}
              onChange={setDueDate}
            />
            {action.source && (
              <>
                <span className="text-border">|</span>
                <SourceBadge source={action.source} />
              </>
            )}
          </div>

          {history.length > 0 && (
            <div className="border-t pt-3 space-y-2">
              <p className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">Review History</p>
              {history.map((entry: any, i: number) => (
                <div key={i} className="text-[13px] text-muted-foreground space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">
                      {entry.outcome === 'extended' ? 'Extended' : entry.outcome === 'cancelled' ? 'Cancelled' : entry.outcome}
                    </span>
                    <span>{format(new Date(entry.date), 'MMM d, yyyy')}</span>
                    {entry.new_due_date && (
                      <span>→ {format(parseISO(entry.new_due_date), 'MMM d')}</span>
                    )}
                  </div>
                  {entry.notes && (
                    <p className="whitespace-pre-wrap text-[13px] pl-0 text-muted-foreground">{entry.notes}</p>
                  )}
                  {entry.blocked_by && (
                    <p className="text-[13px]">Blocked: {entry.blocked_by}</p>
                  )}
                  {entry.will_do && (
                    <p className="text-[13px]">Will do: {entry.will_do}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <Button
              onClick={handleSave}
              disabled={saving || !hasChanges || !title.trim()}
              className="flex-1"
              size="sm"
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              size="sm"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
