'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import BulletList from '@tiptap/extension-bullet-list'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect, useRef, useState, useCallback } from 'react'
import { Bold, Italic, Heading1, List, ListOrdered, Zap, AlertTriangle } from 'lucide-react'
import { SlashCommandMenu, COMMANDS, SlashCommandItem } from './SlashCommandMenu'
import { ActionBlock } from './ActionBlockExtension'

export type SlashCommandHandler = (command: SlashCommandItem, editor: any) => void

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface SessionEditorProps {
  content: any
  onUpdate: (content: any) => void
  onSaveStatusChange?: (status: SaveStatus) => void
  placeholder?: string
  autofocus?: boolean
  clientId?: string
  sessionNoteId?: string
  onActionCreated?: (actionId: string) => void
  onSlashCommand?: SlashCommandHandler
  onSelectionIssue?: (selectedText: string, editor: any) => void
}

export function SessionEditor({
  content,
  onUpdate,
  onSaveStatusChange,
  placeholder = 'Start typing...',
  autofocus = false,
  clientId,
  sessionNoteId,
  onActionCreated,
  onSlashCommand,
  onSelectionIssue,
}: SessionEditorProps) {
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const pendingSaveRef = useRef(false)
  const onUpdateRef = useRef(onUpdate)
  onUpdateRef.current = onUpdate
  const onSaveStatusRef = useRef(onSaveStatusChange)
  onSaveStatusRef.current = onSaveStatusChange
  const onSlashCommandRef = useRef(onSlashCommand)
  onSlashCommandRef.current = onSlashCommand
  const onSelectionIssueRef = useRef(onSelectionIssue)
  onSelectionIssueRef.current = onSelectionIssue

  const [slashActive, setSlashActive] = useState(false)
  const [slashQuery, setSlashQuery] = useState('')
  const [slashPos, setSlashPos] = useState<{ top: number; left: number } | null>(null)
  const [selectionToolbar, setSelectionToolbar] = useState<{ top: number; left: number } | null>(null)

  const slashActiveRef = useRef(false)
  const slashStartPosRef = useRef<number | null>(null)
  const menuRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<any>(null)

  const filteredItems = COMMANDS.filter((item) =>
    item.label.toLowerCase().startsWith(slashQuery.toLowerCase())
  )

  const executeCommand = (item: SlashCommandItem) => {
    const ed = editorRef.current
    if (!ed || slashStartPosRef.current === null) return
    const from = slashStartPosRef.current
    const to = ed.state.selection.from
    ed.chain().focus().deleteRange({ from, to }).run()
    setSlashActive(false)
    setSlashQuery('')
    slashActiveRef.current = false
    slashStartPosRef.current = null

    if (onSlashCommandRef.current) {
      onSlashCommandRef.current(item, ed)
    }
  }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: false,
      }),
      BulletList,
      Placeholder.configure({
        placeholder,
      }),
      ...(clientId && sessionNoteId ? [ActionBlock.configure({
        clientId,
        sessionNoteId,
        onActionCreated,
      })] : []),
    ],
    content: content || undefined,
    autofocus,
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[1.5em] text-foreground',
      },
      handleKeyDown: (view, event) => {
        if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'a') {
          const ed = editorRef.current
          if (ed && ed.extensionManager.extensions.find((e: any) => e.name === 'actionBlock')) {
            event.preventDefault()
            let prefill = ''
            const { from, to } = ed.state.selection
            if (from !== to) {
              prefill = ed.state.doc.textBetween(from, to, ' ')
              ed.chain().focus().deleteRange({ from, to }).run()
            }
            ed.chain().focus().insertContent({
              type: 'actionBlock',
              attrs: { actionId: '', prefillTitle: prefill },
            }).run()
            return true
          }
        }

        if (event.key === 'Enter' && !event.shiftKey) {
          const ed = editorRef.current
          if (ed && ed.isActive('heading')) {
            const { $from } = ed.state.selection
            const isAtEnd = $from.parentOffset === $from.parent.content.size
            if (isAtEnd) {
              event.preventDefault()
              ed.chain().focus().insertContentAt(ed.state.selection.to, { type: 'paragraph' }).focus().run()
              return true
            }
          }
        }

        if (slashActiveRef.current) {
          if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'Enter') {
            if (menuRef.current?.onKeyDown({ event })) {
              event.preventDefault()
              return true
            }
          }
          if (event.key === 'Escape') {
            setSlashActive(false)
            setSlashQuery('')
            slashActiveRef.current = false
            slashStartPosRef.current = null
            return true
          }
        }

        return false
      },
    },
    onUpdate: ({ editor: ed }) => {
      const { from } = ed.state.selection
      const textBefore = ed.state.doc.textBetween(
        Math.max(0, from - 50),
        from,
        '\n'
      )

      const slashMatch = textBefore.match(/\/([a-zA-Z]*)$/)

      if (slashMatch) {
        const query = slashMatch[1]
        const matchStart = from - slashMatch[0].length

        if (!slashActiveRef.current) {
          slashStartPosRef.current = matchStart
        }

        setSlashQuery(query)
        setSlashActive(true)
        slashActiveRef.current = true

        const coords = ed.view.coordsAtPos(from)
        const containerRect = containerRef.current?.getBoundingClientRect()
        if (containerRect) {
          setSlashPos({
            top: coords.bottom - containerRect.top + 4,
            left: coords.left - containerRect.left,
          })
        }
      } else if (slashActiveRef.current) {
        setSlashActive(false)
        setSlashQuery('')
        slashActiveRef.current = false
        slashStartPosRef.current = null
      }

      if (debounceRef.current) clearTimeout(debounceRef.current)
      pendingSaveRef.current = true
      debounceRef.current = setTimeout(async () => {
        onSaveStatusRef.current?.('saving')
        try {
          await onUpdateRef.current(ed.getJSON())
          onSaveStatusRef.current?.('saved')
          setTimeout(() => onSaveStatusRef.current?.('idle'), 2000)
        } catch {
          onSaveStatusRef.current?.('error')
        }
        pendingSaveRef.current = false
      }, 1000)
    },
  })

  useEffect(() => {
    if (editor) editorRef.current = editor
  }, [editor])

  const updateSelectionToolbar = useCallback(() => {
    const ed = editorRef.current
    if (!ed || !containerRef.current) {
      setSelectionToolbar(null)
      return
    }
    const { from, to } = ed.state.selection
    if (from === to) {
      setSelectionToolbar(null)
      return
    }
    const coords = ed.view.coordsAtPos(from)
    const endCoords = ed.view.coordsAtPos(to)
    const containerRect = containerRef.current.getBoundingClientRect()
    const toolbarHeight = 40
    const spaceAbove = coords.top - containerRect.top
    const showAbove = spaceAbove > toolbarHeight + 8
    setSelectionToolbar({
      top: showAbove
        ? coords.top - containerRect.top - toolbarHeight
        : endCoords.bottom - containerRect.top + 8,
      left: coords.left - containerRect.left,
    })
  }, [])

  useEffect(() => {
    const ed = editorRef.current
    if (!ed) return
    ed.on('selectionUpdate', updateSelectionToolbar)
    ed.on('blur', () => {
      setTimeout(() => setSelectionToolbar(null), 200)
      flushSave()
    })
    return () => {
      ed.off('selectionUpdate', updateSelectionToolbar)
    }
  }, [editor, updateSelectionToolbar])

  const flushSave = useCallback(() => {
    const ed = editorRef.current
    if (debounceRef.current && ed && pendingSaveRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
      pendingSaveRef.current = false
      onUpdateRef.current(ed.getJSON())
    }
  }, [])

  useEffect(() => {
    const handleBeforeUnload = () => flushSave()
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      flushSave()
    }
  }, [flushSave])

  const handleBubbleAction = () => {
    const ed = editorRef.current
    if (!ed) return
    const { from, to } = ed.state.selection
    let prefill = ''
    if (from !== to) {
      prefill = ed.state.doc.textBetween(from, to, ' ')
      ed.chain().focus().deleteRange({ from, to }).run()
    }
    ed.chain().focus().insertContent({
      type: 'actionBlock',
      attrs: { actionId: '', prefillTitle: prefill },
    }).run()
    setSelectionToolbar(null)
  }

  const handleBubbleIssue = () => {
    const ed = editorRef.current
    if (!ed) return
    const { from, to } = ed.state.selection
    const selectedText = ed.state.doc.textBetween(from, to, ' ')
    if (onSelectionIssueRef.current) {
      onSelectionIssueRef.current(selectedText, ed)
    }
  }

  return (
    <div className="session-editor relative" ref={containerRef}>
      <EditorContent editor={editor} />
      {selectionToolbar && editor && (
        <div
          className="absolute z-50 flex items-center gap-0.5 bg-popover border border-border rounded-lg shadow-lg px-1 py-0.5"
          style={{ top: selectionToolbar.top, left: selectionToolbar.left }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-1.5 rounded hover:bg-accent transition-colors ${editor.isActive('bold') ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`}
          >
            <Bold className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-1.5 rounded hover:bg-accent transition-colors ${editor.isActive('italic') ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`}
          >
            <Italic className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={`p-1.5 rounded hover:bg-accent transition-colors ${editor.isActive('heading', { level: 3 }) ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`}
          >
            <Heading1 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-1.5 rounded hover:bg-accent transition-colors ${editor.isActive('bulletList') ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`}
          >
            <List className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`p-1.5 rounded hover:bg-accent transition-colors ${editor.isActive('orderedList') ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`}
          >
            <ListOrdered className="h-3.5 w-3.5" />
          </button>
          <div className="w-px h-4 bg-border mx-0.5" />
          <button
            onClick={handleBubbleAction}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-accent transition-colors text-muted-foreground text-[13px]"
          >
            <Zap className="h-3.5 w-3.5" />
            Action
          </button>
          <button
            onClick={handleBubbleIssue}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-accent transition-colors text-muted-foreground text-[13px]"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Issue
          </button>
        </div>
      )}
      {slashActive && filteredItems.length > 0 && slashPos && (
        <div
          className="absolute z-50"
          style={{ top: slashPos.top, left: slashPos.left }}
        >
          <SlashCommandMenu
            ref={menuRef}
            items={filteredItems}
            command={executeCommand}
          />
        </div>
      )}
    </div>
  )
}
