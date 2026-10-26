'use client'

import { useState, useEffect, useCallback, useRef, Fragment } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Copy, Check, Lock } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { formatRelativeDate } from '@/utils/date-utils'
import { copyTiptapContent } from '@/utils/tiptap-clipboard'
import { SessionEditor, SlashCommandHandler, type ActionContext } from './SessionEditor'
import { ActionReviewSection } from './ActionReviewSection'
import type { ActionReviewSectionHandle } from './ActionReviewSection'
import { ActionsSidebar } from './ActionsSidebar'
import type { ActionsSidebarHandle } from './ActionsSidebar'
import { ActionCreatePanel } from './ActionCreatePanel'
import { ActionDetailPanel } from './ActionDetailPanel'
import { ShareNoteButton } from './ShareNoteButton'
import { ACTION_COLUMNS, type ActionItem } from '@/components/ActionRow'
import { GoalsSection } from '@/components/goals/GoalsSection'
import type { GoalsSectionHandle } from '@/components/goals/GoalsSection'
import { GoalDetailPanel } from '@/components/goals/GoalDetailPanel'
import { MagicQuestionsRoundPanel } from '@/components/magic/MagicQuestionsPanel'
import { GOAL_TITLE_PLACEHOLDER, docHasText, fetchGoal, goalNodes, goalNumbersInDoc, goalPrefix, goalsInNote, type Goal } from '@/lib/goals'
import { CAREER_VISION_QUESTION, MAGIC_QUESTIONS_HEADING, careerVisionOf, fetchMagicQuestions, latestSavedVision, magicQuestionsSection, saveMagicRound } from '@/lib/magicQuestions'
import { toast } from 'sonner'

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
  email?: string | null
}

interface SessionWorkspaceProps {
  calendarEvent: CalendarEvent
  client: ClientInfo | null
  sessionNoteId: string
  notesLocked?: boolean
  clientView?: boolean
  sharedWithClient?: boolean
}

