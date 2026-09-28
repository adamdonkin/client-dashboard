import { Extension } from '@tiptap/react'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { EditorView } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'
import { copyTiptapContent } from '@/utils/tiptap-clipboard'

const COPY_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>'
const CHECK_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-success"><path d="M20 6 9 17l-5-5"/></svg>'

const issueCopyKey = new PluginKey('issueCopy')

// An issue is a top-level heading plus every block after it, up to the next
// heading of the same or higher level.
function issueContent(doc: PMNode, headingIndex: number) {
  const heading = doc.child(headingIndex)
  const nodes = [heading.toJSON()]
  for (let i = headingIndex + 1; i < doc.childCount; i++) {
    const node = doc.child(i)
    if (node.type.name === 'heading' && node.attrs.level <= heading.attrs.level) break
    nodes.push(node.toJSON())
  }
  return { type: 'doc', content: nodes }
}

function createButton(view: EditorView, getPos: () => number | undefined) {
  const button = document.createElement('button')
  button.type = 'button'
  button.contentEditable = 'false'
  button.className = 'issue-copy-button'
  button.title = 'Copy this issue'
  button.innerHTML = COPY_ICON

  button.addEventListener('mousedown', (e) => e.preventDefault())
  button.addEventListener('click', async (e) => {
    e.preventDefault()
    e.stopPropagation()
    const pos = getPos()
    if (pos === undefined) return
    const headingIndex = view.state.doc.resolve(pos).index(0)
    try {
      if (await copyTiptapContent(issueContent(view.state.doc, headingIndex))) {
        button.innerHTML = CHECK_ICON
        setTimeout(() => { button.innerHTML = COPY_ICON }, 2000)
      }
    } catch (err) {
      console.error('Failed to copy issue:', err)
    }
  })

  return button
}

export const IssueCopy = Extension.create({
  name: 'issueCopy',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: issueCopyKey,
        props: {
          decorations(state) {
            const decorations: Decoration[] = []
            state.doc.forEach((node, offset, index) => {
              if (node.type.name !== 'heading' || !node.textContent.trim()) return
              decorations.push(
                Decoration.widget(offset + 1 + node.content.size, createButton, {
                  side: 1,
                  ignoreSelection: true,
                  stopEvent: () => true,
                  key: `issue-copy-${index}`,
                })
              )
            })
            return DecorationSet.create(state.doc, decorations)
          },
        },
      }),
    ]
  },
})
