'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Plus } from 'lucide-react'
import { SessionEditor, SlashCommandHandler } from './SessionEditor'
import { SlashCommandItem } from './SlashCommandMenu'
import { ActionRow } from '@/components/ActionRow'
import { ActionCreateForm } from './ActionCreateForm'

interface Topic {
  id: string
  title: string
  content: any
  sort_order: number
  actions: TopicAction[]
}

interface TopicAction {
  id: string
  title: string
  description: string | null
  due_date: string | null
  status: string
}

interface TopicsSectionProps {
  sessionNoteId: string
  clientId: string
  onActionCreated: (actionId: string) => void
}

export function TopicsSection({ sessionNoteId, clientId, onActionCreated }: TopicsSectionProps) {
  const supabase = createClientComponentClient()
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)
  const newTitleRef = useRef<HTMLTextAreaElement | null>(null)

  const loadTopics = useCallback(async () => {
    const { data: topicsData } = await supabase
      .from('session_topics')
      .select('id, title, content, sort_order')
      .eq('session_note_id', sessionNoteId)
      .order('sort_order', { ascending: true })

    if (!topicsData) {
      setLoading(false)
      return
    }

    const topicIds = topicsData.map(t => t.id)
    let actionsData: any[] = []
    if (topicIds.length > 0) {
      const { data } = await supabase
        .from('client_actions')
        .select('id, title, description, due_date, status, session_topic_id')
        .in('session_topic_id', topicIds)

      actionsData = data || []
    }

    const topicsWithActions: Topic[] = topicsData.map(t => ({
      ...t,
      actions: actionsData.filter(a => a.session_topic_id === t.id),
    }))

    setTopics(topicsWithActions)
    setLoading(false)
  }, [sessionNoteId, supabase])

  useEffect(() => {
    loadTopics()
  }, [loadTopics])

  const addTopic = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const sortOrder = topics.length

    const { data, error } = await supabase
      .from('session_topics')
      .insert({
        session_note_id: sessionNoteId,
        title: '',
        sort_order: sortOrder,
      })
      .select('id, title, content, sort_order')
      .single()

    if (data) {
      setTopics(prev => [...prev, { ...data, actions: [] }])
      setTimeout(() => newTitleRef.current?.focus(), 50)
    }
  }

  const updateTopicTitle = async (topicId: string, title: string) => {
    setTopics(prev => prev.map(t => t.id === topicId ? { ...t, title } : t))
    await supabase
      .from('session_topics')
      .update({ title, updated_at: new Date().toISOString() })
      .eq('id', topicId)
  }

  const updateTopicContent = async (topicId: string, content: any) => {
    await supabase
      .from('session_topics')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('id', topicId)
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading topics...</p>
  }

  return (
    <div className="space-y-6">
      {topics.map((topic, index) => (
        <TopicBlock
          key={topic.id}
          topic={topic}
          index={index}
          isLast={index === topics.length - 1}
          titleRef={index === topics.length - 1 ? newTitleRef : undefined}
          onTitleChange={(title) => updateTopicTitle(topic.id, title)}
          onContentChange={(content) => updateTopicContent(topic.id, content)}
          sessionNoteId={sessionNoteId}
          clientId={clientId}
          onActionCreated={(actionId, action) => {
            setTopics(prev => prev.map(t =>
              t.id === topic.id
                ? { ...t, actions: [...t.actions, action] }
                : t
            ))
            onActionCreated(actionId)
          }}
        />
      ))}

      <button
        onClick={addTopic}
        className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
      >
        <Plus className="h-4 w-4" />
        Add topic
      </button>
    </div>
  )
}

interface TopicBlockProps {
  topic: Topic
  index: number
  isLast: boolean
  titleRef?: React.RefObject<HTMLTextAreaElement | null>
  onTitleChange: (title: string) => void
  onContentChange: (content: any) => void
  sessionNoteId: string
  clientId: string
  onActionCreated: (actionId: string, action: TopicAction) => void
}

function TopicBlock({
  topic,
  index,
  isLast,
  titleRef,
  onTitleChange,
  onContentChange,
  sessionNoteId,
  clientId,
  onActionCreated,
}: TopicBlockProps) {
  const supabase = createClientComponentClient()
  const [showActionForm, setShowActionForm] = useState(false)
  const editorContainerRef = useRef<HTMLDivElement>(null)
  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const editorEl = editorContainerRef.current?.querySelector('.ProseMirror')
      if (editorEl) (editorEl as HTMLElement).focus()
    }
  }

  const autoResizeTextarea = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }

  const handleSlashCommand: SlashCommandHandler = (item, editor) => {
    if (item.id === 'action') {
      setShowActionForm(true)
    } else if (item.id === 'issue') {
      const issueTemplate = {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [
              { type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Describe the problem' }] },
              { type: 'bulletList', content: [
                { type: 'listItem', content: [{ type: 'paragraph' }] },
              ]},
            ],
          },
          {
            type: 'listItem',
            content: [
              { type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'How did you help create this problem?' }] },
              { type: 'bulletList', content: [
                { type: 'listItem', content: [{ type: 'paragraph' }] },
              ]},
            ],
          },
          {
            type: 'listItem',
            content: [
              { type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: "What's your proposed solution?" }] },
              { type: 'bulletList', content: [
                { type: 'listItem', content: [{ type: 'paragraph' }] },
              ]},
            ],
          },
        ],
      }
      editor.chain().focus().insertContent(issueTemplate).run()
    } else if (item.id === 'goal') {
      // Future: goal template
    }
  }

  const submitAction = async (title: string, dueDate: string) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const { data, error } = await supabase
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
        session_topic_id: topic.id,
      })
      .select('id, title, description, due_date, status')
      .single()

    if (data) {
      onActionCreated(data.id, data)
      setShowActionForm(false)
    }
  }

  const [topicActions, setTopicActions] = useState<TopicAction[]>(topic.actions)

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5 items-baseline">
        <span className="text-base font-semibold text-foreground select-none">{index + 1}.</span>
        <textarea
          ref={(el) => {
            if (isLast && titleRef) (titleRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el
            if (el) autoResizeTextarea(el)
          }}
          value={topic.title}
          onChange={(e) => {
            onTitleChange(e.target.value)
            autoResizeTextarea(e.target)
          }}
          onKeyDown={handleTitleKeyDown}
          placeholder="Topic title..."
          rows={1}
          className="flex-1 text-base font-semibold bg-transparent outline-none placeholder:text-muted-foreground/50 resize-none overflow-hidden"
        />
      </div>
      <div ref={editorContainerRef}>
        <SessionEditor
          content={topic.content || {
            type: 'doc',
            content: [{ type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] }],
          }}
          onUpdate={onContentChange}
          placeholder="Start typing notes..."
          onActionTrigger={() => setShowActionForm(true)}
          onSlashCommand={handleSlashCommand}
        />
      </div>

      {/* Inline actions for this topic */}
      {topicActions.length > 0 && (
        <div className="space-y-1.5 mt-2">
          {topicActions.map(action => (
            <ActionRow
              key={action.id}
              action={action}
              onChanged={(updated) => setTopicActions(prev => prev.map(a => a.id === updated.id ? { ...a, ...updated } : a))}
              onRemoved={(id) => setTopicActions(prev => prev.filter(a => a.id !== id))}
            />
          ))}
        </div>
      )}

      {/* Add action form */}
      {showActionForm && (
        <ActionCreateForm
          onSubmit={submitAction}
          onCancel={() => setShowActionForm(false)}
        />
      )}

    </div>
  )
}
