'use client'

import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { Zap, Target, AlertTriangle, MessageSquare } from 'lucide-react'

export interface SlashCommandItem {
  id: string
  label: string
  icon: React.ReactNode
}

const COMMANDS: SlashCommandItem[] = [
  { id: 'action', label: 'Action', icon: <Zap className="h-4 w-4" /> },
  { id: 'issue', label: 'Issue', icon: <AlertTriangle className="h-4 w-4" /> },
  { id: 'goal', label: 'Goal', icon: <Target className="h-4 w-4" /> },
  { id: 'feedback', label: 'Feedback', icon: <MessageSquare className="h-4 w-4" /> },
]

interface SlashCommandMenuProps {
  items: SlashCommandItem[]
  command: (item: SlashCommandItem) => void
}

export const SlashCommandMenu = forwardRef<any, SlashCommandMenuProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0)

    useEffect(() => {
      setSelectedIndex(0)
    }, [items])

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((prev) => (prev + items.length - 1) % items.length)
          return true
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex((prev) => (prev + 1) % items.length)
          return true
        }
        if (event.key === 'Enter') {
          if (items[selectedIndex]) {
            command(items[selectedIndex])
          }
          return true
        }
        return false
      },
    }))

    if (items.length === 0) return null

    return (
      <div className="z-50 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[200px]">
        {items.map((item, index) => (
          <button
            key={item.id}
            onClick={() => command(item)}
            className={`flex items-center gap-3 w-full px-3 py-2 text-left text-[15px] transition-colors ${
              index === selectedIndex
                ? 'bg-accent text-accent-foreground'
                : 'text-foreground hover:bg-accent/50'
            }`}
          >
            <span className="text-muted-foreground">{item.icon}</span>
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    )
  }
)

SlashCommandMenu.displayName = 'SlashCommandMenu'

export { COMMANDS }
