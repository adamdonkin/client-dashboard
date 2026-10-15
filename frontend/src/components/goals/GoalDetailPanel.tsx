'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { toast } from 'sonner'
import { format, isToday, parseISO } from 'date-fns'
import { X, Trash2, Check, Copy, MoreHorizontal, Ban, RotateCcw, Plus, ChevronRight, ChevronDown } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ActionDatePicker } from '@/components/session/ActionDatePicker'
import { SessionEditor } from '@/components/session/SessionEditor'
import { ActionDetailPanel } from '@/components/session/ActionDetailPanel'
import { ACTION_COLUMNS, ActionRow, type ActionItem } from '@/components/ActionRow'
import { cn } from '@/lib/utils'
import { copyTiptapContent } from '@/utils/tiptap-clipboard'
import { PANEL_MOBILE_CLASS, panelSlideClass, useDismissiblePanel } from '@/lib/dismissiblePanel'
import { GoalHealthDot } from './GoalRow'
import {
  DEFAULT_GOAL_HEALTH,
  GOAL_HEALTH_META,
  GOAL_QUESTIONS,
  GOAL_UPDATE_COLUMNS,
  docHasText,
  emptySubBullet,
  goalNodes,
  latestUpdateOf,
  type Goal,
  type GoalAnswerKey,
  type GoalHealth,
  type GoalUpdate,
} from '@/lib/goals'

interface GoalDetailPanelProps {
  goal: Goal
  /** The session the goal is being reviewed in; it gets one update per goal */
  sessionNoteId?: string
  clientName?: string | null
  onClose: () => void
  onUpdated?: (updated: Goal) => void
  onDeleted?: (id: string) => void
  /** Keep the page's own action lists in step with changes made from this panel */
  onActionCreated?: (action: ActionItem) => void
  onActionChanged?: (action: ActionItem) => void
  onActionRemoved?: (id: string) => void
}

type GoalPatch = Partial<Pick<Goal, 'priority' | 'title' | 'owner' | 'due_date' | 'status'>>

interface Draft {
  /** The update being edited, or null for a new one */
  updateId: string | null
  health: GoalHealth | null
  initial: Record<GoalAnswerKey, any>
}

const emptyAnswer = () => ({ type: 'doc', content: [emptySubBullet()] })

function QuestionLabel({ answerKey }: { answerKey: GoalAnswerKey }) {
  if (answerKey === 'fix_plan') return <>What will you do to fix the <em>not good</em>?</>
  return <>{GOAL_QUESTIONS.find(q => q.key === answerKey)?.label}</>
}

function firstLine(update: GoalUpdate): string {
  const text = (node: any): string => node?.text ?? (node?.content ?? []).map(text).find((t: string) => t.trim()) ?? ''
  return text(update.whats_not_good) || text(update.whats_good) || text(update.fix_plan) || 'No notes'
}

