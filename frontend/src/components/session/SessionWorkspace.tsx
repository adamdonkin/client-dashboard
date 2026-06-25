'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { ArrowLeft, Cloud, CloudOff, Loader2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { formatRelativeDate } from '@/utils/date-utils'
import { SessionEditor, SlashCommandHandler, SaveStatus } from './SessionEditor'
import { ActionReviewSection } from './ActionReviewSection'

interface CalendarEvent {
  id: string
  client_id: string
  start_time: string
  end_time: string
  title: string
}

interface ClientInfo {
  id: string
  name: string
  company_name: string | null
  role: string | null
}

interface SessionWorkspaceProps {
  calendarEvent: CalendarEvent
  client: ClientInfo | null
  sessionNoteId: string
  onBack: () => void
}

export function SessionWorkspace({
  calendarEvent,
  client,
  sessionNoteId,
  onBack,
}: SessionWorkspaceProps) {
  const supabase = createClientComponentClient()
  const [connectionNotes, setConnectionNotes] = useState<any>(undefined)
  const [topicsContent, setTopicsContent] = useState<any>(undefined)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('session_notes')
        .select('connection_notes, topics_content')
        .eq('id', sessionNoteId)
        .single()

      setConnectionNotes(data?.connection_notes || null)
      setTopicsContent(data?.topics_content || null)
      setDataLoaded(true)
    }
    load()
  }, [sessionNoteId, supabase])

  const handleConnectionUpdate = useCallback(async (content: any) => {
    await supabase
      .from('session_notes')
      .update({ connection_notes: content, updated_at: new Date().toISOString() })
      .eq('id', sessionNoteId)
  }, [sessionNoteId, supabase])

  const handleTopicsUpdate = useCallback(async (content: any) => {
    await supabase
      .from('session_notes')
      .update({ topics_content: content, updated_at: new Date().toISOString() })
      .eq('id', sessionNoteId)
  }, [sessionNoteId, supabase])

  const noopActionCallback = useCallback((_actionId: string) => {}, [])

  const issueTemplateContent = [
    { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Topic title' }] },
    { type: 'bulletList', content: [
      { type: 'listItem', content: [
        { type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'How did you help create this problem?' }] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] },
      ]},
      { type: 'listItem', content: [
        { type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: "What's your proposed solution?" }] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] },
      ]},
    ]},
  ]

  const insertIssueTemplate = (editor: any, title?: string) => {
    const pos = editor.state.selection.from
    const content = title
      ? [
          { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: title }] },
          ...issueTemplateContent.slice(1),
        ]
      : issueTemplateContent
    editor.chain().focus().insertContent(content).run()
    if (!title) {
      // Select "Topic title" text so user can type over it
      setTimeout(() => {
        const doc = editor.state.doc
        let headingPos: number | null = null
        doc.descendants((node: any, nodePos: number) => {
          if (headingPos !== null) return false
          if (node.type.name === 'heading' && nodePos >= pos - 1) {
            headingPos = nodePos
            return false
          }
        })
        if (headingPos !== null) {
          const headingNode = doc.nodeAt(headingPos)
          if (headingNode) {
            const from = headingPos + 1
            const to = from + headingNode.content.size
            editor.chain().focus().setTextSelection({ from, to }).run()
          }
        }
      }, 10)
    }
  }

  const handleSlashCommand: SlashCommandHandler = (item, editor) => {
    if (item.id === 'action') {
      editor.chain().focus().insertContent({
        type: 'actionBlock',
        attrs: { actionId: '', prefillTitle: '' },
      }).run()
    } else if (item.id === 'issue') {
      insertIssueTemplate(editor)
    }
  }

  const sessionTime = format(parseISO(calendarEvent.start_time), 'h:mm a')
  const sessionDate = formatRelativeDate(calendarEvent.start_time)
  const durationMins = Math.round(
    (new Date(calendarEvent.end_time).getTime() - new Date(calendarEvent.start_time).getTime()) / 60000
  )

  const clientName = client?.name || 'Unknown Client'
  const subtitle = [client?.company_name, client?.role].filter(Boolean).join(' · ')

  return (
    <div className="min-h-screen bg-background">
      {/* Slim header */}
      <div className="border-b border-border/50 sticky top-0 bg-background z-10">
        <div className="max-w-2xl mx-auto px-6 py-3 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-[15px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div className="text-center">
            <p className="text-[15px] font-medium text-foreground">{clientName}</p>
            {subtitle && (
              <p className="text-[13px] text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-muted-foreground">
              {sessionDate} · {sessionTime} · {durationMins} min
            </span>
            <span className="text-[11px] text-muted-foreground/60 flex items-center gap-1">
              {saveStatus === 'saving' && <><Loader2 className="h-3 w-3 animate-spin" />Saving</>}
              {saveStatus === 'saved' && <><Cloud className="h-3 w-3" />Saved</>}
              {saveStatus === 'error' && <><CloudOff className="h-3 w-3 text-destructive" />Error</>}
            </span>
          </div>
        </div>
      </div>

      {/* Document body */}
      <div className="max-w-2xl mx-auto px-6 py-8 pb-[50vh] space-y-10">
        {/* Connection */}
        <section>
          <h2 className="text-[13px] font-medium text-muted-foreground uppercase tracking-widest mb-4">
            Connection
          </h2>
          {dataLoaded ? (
            <SessionEditor
              content={connectionNotes}
              onUpdate={handleConnectionUpdate}
              onSaveStatusChange={setSaveStatus}
              placeholder="Tell me something good…"
              autofocus
              clientId={calendarEvent.client_id}
              sessionNoteId={sessionNoteId}
              onActionCreated={noopActionCallback}
              onSlashCommand={handleSlashCommand}
              onSelectionIssue={(text, ed) => insertIssueTemplate(ed, text)}
            />
          ) : (
            <div className="min-h-[1.5em]" />
          )}
        </section>

        <hr className="border-border/50" />

        {/* Action Review */}
        <section>
          <h2 className="text-[13px] font-medium text-muted-foreground uppercase tracking-widest mb-4">
            Action Review
          </h2>
          <ActionReviewSection
            clientId={calendarEvent.client_id}
            sessionNoteId={sessionNoteId}
            onActionToggled={noopActionCallback}
          />
        </section>

        <hr className="border-border/50" />

        {/* Topics */}
        <section>
          <h2 className="text-[13px] font-medium text-muted-foreground uppercase tracking-widest mb-4">
            Topics
          </h2>
          {dataLoaded ? (
            <SessionEditor
              content={topicsContent}
              onUpdate={handleTopicsUpdate}
              onSaveStatusChange={setSaveStatus}
              placeholder="Start typing or use /issue to add a topic..."
              clientId={calendarEvent.client_id}
              sessionNoteId={sessionNoteId}
              onActionCreated={noopActionCallback}
              onSlashCommand={handleSlashCommand}
              onSelectionIssue={(text, ed) => insertIssueTemplate(ed, text)}
            />
          ) : (
            <div className="min-h-[1.5em]" />
          )}
        </section>

      </div>
    </div>
  )
}
