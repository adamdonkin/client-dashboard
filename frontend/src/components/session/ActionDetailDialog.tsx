'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { ListKit } from '@tiptap/extension-list'
import Placeholder from '@tiptap/extension-placeholder'
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
  description_content?: any | null
  due_date: string | null
  status: string
  source?: 'defacto' | 'granola' | 'session'
  source_url?: string | null
  session_note_id?: string | null
  review_history?: any[]
}

interface ActionDetailDialogProps {
  action: ActionDetailAction
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated?: (updated: ActionDetailAction) => void
  onDeleted?: (id: string) => void
}

export function ActionDetailDialog({
  action,
  open,
  onOpenChange,
  onUpdated,
  onDeleted,
}: ActionDetailDialogProps) {
  const supabase = createClientComponentClient()
  const [title, setTitle] = useState(action.title)
  const [dueDate, setDueDate] = useState(action.due_date || '')
  const [saving, setSaving] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const actionIdRef = useRef(action.id)

  useEffect(() => {
    setTitle(action.title)
    setDueDate(action.due_date || '')
    actionIdRef.current = action.id
  }, [action])

  const initialContent = action.description_content || (
    action.description
      ? { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: action.description }] }] }
      : undefined
  )

  const saveDescription = useCallback(async (content: any) => {
    const plainText = extractPlainText(content)
    await supabase
      .from('client_actions')
      .update({
        description_content: content,
        description: plainText || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', actionIdRef.current)
  }, [supabase])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: false,
        orderedList: false,
        listItem: false,
      }),
      ListKit,
      Placeholder.configure({
        placeholder: 'Add notes or context...',
      }),
    ],
    content: initialContent || undefined,
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[60px] text-foreground text-[14px]',
      },
    },
    onUpdate: ({ editor: ed }) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        saveDescription(ed.getJSON())
      }, 500)
    },
  }, [action.id])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const hasTitleChanges = title.trim() !== action.title
  const hasDateChanges = (dueDate || null) !== (action.due_date || null)
  const hasChanges = hasTitleChanges || hasDateChanges

  const handleSave = async () => {
    if (!title.trim()) return
    setSaving(true)

    if (debounceRef.current && editor) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
      await saveDescription(editor.getJSON())
    }

    const updates: Record<string, any> = {
      title: title.trim(),
      due_date: dueDate || null,
      updated_at: new Date().toISOString(),
    }

    await supabase
      .from('client_actions')
      .update(updates)
      .eq('id', action.id)

    const descContent = editor?.getJSON() || action.description_content
    const updated = {
      ...action,
      ...updates,
      description_content: descContent,
      description: extractPlainText(descContent),
    }
    onUpdated?.(updated)
    setSaving(false)
    onOpenChange(false)
  }

  const handleClose = async (isOpen: boolean) => {
    if (!isOpen && debounceRef.current && editor) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
      await saveDescription(editor.getJSON())

      const descContent = editor.getJSON()
      onUpdated?.({
        ...action,
        description_content: descContent,
        description: extractPlainText(descContent),
      })
    }
    onOpenChange(isOpen)
  }

  const handleDelete = () => {
    onOpenChange(false)
    onDeleted?.(action.id)

    const timeoutId = setTimeout(async () => {
      await supabase.from('client_actions').delete().eq('id', action.id)
    }, 5000)

    toast('Action deleted', {
      action: {
        label: 'Undo',
        onClick: () => {
          clearTimeout(timeoutId)
        },
      },
      duration: 5000,
    })
  }

  const history = action.review_history || []

  return (
    <Dialog open={open} onOpenChange={handleClose}>
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

          <div className="action-description-editor">
            <EditorContent editor={editor} />
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
                <SourceBadge source={action.source} sourceUrl={action.source_url} sessionNoteId={action.session_note_id} />
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

          <div className="flex items-center gap-3 pt-1">
            <Button
              onClick={handleSave}
              disabled={saving || !title.trim()}
              className="flex-1"
              size="sm"
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button
              variant="ghost"
              onClick={() => handleClose(false)}
              className="flex-1"
              size="sm"
            >
              Cancel
            </Button>
            {onDeleted && (
              <Button
                variant="ghost"
                onClick={handleDelete}
                size="sm"
                className="text-muted-foreground hover:text-destructive"
              >
                Delete
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function extractPlainText(content: any): string {
  if (!content) return ''
  const parts: string[] = []
  function walk(node: any) {
    if (node.type === 'text') {
      parts.push(node.text || '')
    } else if (node.content) {
      for (const child of node.content) {
        walk(child)
      }
      if (node.type === 'paragraph' || node.type === 'listItem') {
        parts.push('\n')
      }
    }
  }
  walk(content)
  return parts.join('').trim()
}
