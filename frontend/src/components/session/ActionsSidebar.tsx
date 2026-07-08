'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Plus, Copy, Check } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ActionRow } from '@/components/ActionRow'
import type { ActionItem } from '@/components/ActionRow'
import { ActionCreateForm } from './ActionCreateForm'

interface ActionsSidebarProps {
  clientId: string
  sessionNoteId: string
  refreshKey?: number
  onActionSelect?: (action: ActionItem | null) => void
  onActionChanged?: (updated: ActionItem) => void
  onActionRemoved?: (id: string) => void
}

export function ActionsSidebar({ clientId, sessionNoteId, refreshKey, onActionSelect, onActionChanged, onActionRemoved }: ActionsSidebarProps) {
  const supabase = createClientComponentClient()
  const [sessionActions, setSessionActions] = useState<ActionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)

  const fetchSessionActions = useCallback(async () => {
    const { data } = await supabase
      .from('client_actions')
      .select('id, title, description, description_content, source, source_url, session_note_id, due_date, status, review_history')
      .eq('session_note_id', sessionNoteId)
      .order('created_at', { ascending: true })

    setSessionActions(data || [])
    setLoading(false)
  }, [sessionNoteId, supabase])

  useEffect(() => {
    fetchSessionActions()
  }, [fetchSessionActions])

  useEffect(() => {
    if (refreshKey && refreshKey > 0) fetchSessionActions()
  }, [refreshKey, fetchSessionActions])

  const handleCreateAction = async (title: string, dueDate: string) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const { data } = await supabase
      .from('client_actions')
      .insert({
        user_id: session.user.id,
        client_id: clientId,
        source: 'session',
        source_id: `session-${sessionNoteId}-${Date.now()}`,
        title,
        status: 'to_do',
        due_date: dueDate,
        session_note_id: sessionNoteId,
      })
      .select('id, title, description, due_date, status, source, review_history')
      .single()

    if (data) {
      setSessionActions(prev => [...prev, data])
      setShowCreateForm(false)
    }
  }

  const [copied, setCopied] = useState(false)

  const copyActions = async () => {
    const openActions = sessionActions.filter(a => a.status === 'to_do')

    const plainLines: string[] = []
    const htmlParts: string[] = []

    for (const a of openActions) {
      const date = a.due_date ? ` by ${format(parseISO(a.due_date.length > 10 ? a.due_date.slice(0, 10) : a.due_date), 'MMM d')}` : ''
      plainLines.push(`• ${a.title}${date}`)
      htmlParts.push(`<li>${a.title}${date}`)

      const desc = extractDescriptionLines(a.description_content, a.description)
      if (desc.length > 0) {
        for (const line of desc) {
          plainLines.push(`  ◦ ${line}`)
        }
        htmlParts.push(`<ul>${desc.map(l => `<li>${l}</li>`).join('')}</ul>`)
      }

      htmlParts.push('</li>')
    }

    const plain = `Actions:\n${plainLines.join('\n')}`
    const html = `<b>Actions:</b><ul>${htmlParts.join('')}</ul>`

    await navigator.clipboard.write([
      new ClipboardItem({
        'text/plain': new Blob([plain], { type: 'text/plain' }),
        'text/html': new Blob([html], { type: 'text/html' }),
      }),
    ])
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
            Session Actions
          </h3>
          <div className="flex items-center gap-2">
            {sessionActions.filter(a => a.status === 'to_do').length > 0 && (
              <button
                onClick={copyActions}
                className="p-0.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="Copy actions to clipboard"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            )}
            <button
              onClick={() => setShowCreateForm(true)}
              className="p-0.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="Add action"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {showCreateForm && (
          <div className="mb-2">
            <ActionCreateForm
              onSubmit={handleCreateAction}
              onCancel={() => setShowCreateForm(false)}
            />
          </div>
        )}

        {loading ? (
          <p className="text-[13px] text-muted-foreground">Loading...</p>
        ) : sessionActions.length === 0 && !showCreateForm ? (
          <p className="text-[13px] text-muted-foreground/50">No actions yet</p>
        ) : (
          <div className="space-y-1.5">
            {sessionActions.map(action => (
              <ActionRow
                key={action.id}
                action={action}
                onChanged={(updated) => {
                  setSessionActions(prev => prev.map(a => a.id === updated.id ? { ...a, ...updated } : a))
                  onActionChanged?.(updated)
                }}
                onRemoved={(id) => {
                  setSessionActions(prev => prev.filter(a => a.id !== id))
                  onActionRemoved?.(id)
                }}
                onSelect={onActionSelect}
              />
            ))}
          </div>
        )}
    </div>
  )
}

function extractDescriptionLines(content: any, fallbackText?: string | null): string[] {
  if (content) {
    const lines: string[] = []

    function paragraphText(node: any): string {
      if (!node.content) return ''
      return node.content
        .filter((c: any) => c.type === 'text')
        .map((c: any) => c.text || '')
        .join('')
        .trim()
    }

    function walkNodes(nodes: any[]) {
      for (const node of nodes) {
        if (node.type === 'paragraph') {
          const text = paragraphText(node)
          if (text) lines.push(text)
        } else if (node.type === 'listItem' && node.content) {
          for (const child of node.content) {
            if (child.type === 'paragraph') {
              const text = paragraphText(child)
              if (text) lines.push(text)
            } else if (child.type === 'bulletList' || child.type === 'orderedList') {
              if (child.content) walkNodes(child.content)
            }
          }
        } else if (node.type === 'bulletList' || node.type === 'orderedList') {
          if (node.content) walkNodes(node.content)
        }
      }
    }

    if (content.content) walkNodes(content.content)
    return lines.filter(l => l.length > 0)
  }

  if (fallbackText) {
    return fallbackText.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  }

  return []
}
