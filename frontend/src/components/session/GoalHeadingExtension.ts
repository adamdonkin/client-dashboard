import { Extension } from '@tiptap/react'

// Links a Goal template heading to its row in client_goals
export const GoalHeading = Extension.create({
  name: 'goalHeading',

  addGlobalAttributes() {
    return [
      {
        types: ['heading'],
        attributes: {
          goalId: {
            default: null,
            keepOnSplit: false,
            parseHTML: element => element.getAttribute('data-goal-id'),
            renderHTML: attributes => attributes.goalId ? { 'data-goal-id': attributes.goalId } : {},
          },
        },
      },
    ]
  },
})
