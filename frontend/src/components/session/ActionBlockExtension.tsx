'use client'

import { Node, mergeAttributes } from '@tiptap/react'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { ActionBlockView } from './ActionBlockView'

export interface ActionBlockOptions {
  clientId: string
  sessionNoteId: string
  onActionCreated?: (actionId: string) => void
  onActionDeleted?: (actionId: string) => void
}

export const ActionBlock = Node.create<ActionBlockOptions>({
  name: 'actionBlock',
  group: 'block',
  atom: true,
  draggable: true,

  addOptions() {
    return {
      clientId: '',
      sessionNoteId: '',
      onActionCreated: undefined,
      onActionDeleted: undefined,
    }
  },

  addAttributes() {
    return {
      actionId: { default: '' },
      prefillTitle: { default: '' },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-action-block]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-action-block': '' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ActionBlockView)
  },
})
