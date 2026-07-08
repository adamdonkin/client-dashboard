'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Copy, Check, Lock } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { formatRelativeDate } from '@/utils/date-utils'
import { copyTiptapContent } from '@/utils/tiptap-clipboard'
import { SessionEditor, SlashCommandHandler } from './SessionEditor'
import { ActionReviewSection } from './ActionReviewSection'
import { ActionsSidebar } from './ActionsSidebar'
import { ActionCreatePanel } from './ActionCreatePanel'

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
  notesLocked?: boolean
}

export function SessionWorkspace({
  calendarEvent,
  client,
  sessionNoteId,
  notesLocked = false,
}: SessionWorkspaceProps) {
  const supabase = createClientComponentClient()
  const [connectionNotes, setConnectionNotes] = useState<any>(undefined)
  const [topicsContent, setTopicsContent] = useState<any>(undefined)
  const [dataLoaded, setDataLoaded] = useState(false)
  const connectionEditorRef = useRef<any>(null)
  const topicsEditorRef = useRef<any>(null)
  const [copiedSection, setCopiedSection] = useState<string | null>(null)

  const handleCopySection = async (editorRef: React.RefObject<any>, sectionName: string) => {
    const ed = editorRef.current
    if (!ed) return
    const success = await copyTiptapContent(ed.getJSON())
    if (success) {
      setCopiedSection(sectionName)
      setTimeout(() => setCopiedSection(null), 2000)
    }
  }


  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('session_notes')
        .select('connection_notes, topics_content')
        .eq('id', sessionNoteId)
        .single()

      setConnectionNotes(stripActionBlocks(data?.connection_notes) || null)
      setTopicsContent(stripActionBlocks(data?.topics_content) || null)
      setDataLoaded(true)
    }
    load()
  }, [sessionNoteId, supabase])

  const handleConnectionUpdate = useCallback(async (content: any) => {
    const { error } = await supabase
      .from('session_notes')
      .update({ connection_notes: content, updated_at: new Date().toISOString() })
      .eq('id', sessionNoteId)
    if (error) throw error
  }, [sessionNoteId, supabase])

  const handleTopicsUpdate = useCallback(async (content: any) => {
    const { error } = await supabase
      .from('session_notes')
      .update({ topics_content: content, updated_at: new Date().toISOString() })
      .eq('id', sessionNoteId)
    if (error) throw error
  }, [sessionNoteId, supabase])

  const noopActionCallback = useCallback((_actionId: string) => {
    setActionRefreshKey(k => k + 1)
  }, [])
  const [actionRefreshKey, setActionRefreshKey] = useState(0)
  const [showCreatePanel, setShowCreatePanel] = useState(false)
  const slashActionEditorRef = useRef<any>(null)
  const slashActionPosRef = useRef<number | null>(null)

  const handleInlineAction = useCallback(async (title: string) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 7)
    const dueDateStr = dueDate.toISOString().slice(0, 10)

    await supabase
      .from('client_actions')
      .insert({
        user_id: session.user.id,
        client_id: calendarEvent.client_id,
        source: 'session',
        source_id: `session-${sessionNoteId}-${Date.now()}`,
        title,
        status: 'to_do',
        due_date: dueDateStr,
        session_note_id: sessionNoteId,
      })

    setActionRefreshKey(k => k + 1)
  }, [calendarEvent.client_id, sessionNoteId, supabase])

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
      slashActionEditorRef.current = editor
      slashActionPosRef.current = editor.state.selection.from
      setShowCreatePanel(true)
    } else if (item.id === 'issue') {
      insertIssueTemplate(editor)
    }
  }

  const handleActionCreated = useCallback((action: { id: string; title: string }) => {
    const ed = slashActionEditorRef.current
    const pos = slashActionPosRef.current
    if (ed && typeof pos === 'number') {
      ed.chain().focus().insertContentAt(pos, `[ ] ${action.title}`).run()
    }
    setShowCreatePanel(false)
    setActionRefreshKey(k => k + 1)
    slashActionEditorRef.current = null
    slashActionPosRef.current = null
  }, [])

  const sessionTime = format(parseISO(calendarEvent.start_time), 'h:mm a')
  const sessionDate = formatRelativeDate(calendarEvent.start_time)
  const durationMins = Math.round(
    (new Date(calendarEvent.end_time).getTime() - new Date(calendarEvent.start_time).getTime()) / 60000
  )

  const clientName = client?.name || 'Unknown Client'
  const subtitle = [client?.company_name, client?.role].filter(Boolean).join(' · ')

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Slim header */}
      <div className="border-b border-border/50 sticky top-0 bg-background z-10">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="w-20" />
          <div className="text-center">
            <a href={`/clients/${calendarEvent.client_id}`} className="text-[15px] font-medium text-foreground hover:underline">{clientName}</a>
            {subtitle && (
              <p className="text-[13px] text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-muted-foreground">
              {sessionDate} · {sessionTime} · {durationMins} min
            </span>
          </div>
        </div>
        {notesLocked && (
          <div className="px-6 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800/50 flex items-center justify-center gap-2 text-[13px] text-amber-700 dark:text-amber-400">
            <Lock className="h-3.5 w-3.5" />
            <span>Someone else is editing notes — notes are read-only</span>
          </div>
        )}
      </div>

      {/* Document body */}
      <div className="w-2xl mx-auto px-6 py-8 pb-[50vh] space-y-10 max-sm:w-full max-sm:px-4">
        {/* Connection */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[13px] font-medium text-muted-foreground uppercase tracking-widest">
              Connection
            </h2>
            <button
              onClick={() => handleCopySection(connectionEditorRef, 'connection')}
              className="p-0.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="Copy to clipboard"
            >
              {copiedSection === 'connection' ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
          {dataLoaded ? (
            <SessionEditor
              content={connectionNotes}
              onUpdate={handleConnectionUpdate}
              placeholder="Tell me something good…"
              autofocus={!notesLocked}
              readOnly={notesLocked}
              clientId={calendarEvent.client_id}
              sessionNoteId={sessionNoteId}
              onActionCreated={noopActionCallback}
              onSlashCommand={handleSlashCommand}
              onSelectionIssue={(text, ed) => insertIssueTemplate(ed, text)}
              onEditorReady={(ed) => { connectionEditorRef.current = ed }}
              onCreateAction={handleInlineAction}
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[13px] font-medium text-muted-foreground uppercase tracking-widest">
              Topics
            </h2>
            <button
              onClick={() => handleCopySection(topicsEditorRef, 'topics')}
              className="p-0.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="Copy to clipboard"
            >
              {copiedSection === 'topics' ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
          {dataLoaded ? (
            <SessionEditor
              content={topicsContent}
              onUpdate={handleTopicsUpdate}
              placeholder="Start typing or use /issue to add a topic..."
              readOnly={notesLocked}
              clientId={calendarEvent.client_id}
              sessionNoteId={sessionNoteId}
              onActionCreated={noopActionCallback}
              onSlashCommand={handleSlashCommand}
              onSelectionIssue={(text, ed) => insertIssueTemplate(ed, text)}
              onEditorReady={(ed) => { topicsEditorRef.current = ed }}
              onCreateAction={handleInlineAction}
            />
          ) : (
            <div className="min-h-[1.5em]" />
          )}
        </section>

        <hr className="border-border/50" />

        {/* Session Actions */}
        <section>
          <ActionsSidebar
            clientId={calendarEvent.client_id}
            sessionNoteId={sessionNoteId}
            refreshKey={actionRefreshKey}
          />
        </section>
      </div>

      {showCreatePanel && (
        <ActionCreatePanel
          clientId={calendarEvent.client_id}
          sessionNoteId={sessionNoteId}
          onClose={() => {
            setShowCreatePanel(false)
            slashActionEditorRef.current = null
            slashActionPosRef.current = null
          }}
          onCreated={handleActionCreated}
        />
      )}
    </div>
  )
}

function stripActionBlocks(content: any): any {
  if (!content || !content.content) return content
  return {
    ...content,
    content: content.content
      .map((node: any) => {
        if (node.type === 'actionBlock') return null
        if (node.content) return stripActionBlocks(node)
        return node
      })
      .filter(Boolean),
  }
}
