'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ActionRow, ActionItem } from '@/components/ActionRow'

interface PreReadPanelProps {
  clientName: string
  companyName: string | null
  clientId: string | null
  sessionDate: string
  content: string | null
  status: string
  onClose: () => void
}

export function PreReadPanel({
  clientName,
  companyName,
  clientId,
  sessionDate,
  content,
  status,
  onClose,
}: PreReadPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const supabase = createClientComponentClient()
  const [actions, setActions] = useState<ActionItem[]>([])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const fetchActions = useCallback(async () => {
    if (!clientId) {
      console.log('[PreReadPanel] No clientId, skipping action fetch')
      return
    }
    console.log('[PreReadPanel] Fetching actions for clientId:', clientId)
    const { data, error } = await supabase
      .from('client_actions')
      .select('id, title, description, description_content, source, source_url, session_note_id, due_date, status, review_history, created_at')
      .eq('client_id', clientId)
      .in('status', ['to_do', 'not_done'])
      .order('due_date', { ascending: true, nullsFirst: false })
    console.log('[PreReadPanel] Actions result:', { count: data?.length, error })
    if (data) setActions(data)
  }, [clientId, supabase])

  useEffect(() => {
    fetchActions()
  }, [fetchActions])

  return (
    <div
      ref={panelRef}
      className={cn(
        'fixed top-0 right-0 z-50 h-full w-[55vw] max-w-[800px] min-w-[400px] bg-background border-l border-border shadow-xl',
        'animate-in slide-in-from-right duration-200',
      )}
    >
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-6 py-3 border-b border-border/50 shrink-0">
          <div>
            <h2 className="text-[15px] font-semibold">{clientName}</h2>
            <p className="text-[12px] text-muted-foreground">
              {companyName ? `${companyName} · ` : ''}Session prep for {sessionDate}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {status === 'generating' && (
            <div className="flex items-center justify-center gap-3 py-20">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-[14px] text-muted-foreground">Generating pre-read...</span>
            </div>
          )}

          {status === 'error' && (
            <div className="px-6 py-8">
              <p className="text-[14px] text-danger">Failed to generate pre-read. Try again.</p>
            </div>
          )}

          {status === 'pending' && (
            <div className="flex items-center justify-center py-20">
              <p className="text-[14px] text-muted-foreground">Not yet generated</p>
            </div>
          )}

          {status === 'ready' && content && (
            <div className="px-6 py-5 pre-read-content max-w-2xl mx-auto">
              <MarkdownContent content={content} />
            </div>
          )}

          {actions.length > 0 && (
            <div className="px-6 pb-8 max-w-2xl mx-auto">
              <div className="pre-read-section-header mt-6 mb-3 text-[13px] font-medium text-muted-foreground uppercase tracking-[0.1em]">
                Open Actions
              </div>
              <div className="flex flex-col gap-1.5">
                {actions.map(action => (
                  <ActionRow
                    key={action.id}
                    action={action}
                    onChanged={(updated) => setActions(prev => prev.map(a => a.id === updated.id ? updated : a))}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MarkdownContent({ content }: { content: string }) {
  const html = markdownToHtml(content)
  return (
    <div
      className="session-editor"
    >
      <div
        className="ProseMirror"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}

function splitLongParagraph(text: string, maxSentences: number): string[] {
  // Split on sentence boundaries: period/question/exclamation followed by space and capital letter
  const sentences = text.match(/[^.!?]*[.!?]+(?:\s+|$)/g)
  if (!sentences || sentences.length <= maxSentences) return [text]

  const chunks: string[] = []
  let current: string[] = []
  for (const sentence of sentences) {
    current.push(sentence.trim())
    if (current.length >= maxSentences) {
      chunks.push(current.join(' '))
      current = []
    }
  }
  if (current.length > 0) chunks.push(current.join(' '))
  return chunks
}

function markdownToHtml(md: string): string {
  // Strip the first heading (title) since it's displayed in the panel header
  let cleaned = md.replace(/^#{1,3} .+\n*/m, '')

  // First, split bold-lead paragraphs into heading + paragraph
  // Handles both: **Title**. Rest... AND **Title.** Rest... AND **Title** — Rest...
  let processed = cleaned
    .replace(/^\*\*(.+?)\.\*\*\s*(.+)$/gm, '%%H3%%$1.%%/H3%%\n$2')
    .replace(/^\*\*(.+?)\*\*([.—–:,]\s*)(.+)$/gm, '%%H3%%$1%%/H3%%\n$3')

  let html = processed
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<div class="pre-read-section-header">$1</div>')
    .replace(/^# (.+)$/gm, '<div class="pre-read-section-header">$1</div>')
    .replace(/%%H3%%(.+?)%%\/H3%%/g, '<h3>$1</h3>')
    .replace(/^\*\*(.+?)\*\*$/gm, '<div class="pre-read-section-header">$1</div>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^---$/gm, '<hr />')

  // Tables
  html = html.replace(/^(\|.+\|)\n(\|[-| :]+\|)\n((?:\|.+\|\n?)+)/gm, (_match, header, _sep, body) => {
    const ths = header.split('|').filter((c: string) => c.trim()).map((c: string) => `<th>${c.trim()}</th>`).join('')
    const rows = body.trim().split('\n').map((row: string) => {
      const tds = row.split('|').filter((c: string) => c.trim()).map((c: string) => `<td>${c.trim()}</td>`).join('')
      return `<tr>${tds}</tr>`
    }).join('')
    return `<table><thead><tr>${ths}</tr></thead><tbody>${rows}</tbody></table>`
  })

  // Bullet lists
  const lines = html.split('\n')
  const result: string[] = []
  let inList = false

  for (const line of lines) {
    const bulletMatch = line.match(/^[-*]\s+(.+)/)
    if (bulletMatch) {
      if (!inList) { result.push('<ul>'); inList = true }
      result.push(`<li>${bulletMatch[1]}</li>`)
    } else {
      if (inList) { result.push('</ul>'); inList = false }
      if (line.trim() === '') {
        result.push('')
      } else if (!line.startsWith('<h') && !line.startsWith('<hr') && !line.startsWith('<table') && !line.startsWith('<thead') && !line.startsWith('<tbody') && !line.startsWith('<tr') && !line.startsWith('</') && !line.startsWith('<div')) {
        for (const chunk of splitLongParagraph(line, 3)) {
          result.push(`<p>${chunk}</p>`)
        }
      } else {
        result.push(line)
      }
    }
  }
  if (inList) result.push('</ul>')

  return result.join('\n')
}