export function GoalDetailPanel({
  goal,
  sessionNoteId,
  clientName,
  onClose,
  onUpdated,
  onDeleted,
  onActionCreated,
  onActionChanged,
  onActionRemoved,
}: GoalDetailPanelProps) {
  const supabase = createClientComponentClient()
  const goalRef = useRef(goal)
  goalRef.current = goal

  const [title, setTitle] = useState(goal.title)
  const [owner, setOwner] = useState(goal.owner ?? '')
  const [priority, setPriority] = useState(goal.priority?.toString() ?? '')
  const [healthOptions, setHealthOptions] = useState<GoalHealth[]>(DEFAULT_GOAL_HEALTH)
  const [updates, setUpdates] = useState<GoalUpdate[]>([])
  const [updatesLoaded, setUpdatesLoaded] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)

  // Text boxes own their text while the panel is open, so a save landing
  // mid-typing can't move the cursor
  useEffect(() => {
    setTitle(goal.title)
    setOwner(goal.owner ?? '')
    setPriority(goal.priority?.toString() ?? '')
  }, [goal.id])

  useEffect(() => {
    supabase.rpc('get_enum_values', { enum_name: 'goal_health' }).then(({ data, error }) => {
      if (error) console.error('Error fetching goal statuses:', error.message || error)
      else if (data?.length) setHealthOptions(data.map((row: { value: GoalHealth }) => row.value))
    })
  }, [supabase])

  const loadUpdates = useCallback(async () => {
    const { data, error } = await supabase
      .from('goal_updates')
      .select(GOAL_UPDATE_COLUMNS)
      .eq('goal_id', goal.id)
      .order('created_at', { ascending: false })
    if (error) console.error('Error loading goal updates:', error)
    setUpdates((data as GoalUpdate[]) || [])
    setUpdatesLoaded(true)
    return (data as GoalUpdate[]) || []
  }, [goal.id, supabase])

  useEffect(() => { loadUpdates() }, [loadUpdates])

  // ---- Actions ----

  const [actions, setActions] = useState<ActionItem[]>([])
  const [showResolved, setShowResolved] = useState(false)
  const [selectedAction, setSelectedAction] = useState<ActionItem | null>(null)

  useEffect(() => {
    supabase
      .from('client_actions')
      .select(ACTION_COLUMNS)
      .eq('goal_id', goal.id)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error('Error loading goal actions:', error)
        setActions((data as unknown as ActionItem[]) || [])
      })
  }, [goal.id, supabase])

  const applyActionChanged = (updated: ActionItem) => {
    // Moved to another goal, or unlinked, from the action panel
    if (updated.goal_id !== goal.id) setActions(prev => prev.filter(a => a.id !== updated.id))
    else setActions(prev => prev.map(a => a.id === updated.id ? { ...a, ...updated } : a))
    setSelectedAction(prev => prev?.id === updated.id ? updated : prev)
    onActionChanged?.(updated)
  }

  const applyActionRemoved = (id: string) => {
    setActions(prev => prev.filter(a => a.id !== id))
    setSelectedAction(prev => prev?.id === id ? null : prev)
    onActionRemoved?.(id)
  }

  // Same as Action in session notes, linked to this goal
  const createAction = async (title: string) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const due = new Date()
    due.setDate(due.getDate() + 7)
    const { data, error } = await supabase
      .from('client_actions')
      .insert({
        user_id: session.user.id,
        client_id: goalRef.current.client_id,
        source: sessionNoteId ? 'session' : 'manual',
        source_id: sessionNoteId ? `session-${sessionNoteId}-${Date.now()}` : `manual-${Date.now()}`,
        title,
        status: 'to_do',
        due_date: due.toISOString().slice(0, 10),
        session_note_id: sessionNoteId ?? null,
        goal_id: goalRef.current.id,
      })
      .select(ACTION_COLUMNS)
      .single()
    if (error || !data) {
      console.error('Error creating action:', error)
      toast.error('Could not save the action. Try again.')
      return
    }
    // Listed above the update rather than opened, so writing the update isn't interrupted;
    // the due date can be changed from the list
    const action = data as unknown as ActionItem
    setActions(prev => [...prev, action])
    onActionCreated?.(action)
  }

  const openActions = actions.filter(a => a.status === 'to_do')
  const resolvedActions = actions.filter(a => a.status !== 'to_do')

  const saveGoal = useCallback(async (patch: GoalPatch) => {
    const now = new Date().toISOString()
    const next: Goal = { ...goalRef.current, ...patch, last_reviewed_at: now }
    goalRef.current = next
    onUpdated?.(next)
    const { error } = await supabase
      .from('client_goals')
      .update({ ...patch, last_reviewed_at: now, updated_at: now })
      .eq('id', next.id)
    if (error) {
      console.error('Error saving goal:', error)
      toast.error('Could not save the goal. Try again.')
    }
  }, [supabase, onUpdated])

  const saveGoalRef = useRef(saveGoal)
  saveGoalRef.current = saveGoal

  // Title, owner and priority save after a pause in typing, and on close
  const pendingTextRef = useRef<GoalPatch>({})
  const textTimerRef = useRef<NodeJS.Timeout | null>(null)

  const flushText = useCallback(() => {
    if (textTimerRef.current) {
      clearTimeout(textTimerRef.current)
      textTimerRef.current = null
    }
    const patch = pendingTextRef.current
    pendingTextRef.current = {}
    if (Object.keys(patch).length > 0) saveGoalRef.current(patch)
  }, [])

  const queueText = (patch: GoalPatch) => {
    pendingTextRef.current = { ...pendingTextRef.current, ...patch }
    if (textTimerRef.current) clearTimeout(textTimerRef.current)
    textTimerRef.current = setTimeout(flushText, 500)
  }

  // ---- Updates ----

  const draftEditorsRef = useRef<Partial<Record<GoalAnswerKey, any>>>({})
  const draftRef = useRef(draft)
  draftRef.current = draft
  const draftDirtyRef = useRef(false)

  const sessionUpdate = sessionNoteId ? updates.find(u => u.session_note_id === sessionNoteId) : undefined

  const openDraft = (update?: GoalUpdate) => {
    draftDirtyRef.current = false
    draftEditorsRef.current = {}
    setDraft({
      updateId: update?.id ?? null,
      health: update?.health ?? null,
      initial: {
        whats_good: docHasText(update?.whats_good) ? update!.whats_good : emptyAnswer(),
        whats_not_good: docHasText(update?.whats_not_good) ? update!.whats_not_good : emptyAnswer(),
        fix_plan: docHasText(update?.fix_plan) ? update!.fix_plan : emptyAnswer(),
      },
    })
  }

  const saveDraft = useCallback(async () => {
    const d = draftRef.current
    if (!d) return
    const answers = Object.fromEntries(GOAL_QUESTIONS.map(q => {
      const content = draftEditorsRef.current[q.key]?.getJSON() ?? d.initial[q.key]
      return [q.key, docHasText(content) ? content : null]
    })) as Record<GoalAnswerKey, any>
    const now = new Date().toISOString()

    setSaving(true)
    let error
    if (d.updateId) {
      ({ error } = await supabase
        .from('goal_updates')
        .update({ health: d.health, ...answers, updated_at: now })
        .eq('id', d.updateId))
    } else {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setSaving(false); return }
      ({ error } = await supabase.from('goal_updates').insert({
        goal_id: goalRef.current.id,
        user_id: session.user.id,
        session_note_id: sessionNoteId ?? null,
        health: d.health,
        ...answers,
      }))
    }
    setSaving(false)

    if (error) {
      console.error('Error saving goal update:', error)
      toast.error('Could not save the update. Try again.')
      return
    }

    setDraft(null)
    draftDirtyRef.current = false
    const fresh = await loadUpdates()
    const now2 = new Date().toISOString()
    const next = latestUpdateOf({ ...goalRef.current, last_reviewed_at: now2 }, fresh)
    goalRef.current = next
    onUpdated?.(next)
    // The note the goal came from stops overwriting it once it's been updated here
    await supabase.from('client_goals').update({ last_reviewed_at: now2 }).eq('id', next.id)
  }, [sessionNoteId, supabase, loadUpdates, onUpdated])

  const deleteDraftUpdate = async () => {
    const d = draftRef.current
    if (!d?.updateId) return
    const { error } = await supabase.from('goal_updates').delete().eq('id', d.updateId)
    if (error) {
      toast.error('Could not delete the update.')
      return
    }
    setDraft(null)
    const fresh = await loadUpdates()
    const next = latestUpdateOf(goalRef.current, fresh)
    goalRef.current = next
    onUpdated?.(next)
  }

  // Closing with an unsaved update keeps it rather than losing what was typed
  const beforeClose = useCallback(() => {
    flushText()
    if (draftRef.current && draftDirtyRef.current) {
      saveDraft()
      toast('Update saved')
    }
  }, [flushText, saveDraft])

  useEffect(() => () => flushText(), [flushText])

  const { panelRef, closing, requestClose } = useDismissiblePanel<HTMLDivElement>(onClose, beforeClose, !!selectedAction)

  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    flushText()
    const latest = updates[0]
    await copyTiptapContent({
      type: 'doc',
      content: goalNodes({
        ...goalRef.current,
        health: latest?.health ?? null,
        whats_good: latest?.whats_good,
        whats_not_good: latest?.whats_not_good,
        fix_plan: latest?.fix_plan,
      }),
    })
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDelete = async () => {
    requestClose()
    onDeleted?.(goal.id)
    const { error } = await supabase.from('client_goals').delete().eq('id', goal.id)
    if (error) toast.error('Could not delete the goal.')
    else toast('Goal deleted')
  }

  const isCompleted = goal.status === 'completed'
  const visibleUpdates = updates.filter(u => u.id !== draft?.updateId)
  const [referenceUpdate, ...earlierUpdates] = visibleUpdates
  const canAddUpdate = !draft && !sessionUpdate

  const toggleExpanded = (id: string) => setExpanded(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const updateDateLabel = (u: GoalUpdate) => isToday(parseISO(u.created_at)) ? 'Today' : format(parseISO(u.created_at), 'MMM d')

  const renderUpdateCard = (u: GoalUpdate, muted = false) => (
    <div className={cn('mx-5 mb-2 rounded-lg border border-border/60 px-3.5 py-3', muted && 'bg-muted/30')}>
      <div className="flex items-center gap-2 text-[13px]">
        <GoalHealthDot health={u.health} className="h-2 w-2" />
        <span className="font-semibold">{updateDateLabel(u)}</span>
        <span className="text-muted-foreground">{u.health ? GOAL_HEALTH_META[u.health].label : 'No status'}</span>
        <div className="ml-auto flex items-center gap-3 text-[12px] text-muted-foreground">
          {u.from_notes && <span>From notes</span>}
          {u.session_note_id && (
            <a href={`/sessions/${u.session_note_id}`} className="underline underline-offset-2 hover:text-foreground">Session</a>
          )}
          {!draft && (
            <button onClick={() => openDraft(u)} className="hover:text-foreground cursor-pointer">Edit</button>
          )}
        </div>
      </div>
      {GOAL_QUESTIONS.filter(q => docHasText(u[q.key])).map(q => (
        <div key={q.key} className="mt-2.5 action-panel-editor">
          <p className="text-[13px] font-semibold text-foreground mb-0.5"><QuestionLabel answerKey={q.key} /></p>
          <SessionEditor
            key={`${u.id}-${q.key}`}
            content={u[q.key]}
            onUpdate={async () => {}}
            readOnly
            dimWhenReadOnly={false}
            placeholder=""
            showActionButtons={false}
            trailingParagraph={false}
          />
        </div>
      ))}
      {!GOAL_QUESTIONS.some(q => docHasText(u[q.key])) && (
        <p className="mt-2 text-[13px] text-muted-foreground">No notes</p>
      )}
    </div>
  )

  return (
    <div
      ref={panelRef}
      className={cn(
        'fixed top-0 right-0 z-50 h-full w-[420px] max-w-[90vw] bg-background border-l border-border shadow-xl',
        PANEL_MOBILE_CLASS,
        panelSlideClass(closing),
      )}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/50">
          <button
            onClick={() => saveGoal({ status: isCompleted ? 'open' : 'completed' })}
            className={cn(
              'flex items-center gap-1.5 text-[13px] px-2.5 py-1 rounded-md border transition-colors',
              isCompleted
                ? 'border-success/40 bg-success/15 text-success'
                : 'border-foreground/20 text-foreground/70 hover:text-foreground hover:border-foreground/40',
            )}
          >
            <Check className="h-3.5 w-3.5" />
            {isCompleted ? 'Completed' : 'Mark completed'}
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={handleCopy}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="Copy goal and latest update"
            >
              {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {goal.status === 'dropped' ? (
                  <DropdownMenuItem onClick={() => saveGoal({ status: 'open' })}>
                    <RotateCcw className="h-3.5 w-3.5 mr-2" />
                    Reopen goal
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => { saveGoal({ status: 'dropped' }); requestClose() }}>
                    <Ban className="h-3.5 w-3.5 mr-2" />
                    Drop goal
                  </DropdownMenuItem>
                )}
                {onDeleted && (
                  <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
                    <Trash2 className="h-3.5 w-3.5 mr-2" />
                    Delete goal
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              onClick={requestClose}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-8">
          {/* Priority and title */}
          <div className="px-5 pt-4 pb-4 flex items-start gap-1">
            <span className="text-[17px] font-medium text-muted-foreground leading-[26px]">#</span>
            <input
              value={priority}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '')
                setPriority(value)
                queueText({ priority: value ? Number(value) : null })
              }}
              inputMode="numeric"
              aria-label="Priority"
              placeholder="–"
              className="w-8 text-[17px] font-medium bg-transparent outline-none leading-[26px] tabular-nums placeholder:text-muted-foreground"
            />
            <textarea
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                if (e.target.value.trim()) queueText({ title: e.target.value.trim() })
                e.target.style.height = 'auto'
                e.target.style.height = e.target.scrollHeight + 'px'
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }}
              ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }}
              rows={1}
              className="flex-1 text-[17px] font-medium bg-transparent outline-none placeholder:text-muted-foreground resize-none overflow-hidden leading-[26px]"
              placeholder="Goal you intend to accomplish"
            />
          </div>

          <div className="border-t border-border/40" />

          <div className="h-[48px] flex items-center gap-3 text-[13px] px-5">
            <span className="text-muted-foreground w-14">Owner</span>
            <input
              value={owner}
              onChange={(e) => {
                setOwner(e.target.value)
                queueText({ owner: e.target.value.trim() || null })
              }}
              placeholder="Name"
              className="flex-1 bg-transparent outline-none text-[13px] placeholder:text-muted-foreground"
            />
          </div>

          <div className="border-t border-border/40" />

          <div className="h-[48px] flex items-center gap-3 text-[13px] px-5">
            <span className="text-muted-foreground w-14">Due</span>
            <ActionDatePicker
              value={goal.due_date ?? ''}
              onChange={(value) => saveGoal({ due_date: value || null })}
            />
          </div>

          {/* Actions linked to the goal, hidden until it has some */}
          {actions.length > 0 && (
            <div className="border-t border-border/40 pb-2">
              <div className="px-5 pt-4 pb-2">
                <span className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">Actions</span>
              </div>
              <div className="px-5 space-y-1.5">
                {openActions.map(a => (
                  <ActionRow
                    key={a.id}
                    action={a}
                    onChanged={applyActionChanged}
                    onRemoved={applyActionRemoved}
                    onSelect={setSelectedAction}
                    reviewSessionNoteId={sessionNoteId}
                    showGoal={false}
                  />
                ))}
                {openActions.length === 0 && (
                  <p className="text-[13px] text-muted-foreground">No open actions</p>
                )}
              </div>
              {resolvedActions.length > 0 && (
                <>
                  <button
                    onClick={() => setShowResolved(prev => !prev)}
                    className="flex items-center gap-1 px-5 pt-2 text-[12px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    {showResolved ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    {showResolved ? 'Hide completed & cancelled' : `Show completed & cancelled (${resolvedActions.length})`}
                  </button>
                  {showResolved && (
                    <div className="px-5 pt-1.5 space-y-1.5">
                      {resolvedActions.map(a => (
                        <ActionRow
                          key={a.id}
                          action={a}
                          onChanged={applyActionChanged}
                          onRemoved={applyActionRemoved}
                          onSelect={setSelectedAction}
                          showGoal={false}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Update being written */}
          {draft && (
            <>
              <div className="flex items-center justify-between px-5 pt-4 pb-2 border-t border-border/40">
                <span className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
                  {draft.updateId
                    ? `Editing update · ${format(parseISO(updates.find(u => u.id === draft.updateId)!.created_at), 'MMM d')}`
                    : `New update · ${format(new Date(), 'MMM d')}`}
                </span>
              </div>
              <div className="mx-5 mb-4 rounded-lg border border-border px-3.5 py-3 shadow-sm">
                <p className="text-[13px] font-semibold text-foreground">Status</p>
                <div className="flex items-center gap-1 flex-wrap mt-1">
                  {healthOptions.map(h => {
                    const meta = GOAL_HEALTH_META[h]
                    if (!meta) return null
                    const selected = draft.health === h
                    return (
                      <button
                        key={h}
                        onClick={() => {
                          draftDirtyRef.current = true
                          setDraft(prev => prev && { ...prev, health: selected ? null : h })
                        }}
                        className={cn(
                          'flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[13px] transition-colors cursor-pointer',
                          selected
                            ? 'border-foreground/30 bg-accent text-foreground'
                            : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-accent',
                        )}
                      >
                        <span className={cn('h-2 w-2 rounded-full', meta.dotClass)} />
                        {meta.label}
                      </button>
                    )
                  })}
                </div>

                {GOAL_QUESTIONS.map(q => (
                  <div key={q.key} className="mt-3 action-panel-editor">
                    <p className="text-[13px] font-semibold text-foreground mb-0.5"><QuestionLabel answerKey={q.key} /></p>
                    <SessionEditor
                      key={`${draft.updateId ?? 'new'}-${q.key}`}
                      content={draft.initial[q.key]}
                      onUpdate={async () => { draftDirtyRef.current = true }}
                      onEditorReady={(ed) => { draftEditorsRef.current[q.key] = ed }}
                      onCreateAction={(title) => createAction(title)}
                      placeholder=""
                      trailingParagraph={false}
                    />
                  </div>
                ))}

                <div className="flex items-center gap-2 mt-4">
                  {draft.updateId && (
                    <button
                      onClick={deleteDraftUpdate}
                      className="text-[13px] px-2.5 py-1 rounded-md text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                    >
                      Delete update
                    </button>
                  )}
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      onClick={() => { draftDirtyRef.current = false; setDraft(null) }}
                      className="text-[13px] px-2.5 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveDraft}
                      disabled={saving}
                      className="text-[13px] px-3 py-1 rounded-md bg-foreground text-background hover:bg-foreground/90 transition-colors cursor-pointer disabled:opacity-60"
                    >
                      {saving ? 'Saving…' : 'Save update'}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Latest (or, while writing, the last) update in full */}
          <div className={cn('flex items-center justify-between px-5 pt-4 pb-2', !draft && 'border-t border-border/40')}>
            <span className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
              {draft ? 'Last update' : 'Latest update'}
            </span>
            {canAddUpdate && (
              <button
                onClick={() => openDraft()}
                className="flex items-center gap-1 text-[13px] px-3 py-1 rounded-md bg-foreground text-background hover:bg-foreground/90 transition-colors cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                New update
              </button>
            )}
          </div>
          {updatesLoaded && !referenceUpdate && (
            <p className="px-5 text-[13px] text-muted-foreground">No updates yet</p>
          )}
          {referenceUpdate && renderUpdateCard(referenceUpdate, !!draft)}

          {/* Earlier updates, one line each */}
          {earlierUpdates.length > 0 && (
            <>
              <div className="px-5 pt-4 pb-1">
                <span className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">Earlier updates</span>
              </div>
              {earlierUpdates.map(u => expanded.has(u.id) ? (
                <div key={u.id}>
                  <button
                    onClick={() => toggleExpanded(u.id)}
                    className="flex items-center gap-1 px-5 py-1.5 text-[12px] text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <ChevronDown className="h-3 w-3" />
                    Collapse
                  </button>
                  {renderUpdateCard(u)}
                </div>
              ) : (
                <button
                  key={u.id}
                  onClick={() => toggleExpanded(u.id)}
                  className="w-full flex items-center gap-2 px-5 py-2 text-[13px] text-muted-foreground hover:bg-accent/50 transition-colors cursor-pointer text-left"
                >
                  <GoalHealthDot health={u.health} className="h-2 w-2" />
                  <span className="w-14 text-foreground shrink-0">{updateDateLabel(u)}</span>
                  <span className="flex-1 truncate">{firstLine(u)}</span>
                  {u.from_notes && <span className="text-[11px] shrink-0">From notes</span>}
                  <ChevronRight className="h-3 w-3 shrink-0" />
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Inside the goal panel, so working in it doesn't read as a click away from the goal */}
      {selectedAction && (
        <ActionDetailPanel
          key={selectedAction.id}
          action={selectedAction}
          clientName={clientName}
          onClose={() => setSelectedAction(null)}
          onUpdated={applyActionChanged}
          onDeleted={applyActionRemoved}
          onGoalSelect={() => setSelectedAction(null)}
        />
      )}
    </div>
  )
}