export function SessionWorkspace({
  calendarEvent,
  client,
  sessionNoteId,
  notesLocked = false,
  clientView = false,
  sharedWithClient = false,
}: SessionWorkspaceProps) {
  const supabase = createClientComponentClient()
  const [connectionNotes, setConnectionNotes] = useState<any>(undefined)
  const [topicsContent, setTopicsContent] = useState<any>(undefined)
  const [feedbackContent, setFeedbackContent] = useState<any>(undefined)
  const [dataLoaded, setDataLoaded] = useState(false)
  const connectionEditorRef = useRef<any>(null)
  const topicsEditorRef = useRef<any>(null)
  const feedbackEditorRef = useRef<any>(null)
  const [copiedSection, setCopiedSection] = useState<string | null>(null)
  const goalsSectionRef = useRef<GoalsSectionHandle>(null)
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null)
  const [goalCount, setGoalCount] = useState(0)

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
        .select('connection_notes, topics_content, feedback_content')
        .eq('id', sessionNoteId)
        .single()

      setConnectionNotes(stripActionBlocks(data?.connection_notes) || null)
      setTopicsContent(stripActionBlocks(data?.topics_content) || null)
      setFeedbackContent(stripActionBlocks(data?.feedback_content) || null)
      setDataLoaded(true)
    }
    load()
  }, [sessionNoteId, supabase])

  // The vision rarely changes, so /magic starts from the last one given in another session
  const previousVisionRef = useRef<any | null>(null)
  useEffect(() => {
    if (clientView) return
    latestSavedVision(supabase, calendarEvent.client_id, sessionNoteId).then(async saved => {
      if (saved) {
        previousVisionRef.current = saved
        return
      }
      // Rounds written before they were saved, until the client page saves them
      const rounds = await fetchMagicQuestions(supabase, calendarEvent.client_id)
      previousVisionRef.current = rounds
        .filter(r => r.sessionNoteId !== sessionNoteId)
        .map(r => careerVisionOf(r.content))
        .find(Boolean) ?? null
    })
  }, [calendarEvent.client_id, sessionNoteId, clientView, supabase])

  // The round in this note is saved as it's written, like goals
  const savedRoundRef = useRef<string | null>(null)
  const syncMagicRound = useCallback(() => {
    if (clientView) return
    const section = [connectionEditorRef, topicsEditorRef, feedbackEditorRef]
      .map(r => magicQuestionsSection(r.current?.getJSON()))
      .find(Boolean) ?? null
    const serialized = JSON.stringify(section)
    if (savedRoundRef.current === serialized) return
    // Nothing to remove unless a round was seen in this note
    if (!section && savedRoundRef.current === null) return
    savedRoundRef.current = serialized
    saveMagicRound(supabase, {
      clientId: calendarEvent.client_id,
      sessionNoteId,
      sessionDate: calendarEvent.start_time,
      section,
    })
  }, [calendarEvent.client_id, calendarEvent.start_time, sessionNoteId, clientView, supabase])

  // Goals written in this note follow the note until they're first updated
  // from the goal panel; after that the panel's version wins.
  const syncedGoalsRef = useRef(new Map<string, string>())
  const goalCreatesRef = useRef(new Map<string, Promise<void>>())
  // Goals whose update from this note has been saved, so clearing the answers clears it too
  const noteUpdatesRef = useRef(new Set<string>())
  // Once a draft goal is saved, its heading stops being a draft so it's never created twice
  const clearGoalDraft = useCallback((goalId: string) => {
    for (const ed of [connectionEditorRef.current, topicsEditorRef.current, feedbackEditorRef.current]) {
      if (!ed || ed.isDestroyed) continue
      ed.state.doc.forEach((node: any, offset: number) => {
        if (node.type.name !== 'heading' || node.attrs.goalId !== goalId || !node.attrs.goalDraft) return
        ed.view.dispatch(ed.state.tr.setNodeMarkup(offset, undefined, { ...node.attrs, goalDraft: false }).setMeta('addToHistory', false))
      })
    }
  }, [])

  const createGoal = useCallback(async (id: string, fields: { priority: number | null, title: string, owner: string | null, due_date: string | null }) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { error } = await supabase.from('client_goals').insert({
      id,
      user_id: session.user.id,
      client_id: calendarEvent.client_id,
      session_note_id: sessionNoteId,
      ...fields,
    })
    // 23505: already saved by an earlier sync
    if (error && error.code !== '23505') {
      console.error('Error creating goal:', error)
      toast.error('Could not save the goal to the client. Try again.')
      goalCreatesRef.current.delete(id)
      return
    }
    clearGoalDraft(id)
  }, [calendarEvent.client_id, sessionNoteId, supabase, clearGoalDraft])

  const syncGoalsFromNote = useCallback((content: any) => {
    goalsInNote(content).forEach(async (fields, goalId) => {
      const serialized = JSON.stringify(fields)
      if (syncedGoalsRef.current.get(goalId) === serialized) return
      const { draft, priority, title, owner, due_date, ...update } = fields
      if (draft) {
        // A goal written with /goal isn't saved to the client until something's filled in
        const filledIn = title !== GOAL_TITLE_PLACEHOLDER || due_date || update.health
          || docHasText(update.whats_good) || docHasText(update.whats_not_good) || docHasText(update.fix_plan)
        if (!filledIn) return
        if (!goalCreatesRef.current.has(goalId)) {
          goalCreatesRef.current.set(goalId, createGoal(goalId, { priority, title, owner, due_date }))
        }
      }
      await goalCreatesRef.current.get(goalId)
      const now = new Date().toISOString()
      const { data, error } = await supabase
        .from('client_goals')
        .update({ priority, title, owner, due_date, updated_at: now })
        .eq('id', goalId)
        .eq('session_note_id', sessionNoteId)
        .is('last_reviewed_at', null)
        .select('user_id')
      if (error) return console.error('Error saving goal from notes:', error)
      if (!data?.length) return

      // The answers under the template are this session's update, once there's something in them
      const hasUpdate = update.health || docHasText(update.whats_good) || docHasText(update.whats_not_good) || docHasText(update.fix_plan)
      if (hasUpdate || noteUpdatesRef.current.has(goalId)) {
        const { error: updateError } = await supabase
          .from('goal_updates')
          .upsert(
            { ...update, goal_id: goalId, user_id: data[0].user_id, session_note_id: sessionNoteId, from_notes: true, updated_at: now },
            { onConflict: 'goal_id,session_note_id' },
          )
        if (updateError) return console.error('Error saving goal update from notes:', updateError)
        noteUpdatesRef.current.add(goalId)
      }
      syncedGoalsRef.current.set(goalId, serialized)
    })
  }, [sessionNoteId, supabase, createGoal])

  const handleConnectionUpdate = useCallback(async (content: any) => {
    syncGoalsFromNote(content)
    syncMagicRound()
    const { error } = await supabase
      .from('session_notes')
      .update({ connection_notes: content, updated_at: new Date().toISOString() })
      .eq('id', sessionNoteId)
    if (error) throw error
  }, [sessionNoteId, supabase, syncGoalsFromNote, syncMagicRound])

  const handleTopicsUpdate = useCallback(async (content: any) => {
    syncGoalsFromNote(content)
    syncMagicRound()
    const { error } = await supabase
      .from('session_notes')
      .update({ topics_content: content, updated_at: new Date().toISOString() })
      .eq('id', sessionNoteId)
    if (error) throw error
  }, [sessionNoteId, supabase, syncGoalsFromNote, syncMagicRound])

  const handleFeedbackUpdate = useCallback(async (content: any) => {
    syncGoalsFromNote(content)
    syncMagicRound()
    const { error } = await supabase
      .from('session_notes')
      .update({ feedback_content: content, updated_at: new Date().toISOString() })
      .eq('id', sessionNoteId)
    if (error) throw error
  }, [sessionNoteId, supabase, syncGoalsFromNote, syncMagicRound])

  const noopActionCallback = useCallback((_actionId: string) => {
    setActionRefreshKey(k => k + 1)
  }, [])
  const [actionRefreshKey, setActionRefreshKey] = useState(0)
  const [showCreatePanel, setShowCreatePanel] = useState(false)
  const slashActionEditorRef = useRef<any>(null)
  const slashActionPosRef = useRef<number | null>(null)
  const [selectedAction, setSelectedAction] = useState<ActionItem | null>(null)
  const reviewSectionRef = useRef<ActionReviewSectionHandle>(null)
  const actionsSidebarRef = useRef<ActionsSidebarHandle>(null)

  const handleActionChanged = useCallback((updated: ActionItem) => {
    setSelectedAction(prev => prev?.id === updated.id ? updated : prev)
  }, [])

  const handleActionRemoved = useCallback((id: string) => {
    setSelectedAction(prev => prev?.id === id ? null : prev)
  }, [])

  const openGoal = useCallback(async (goalId: string) => {
    const goal = await fetchGoal(supabase, goalId)
    if (!goal) return
    setSelectedAction(null)
    setSelectedGoal(goal)
  }, [supabase])

  const [magicRoundNoteId, setMagicRoundNoteId] = useState<string | null>(null)
  const openMagicQuestions = useCallback((action: ActionItem) => {
    if (!action.session_note_id) return
    setSelectedAction(null)
    setSelectedGoal(null)
    setMagicRoundNoteId(action.session_note_id)
  }, [])

  const handleInlineAction = useCallback(async (title: string, { goalId, fromMagicQuestions }: ActionContext) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 7)
    const dueDateStr = dueDate.toISOString().slice(0, 10)

    // A goal written moments ago may still be on its way to the database
    if (goalId) await goalCreatesRef.current.get(goalId)

    const insert = (goal_id: string | null) => supabase
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
        goal_id,
        from_magic_questions: fromMagicQuestions,
      })
      .select(ACTION_COLUMNS)
      .single()

    let { data, error } = await insert(goalId)
    // The heading can outlive its goal, e.g. after the goal is deleted; keep the action anyway
    if (error?.code === '23503' && goalId) ({ data, error } = await insert(null))
    if (error) {
      console.error('Error creating action:', error)
      toast.error('Could not save the action. Try again.')
      return
    }

    setActionRefreshKey(k => k + 1)

    // Open the panel so the due date can be agreed on with the client
    if (data) setSelectedAction(data as unknown as ActionItem)
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

  const feedbackTemplateContent = [
    { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Feedback' }] },
    { type: 'bulletList', content: [
      { type: 'listItem', content: [
        { type: 'paragraph', content: [
          { type: 'text', marks: [{ type: 'bold' }], text: 'Rating, 1-5?' },
          { type: 'text', text: ' ' },
        ]},
      ]},
      { type: 'listItem', content: [
        { type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'What did you like?' }] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] },
      ]},
      { type: 'listItem', content: [
        { type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'What would it take to get to the next level?' }] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] },
      ]},
    ]},
  ]

  const bold = (text: string) => ({ type: 'text', marks: [{ type: 'bold' }], text })
  const emptyBullets = () => ({ type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] })
  const magicQuestionsTemplateContent = (vision: any | null) => [
    { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: MAGIC_QUESTIONS_HEADING }] },
    { type: 'bulletList', content: [
      { type: 'listItem', content: [{ type: 'paragraph', content: [bold(CAREER_VISION_QUESTION)] }, vision ?? emptyBullets()] },
      ...[
        'Is what you are doing now at work leading toward your career vision, 1-5?',
        'How are you feeling about your life at work, 1-5?',
        'How are you feeling about your personal life, 1-5?',
        'How are we performing as a company, 1-5?',
        'What is it like to work with your peers, 1-5?',
      ].map(q => ({ type: 'listItem', content: [{ type: 'paragraph', content: [bold(q), { type: 'text', text: ' ' }] }] })),
    ]},
    // Keeps the two lists apart, which would otherwise join into one
    { type: 'paragraph' },
    { type: 'bulletList', content: [
      { type: 'listItem', content: [
        { type: 'paragraph', content: [bold('Lowest score:'), { type: 'text', text: ' ' }] },
        { type: 'bulletList', content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'What would get this to the next level?' }] }, emptyBullets()] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Actions' }] }, emptyBullets()] },
        ]},
      ]},
    ]},
  ]

  const insertFeedbackTemplate = (editor: any) => {
    // Collapse first so a highlighted passage isn't replaced by the template
    editor.chain().focus().setTextSelection(editor.state.selection.to).run()
    const insertPos = editor.state.selection.from
    editor.chain().focus().insertContent(feedbackTemplateContent).run()
    // Land the cursor after "Rating, 1-5?" so the score can be typed straight away
    setTimeout(() => {
      let target: number | null = null
      editor.state.doc.descendants((node: any, nodePos: number) => {
        if (target !== null) return false
        if (node.type.name === 'paragraph' && nodePos >= insertPos - 1 && node.textContent.startsWith('Rating, 1-5?')) {
          target = nodePos + 1 + node.content.size
          return false
        }
      })
      if (target !== null) editor.chain().focus().setTextSelection(target).run()
    }, 10)
  }

  const insertMagicQuestionsTemplate = (editor: any) => {
    editor.chain().focus().setTextSelection(editor.state.selection.to).run()
    const insertPos = editor.state.selection.from
    const vision = previousVisionRef.current
    editor.chain().focus().insertContent(magicQuestionsTemplateContent(vision)).run()
    // With last time's vision filled in, start at the first rating; otherwise in the vision answer
    setTimeout(() => {
      let target: number | null = null
      editor.state.doc.descendants((node: any, nodePos: number) => {
        if (target !== null || nodePos < insertPos - 1) return target === null
        if (vision && node.type.name === 'paragraph' && node.textContent.startsWith('Is what you are doing now')) {
          target = nodePos + 1 + node.content.size
        } else if (!vision && node.type.name === 'listItem' && node.textContent === '') {
          target = nodePos + 2
        }
        return target === null
      })
      if (target !== null) editor.chain().focus().setTextSelection(target).run()
    }, 10)
  }

  const insertIssueTemplate = (editor: any, title?: string) => {
    const { from: pos, to } = editor.state.selection
    const doc = editor.state.doc

    if (!title) {
      editor.chain().focus().insertContent(issueTemplateContent).run()
      setTimeout(() => {
        const newDoc = editor.state.doc
        let headingPos: number | null = null
        newDoc.descendants((node: any, nodePos: number) => {
          if (headingPos !== null) return false
          if (node.type.name === 'heading' && nodePos >= pos - 1) {
            headingPos = nodePos
            return false
          }
        })
        if (headingPos !== null) {
          const headingNode = newDoc.nodeAt(headingPos)
          if (headingNode) {
            const hFrom = headingPos + 1
            const hTo = hFrom + headingNode.content.size
            editor.chain().focus().setTextSelection({ from: hFrom, to: hTo }).run()
          }
        }
      }, 10)
      return
    }

    // Determine context: is the selection inside a bulletList?
    const $from = doc.resolve(pos)
    let capturedItems: any[] = []
    let deleteFrom = pos
    let deleteEnd = to

    let insideBulletList = false
    for (let d = $from.depth; d >= 1; d--) {
      if ($from.node(d).type.name === 'bulletList') {
        insideBulletList = true
        const bulletList = $from.node(d)
        const bulletListPos = $from.start(d) - 1

        // Find which listItem contains the selection
        const listItemDepth = d + 1
        let selectedItemIndex = -1
        if ($from.depth >= listItemDepth && $from.node(listItemDepth)?.type.name === 'listItem') {
          selectedItemIndex = $from.index(d)
        }

        // Capture all listItems after the selected one (sibling bullets)
        if (selectedItemIndex >= 0) {
          for (let i = selectedItemIndex + 1; i < bulletList.childCount; i++) {
            capturedItems.push(bulletList.child(i).toJSON())
          }

          // Also capture nested sub-bullets under the selected item
          const selectedItem = bulletList.child(selectedItemIndex)
          selectedItem.forEach((child: any) => {
            if (child.type.name === 'bulletList') {
              child.forEach((subItem: any) => {
                capturedItems.push(subItem.toJSON())
              })
            }
          })
        }

        // Delete from the selected listItem through end of the bulletList
        if (selectedItemIndex >= 0) {
          let itemPos = bulletListPos + 1
          for (let i = 0; i < selectedItemIndex; i++) {
            itemPos += bulletList.child(i).nodeSize
          }
          deleteFrom = itemPos
          deleteEnd = bulletListPos + bulletList.nodeSize

          // If this was the only item (or first with no items before it),
          // delete the entire bulletList node
          if (selectedItemIndex === 0) {
            deleteFrom = bulletListPos
          }
        }
        break
      }
    }

    if (!insideBulletList) {
      // Selection is in a paragraph/heading — check for adjacent bulletList after
      const $to = doc.resolve(to)
      const topNode = $to.node(1)
      const topNodePos = $to.start(1) - 1
      let searchPos = topNode ? topNodePos + topNode.nodeSize : to

      if (searchPos < doc.content.size) {
        const nextNode = doc.nodeAt(searchPos)
        if (nextNode && nextNode.type.name === 'bulletList') {
          nextNode.forEach((listItem: any) => {
            capturedItems.push(listItem.toJSON())
          })
          deleteEnd = searchPos + nextNode.nodeSize
        }
      }
      deleteFrom = pos
    }

    const templateBulletItems = [
      ...capturedItems,
      { type: 'listItem', content: [
        { type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'How did you help create this problem?' }] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] },
      ]},
      { type: 'listItem', content: [
        { type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: "What's your proposed solution?" }] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] },
      ]},
    ]

    const content = [
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: title }] },
      { type: 'bulletList', content: templateBulletItems },
    ]

    editor.chain()
      .focus()
      .deleteRange({ from: deleteFrom, to: deleteEnd })
      .insertContentAt(deleteFrom, content)
      .run()
  }

  // A new goal takes the next priority after the client's open goals and any
  // goals already written in this note
  const nextGoalPriority = () => {
    const numbers = [
      ...[connectionEditorRef, topicsEditorRef, feedbackEditorRef].flatMap(r => goalNumbersInDoc(r.current?.getJSON())),
      ...(goalsSectionRef.current?.getGoals() ?? []).filter(g => g.status === 'open').map(g => g.priority ?? 0),
    ]
    return Math.max(0, ...numbers) + 1
  }

  const insertGoalTemplate = (editor: any, title?: string) => {
    const { from, to } = editor.state.selection
    const doc = editor.state.doc
    const goalTitle = title?.trim()
    const id = crypto.randomUUID()
    const priority = nextGoalPriority()
    const owner = client?.name?.split(' ')[0] ?? ''
    const content = goalNodes({ id, draft: true, priority, title: goalTitle || GOAL_TITLE_PLACEHOLDER, owner })

    if (!goalTitle) {
      editor.chain().focus().insertContent(content).run()
      setTimeout(() => {
        editor.state.doc.forEach((node: any, offset: number) => {
          if (node.type.name !== 'heading' || node.attrs.goalId !== id) return
          const titleStart = offset + 1 + goalPrefix(priority).length
          editor.chain().focus().setTextSelection({ from: titleStart, to: offset + 1 + node.content.size }).run()
        })
      }, 10)
      return
    }

    const $from = doc.resolve(from)
    const $to = doc.resolve(to)
    const blockStart = $from.before(1)
    const blockEnd = $to.after(1)
    const startBlock = $from.node(1)

    // Whole block selected: the block becomes the goal. Otherwise lift the
    // selected text out and put the goal after its top-level block, so the
    // heading never ends up nested inside a list.
    if (startBlock === $to.node(1) && startBlock.isTextblock && startBlock.textContent.trim() === goalTitle) {
      editor.chain().focus().insertContentAt({ from: blockStart, to: blockEnd }, content).run()
    } else {
      editor.chain().focus()
        .insertContentAt(blockEnd, content)
        .deleteRange({ from, to })
        .run()
    }
  }

  const handleSlashCommand: SlashCommandHandler = (item, editor) => {
    if (item.id === 'action') {
      slashActionEditorRef.current = editor
      slashActionPosRef.current = editor.state.selection.from
      setShowCreatePanel(true)
    } else if (item.id === 'issue') {
      insertIssueTemplate(editor)
    } else if (item.id === 'goal') {
      insertGoalTemplate(editor)
    } else if (item.id === 'feedback') {
      insertFeedbackTemplate(editor)
    } else if (item.id === 'magic') {
      insertMagicQuestionsTemplate(editor)
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

  if (clientView) {
    const sections = [
      { key: 'connection', title: 'Connection', content: connectionNotes, ref: connectionEditorRef },
      { key: 'topics', title: 'Topics', content: topicsContent, ref: topicsEditorRef },
      { key: 'feedback', title: 'Feedback', content: feedbackContent, ref: feedbackEditorRef },
    ].filter(s => hasDocContent(s.content))

    // The client's open goals, read-only, after Connection as on the coach's page
    const renderClientGoals = (hrBefore: boolean, hrAfter: boolean) => (
      <div className={goalCount ? 'space-y-10' : 'hidden'}>
        {hrBefore && <hr className="border-border/50" />}
        <section>
          <h2 className="text-[13px] font-medium text-muted-foreground uppercase tracking-widest mb-4">
            Goals
          </h2>
          <GoalsSection
            clientId={calendarEvent.client_id}
            excludeSessionNoteId={sessionNoteId}
            onCountChange={setGoalCount}
            openOnly
          />
        </section>
        {hrAfter && <hr className="border-border/50" />}
      </div>
    )

    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="border-b border-border/50 sticky top-0 bg-background z-10">
          <div className="px-6 py-3 text-center max-sm:px-4">
            <span className="text-[15px] font-medium text-foreground">{clientName}</span>
            <p className="text-[13px] text-muted-foreground">
              {sessionDate} · {sessionTime} · {durationMins} min
            </p>
          </div>
        </div>

        <div className="w-full max-w-2xl mx-auto px-6 py-8 pb-24 space-y-10 max-sm:px-4">
          {dataLoaded && sections.length === 0 && (
            <p className="text-[13px] text-muted-foreground text-center">There are no notes for this session yet.</p>
          )}
          {dataLoaded && sections[0]?.key !== 'connection' && renderClientGoals(false, sections.length > 0)}
          {dataLoaded && sections.map((section, i) => (
            <Fragment key={section.key}>
              {i > 0 && <hr className="border-border/50" />}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[13px] font-medium text-muted-foreground uppercase tracking-widest">
                    {section.title}
                  </h2>
                  <button
                    onClick={() => handleCopySection(section.ref, section.key)}
                    className="p-0.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    title="Copy to clipboard"
                  >
                    {copiedSection === section.key ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <SessionEditor
                  content={section.content}
                  onUpdate={noopUpdate}
                  readOnly
                  dimWhenReadOnly={false}
                  placeholder=""
                  onEditorReady={(ed) => { section.ref.current = ed }}
                />
              </section>
              {section.key === 'connection' && renderClientGoals(true, false)}
            </Fragment>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Slim header */}
      <div className="border-b border-border/50 sticky top-0 bg-background z-10">
        <div className="px-6 py-3 flex items-center justify-between gap-2 max-sm:px-3">
          <div className="w-20 shrink-0 max-sm:w-10" />
          <div className="text-center min-w-0">
            {clientView ? (
              <span className="text-[15px] font-medium text-foreground">{clientName}</span>
            ) : (
              <a href={`/clients/${calendarEvent.client_id}`} className="text-[15px] font-medium text-foreground hover:underline">{clientName}</a>
            )}
            {subtitle && (
              <p className="text-[13px] text-muted-foreground truncate">{subtitle}</p>
            )}
            <p className="sm:hidden text-[12px] text-muted-foreground">
              {sessionDate} · {sessionTime} · {durationMins} min
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[13px] text-muted-foreground max-sm:hidden">
              {sessionDate} · {sessionTime} · {durationMins} min
            </span>
            {!clientView && (
              <ShareNoteButton
                sessionNoteId={sessionNoteId}
                initialShared={sharedWithClient}
                clientName={clientName}
                clientEmail={client?.email}
              />
            )}
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
      <div className="w-full max-w-2xl mx-auto px-6 py-8 pb-[50vh] space-y-10 max-sm:px-4">
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
              onSelectionGoal={(text, ed) => insertGoalTemplate(ed, text)}
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
            ref={reviewSectionRef}
            clientId={calendarEvent.client_id}
            sessionNoteId={sessionNoteId}
            refreshKey={actionRefreshKey}
            onActionSelect={setSelectedAction}
            onActionChanged={handleActionChanged}
            onActionRemoved={handleActionRemoved}
            onGoalSelect={openGoal}
            onMagicQuestionsSelect={openMagicQuestions}
          />
        </section>

        {/* Goals from earlier sessions, hidden until the client has some */}
        <hr className={goalCount ? 'border-border/50' : 'hidden'} />
        <section className={goalCount ? '' : 'hidden'}>
          <h2 className="text-[13px] font-medium text-muted-foreground uppercase tracking-widest mb-4">
            Goals
          </h2>
          <GoalsSection
            ref={goalsSectionRef}
            clientId={calendarEvent.client_id}
            excludeSessionNoteId={sessionNoteId}
            onGoalSelect={(goal) => { setSelectedAction(null); setSelectedGoal(goal) }}
            onCountChange={setGoalCount}
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
              onSelectionGoal={(text, ed) => insertGoalTemplate(ed, text)}
              onEditorReady={(ed) => { topicsEditorRef.current = ed }}
              onCreateAction={handleInlineAction}
            />
          ) : (
            <div className="min-h-[1.5em]" />
          )}
        </section>

        <hr className="border-border/50" />

        {/* Feedback */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[13px] font-medium text-muted-foreground uppercase tracking-widest">
              Feedback
            </h2>
            <button
              onClick={() => handleCopySection(feedbackEditorRef, 'feedback')}
              className="p-0.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="Copy to clipboard"
            >
              {copiedSection === 'feedback' ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
          {dataLoaded ? (
            <SessionEditor
              content={feedbackContent}
              onUpdate={handleFeedbackUpdate}
              placeholder="Use /feedback to add the feedback questions..."
              readOnly={notesLocked}
              clientId={calendarEvent.client_id}
              sessionNoteId={sessionNoteId}
              onActionCreated={noopActionCallback}
              onSlashCommand={handleSlashCommand}
              onSelectionIssue={(text, ed) => insertIssueTemplate(ed, text)}
              onSelectionGoal={(text, ed) => insertGoalTemplate(ed, text)}
              onEditorReady={(ed) => { feedbackEditorRef.current = ed }}
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
            ref={actionsSidebarRef}
            clientId={calendarEvent.client_id}
            sessionNoteId={sessionNoteId}
            refreshKey={actionRefreshKey}
            onActionSelect={setSelectedAction}
            onActionChanged={handleActionChanged}
            onActionRemoved={handleActionRemoved}
            onGoalSelect={openGoal}
            onMagicQuestionsSelect={openMagicQuestions}
          />
        </section>
      </div>

      {selectedAction && (
        <ActionDetailPanel
          key={selectedAction.id}
          action={selectedAction}
          clientName={clientName}
          onClose={() => setSelectedAction(null)}
          onUpdated={(updated) => {
            setSelectedAction(updated)
            reviewSectionRef.current?.applyChanged(updated)
            actionsSidebarRef.current?.applyChanged(updated)
          }}
          onDeleted={(id) => {
            setSelectedAction(null)
            reviewSectionRef.current?.applyRemoved(id)
            actionsSidebarRef.current?.applyRemoved(id)
          }}
          onGoalSelect={openGoal}
          onMagicQuestionsSelect={openMagicQuestions}
        />
      )}

      {magicRoundNoteId && (
        <MagicQuestionsRoundPanel
          key={magicRoundNoteId}
          clientId={calendarEvent.client_id}
          sessionNoteId={magicRoundNoteId}
          onClose={() => setMagicRoundNoteId(null)}
        />
      )}

      {selectedGoal && (
        <GoalDetailPanel
          key={selectedGoal.id}
          goal={selectedGoal}
          sessionNoteId={sessionNoteId}
          clientName={clientName}
          onActionCreated={() => setActionRefreshKey(k => k + 1)}
          onActionChanged={(updated) => {
            reviewSectionRef.current?.applyChanged(updated)
            actionsSidebarRef.current?.applyChanged(updated)
          }}
          onActionRemoved={(id) => {
            reviewSectionRef.current?.applyRemoved(id)
            actionsSidebarRef.current?.applyRemoved(id)
          }}
          onClose={() => setSelectedGoal(null)}
          onUpdated={(updated) => {
            setSelectedGoal(prev => prev?.id === updated.id ? updated : prev)
            goalsSectionRef.current?.applyChanged(updated)
          }}
          onDeleted={(id) => {
            setSelectedGoal(null)
            goalsSectionRef.current?.applyRemoved(id)
          }}
        />
      )}

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

const noopUpdate = async () => {}

function hasDocContent(content: any): boolean {
  if (!content) return false
  if (typeof content.text === 'string' && content.text.trim()) return true
  if (content.type === 'image') return true
  return Array.isArray(content.content) && content.content.some(hasDocContent)
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
