'use client'

import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { X, Loader2, RefreshCw } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
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
  onRegenerate?: () => void
}

export function PreReadPanel({
  clientName,
  companyName,
  clientId,
  sessionDate,
  content,
  status,
  onClose,
  onRegenerate,
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
          <div className="flex items-center gap-1">
            {onRegenerate && status !== 'generating' && (
              <button
                onClick={onRegenerate}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                title="Regenerate pre-read"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
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

// `##`/`#` mark the pre-read's own section dividers rather than document headings, so they
// render as the small-caps label the panel uses elsewhere. `###` stays a real heading.
function SectionHeader({ children }: { children?: ReactNode }) {
  return <div className="pre-read-section-header">{children}</div>
}

// A pre-read is markdown from two sources — the model's prose and Granola's write-up spliced
// in verbatim — so bullet indentation, list tightness and heading style all vary between and
// within documents. Parsing with remark rather than line-by-line regexes is what lets nested
// bullets survive: any indentation step, any nesting depth, and blank lines between items.
function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="session-editor">
      <div className="ProseMirror">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{ h1: SectionHeader, h2: SectionHeader }}
        >
          {preparePreReadMarkdown(content)}
        </ReactMarkdown>
      </div>
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

// Long paragraphs are broken up so the panel stays skimmable. Only a line that opens a
// top-level paragraph is eligible: an indented or lazy continuation line belongs to the list
// item or quote above it, and inserting a blank line there would end that block.
function splitLongParagraphs(md: string): string {
  const lines = md.split('\n')
  const out: string[] = []
  let inFence = false
  let blockOpen = false

  for (const line of lines) {
    if (/^\s*(?:```|~~~)/.test(line)) {
      inFence = !inFence
      out.push(line)
      blockOpen = false
      continue
    }
    if (inFence || line.trim() === '') {
      out.push(line)
      if (!inFence) blockOpen = false
      continue
    }
    // Headings and thematic breaks are leaf blocks, so the next line starts fresh.
    if (/^#{1,6} /.test(line) || /^(?:-{3,}|\*{3,}|_{3,})[ \t]*$/.test(line)) {
      out.push(line)
      blockOpen = false
      continue
    }

    const startsParagraph =
      !blockOpen && !/^\s/.test(line) && !/^(?:[-*+]\s|\d+[.)]\s|>|\|)/.test(line)
    out.push(startsParagraph ? splitLongParagraph(line, 3).join('\n\n') : line)
    blockOpen = true
  }

  return out.join('\n')
}

function preparePreReadMarkdown(md: string): string {
  // The title is already shown in the panel header.
  const withoutTitle = md.replace(/^#{1,3} .+\n*/m, '')

  return splitLongParagraphs(
    withoutTitle
      // A bold lead-in followed by prose is the model's way of writing a sub-heading.
      // Handles **Title.** Rest... and **Title** — Rest...
      .replace(/^\*\*(.+?)\.\*\*\s*(.+)$/gm, '### $1.\n\n$2')
      .replace(/^\*\*(.+?)\*\*([.—–:,]\s*)(.+)$/gm, '### $1\n\n$3')
      // A line that is nothing but bold text is a section divider.
      .replace(/^\*\*(.+?)\*\*$/gm, '## $1')
      // Keep a rule a rule: touching the paragraph above would make it a setext heading.
      .replace(/([^\n])\n(---+[ \t]*)$/gm, '$1\n\n$2'),
  )
}
