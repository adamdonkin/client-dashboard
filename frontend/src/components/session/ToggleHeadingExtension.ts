import { Extension } from '@tiptap/react'
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Transaction } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { Editor } from '@tiptap/react'

const CHEVRON_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>'

const toggleHeadingKey = new PluginKey('toggleHeading')

interface Section {
  headingPos: number
  blocks: { from: number; to: number }[]
  collapsed: boolean
}

const sectionStart = (section: Section) => section.blocks[0].from
const sectionEnd = (section: Section) => section.blocks[section.blocks.length - 1].to

// A section runs from a heading to the next heading of the same or higher
// level: the same reach the copy button uses. Headings with nothing under
// them are skipped, so an empty one never grows a triangle.
function sections(doc: PMNode): Section[] {
  const children: { node: PMNode; offset: number }[] = []
  doc.forEach((node, offset) => children.push({ node, offset }))

  const found: Section[] = []
  children.forEach(({ node, offset }, index) => {
    if (node.type.name !== 'heading' || !node.textContent.trim()) return

    const blocks: { from: number; to: number }[] = []
    for (let i = index + 1; i < children.length; i++) {
      const next = children[i]
      if (next.node.type.name === 'heading' && next.node.attrs.level <= node.attrs.level) break
      blocks.push({ from: next.offset, to: next.offset + next.node.nodeSize })
    }
    if (!blocks.length) return

    found.push({ headingPos: offset, blocks, collapsed: !!node.attrs.collapsed })
  })
  return found
}

function foldedSectionAt(doc: PMNode, pos: number): Section | null {
  return sections(doc).find(s => s.collapsed && pos >= sectionStart(s) && pos <= sectionEnd(s)) ?? null
}

/** Folding is a reading preference rather than an edit, so it stays out of undo history */
function markCollapsed(tr: Transaction, doc: PMNode, headingPos: number, collapsed: boolean) {
  const heading = doc.nodeAt(headingPos)
  if (!heading) return false
  tr.setNodeMarkup(headingPos, undefined, { ...heading.attrs, collapsed })
  return true
}

function setCollapsed(view: EditorView, section: Section, collapsed: boolean) {
  const { doc, selection } = view.state
  const tr = view.state.tr
  if (!markCollapsed(tr, doc, section.headingPos, collapsed)) return

  // A caret left among the blocks being hidden would be invisible, and the
  // plugin below would read it as a reason to reopen the section immediately.
  if (collapsed && selection.from >= sectionStart(section) && selection.from <= sectionEnd(section)) {
    const heading = doc.nodeAt(section.headingPos)!
    const endOfHeading = section.headingPos + 1 + heading.content.size
    tr.setSelection(TextSelection.create(tr.doc, endOfHeading))
  }

  view.dispatch(tr.setMeta('addToHistory', false))
  view.focus()
}

function toggleButton(section: Section) {
  return (view: EditorView) => {
    const hidden = section.blocks.length
    const button = document.createElement('button')
    button.type = 'button'
    button.contentEditable = 'false'
    button.className = section.collapsed ? 'heading-toggle is-collapsed' : 'heading-toggle'
    button.title = section.collapsed
      ? `Expand section (${hidden} ${hidden === 1 ? 'block' : 'blocks'} hidden)`
      : 'Collapse section'
    button.innerHTML = CHEVRON_ICON

    button.addEventListener('mousedown', (e) => e.preventDefault())
    button.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      setCollapsed(view, section, !section.collapsed)
    })

    return button
  }
}

// Backspace and Delete reach across a fold into blocks that cannot be seen.
// Opening the section instead costs one extra keystroke and makes the content
// visible before anything is removed.
function guardDelete(editor: Editor, direction: -1 | 1) {
  const { doc, selection, tr } = editor.state
  if (!selection.empty) return false

  const section = foldedSectionAt(doc, selection.from + direction)
  if (!section) return false

  markCollapsed(tr, doc, section.headingPos, false)
  editor.view.dispatch(tr.setMeta('addToHistory', false))
  return true
}

export const ToggleHeading = Extension.create({
  name: 'toggleHeading',

  addGlobalAttributes() {
    return [
      {
        types: ['heading'],
        attributes: {
          collapsed: {
            default: false,
            keepOnSplit: false,
            parseHTML: element => element.hasAttribute('data-collapsed'),
            renderHTML: attributes => attributes.collapsed ? { 'data-collapsed': '' } : {},
          },
        },
      },
    ]
  },

  addKeyboardShortcuts() {
    return {
      Backspace: () => guardDelete(this.editor, -1),
      Delete: () => guardDelete(this.editor, 1),
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: toggleHeadingKey,

        // Anything that puts the selection inside a fold — arrow keys, a drag,
        // one of the template helpers calling setTextSelection — opens it,
        // rather than letting an edit land on content nobody can see.
        appendTransaction(_transactions, _oldState, newState) {
          const { from, to } = newState.selection
          let tr: Transaction | null = null

          for (const section of sections(newState.doc)) {
            if (!section.collapsed) continue
            if (to < sectionStart(section) || from > sectionEnd(section)) continue
            tr = tr ?? newState.tr
            markCollapsed(tr, newState.doc, section.headingPos, false)
          }

          return tr?.setMeta('addToHistory', false) ?? null
        },

        props: {
          decorations(state) {
            const decorations: Decoration[] = []

            for (const section of sections(state.doc)) {
              decorations.push(
                Decoration.widget(section.headingPos + 1, toggleButton(section), {
                  side: -1,
                  ignoreSelection: true,
                  stopEvent: () => true,
                  key: `heading-toggle-${section.headingPos}-${section.collapsed}-${section.blocks.length}`,
                })
              )

              if (!section.collapsed) continue
              for (const block of section.blocks) {
                decorations.push(Decoration.node(block.from, block.to, { class: 'section-collapsed' }))
              }
            }

            return DecorationSet.create(state.doc, decorations)
          },
        },
      }),
    ]
  },
})
