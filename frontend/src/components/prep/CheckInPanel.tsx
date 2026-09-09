'use client'

import { useEffect } from 'react'
import { X, ExternalLink } from 'lucide-react'
import { SessionWorkspace } from '@/components/session/SessionWorkspace'
import { cn } from '@/lib/utils'

interface CheckInPanelProps {
  calendarEvent: {
    id: string
    client_id: string
    start_time: string
    end_time: string
    title: string
  }
  client: {
    id: string
    name: string
    company_name: string | null
    role: string | null
  }
  // Null when the workspace was never opened for this session. /sessions/[id]
  // creates the row on the way in, so that link is the way to get one.
  sessionNoteId: string | null
  onClose: () => void
}

export function CheckInPanel({ calendarEvent, client, sessionNoteId, onClose }: CheckInPanelProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className={cn(
        'fixed top-0 right-0 z-50 h-full w-[55vw] max-w-[800px] min-w-[400px] bg-background border-l border-border shadow-xl',
        'animate-in slide-in-from-right duration-200',
      )}
    >
      {/* Left, because the workspace header puts the session date and duration
          in the top right corner. */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1">
        <a
          href={`/sessions/${sessionNoteId || calendarEvent.id}`}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title="Open full session"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="h-full overflow-y-auto">
        {sessionNoteId ? (
          <SessionWorkspace
            calendarEvent={calendarEvent}
            client={client}
            sessionNoteId={sessionNoteId}
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 h-full px-6 text-center">
            <p className="text-[14px] text-muted-foreground">
              No workspace was opened for this session.
            </p>
            <a
              href={`/sessions/${calendarEvent.id}`}
              className="text-[13px] text-primary hover:text-primary/80"
            >
              Open the session
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
