'use client'

import { useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Link2, Check, MoreHorizontal, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

interface ShareNoteButtonProps {
  sessionNoteId: string
  initialShared: boolean
  clientName: string
  clientEmail?: string | null
}

export function ShareNoteButton({ sessionNoteId, initialShared, clientName, clientEmail }: ShareNoteButtonProps) {
  const supabase = createClientComponentClient()
  const [shared, setShared] = useState(initialShared)
  const [busy, setBusy] = useState(false)

  const updateSharing = async (value: boolean) => {
    const { error } = await supabase
      .from('session_notes')
      .update({ shared_with_client: value })
      .eq('id', sessionNoteId)
    if (error) {
      console.error('Failed to update note sharing:', error)
      toast.error(`Couldn't ${value ? 'share' : 'unshare'} this note: ${error.message}`)
      return false
    }
    setShared(value)
    return true
  }

  const handleCopyLink = async () => {
    if (busy) return
    setBusy(true)
    try {
      // Safari only allows clipboard writes that start directly from the click,
      // so copy before any network request.
      const copied = navigator.clipboard.writeText(`${window.location.origin}/sessions/${sessionNoteId}`)
      copied.catch(() => {})
      if (!shared && !(await updateSharing(true))) return
      await copied

      if (clientEmail) {
        toast(`Link copied. ${clientName} can open it by signing in with ${clientEmail}.`)
      } else {
        toast(`Link copied, but ${clientName} has no email on file. Add one to their client record so they can sign in.`)
      }
    } catch (err) {
      console.error('Failed to copy share link:', err)
      toast.error(shared ? "Couldn't copy the link" : "Couldn't copy the link. The note is shared, so try Copy link again.")
    } finally {
      setBusy(false)
    }
  }

  const handleStopSharing = async () => {
    if (await updateSharing(false)) {
      toast(`${clientName} can no longer view this note`)
    }
  }

  return (
    <div className="flex items-center gap-0.5">
      <button
        onClick={handleCopyLink}
        disabled={busy}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[13px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer disabled:opacity-50"
        title={shared ? 'Shared with client. Click to copy the link again' : 'Share with client and copy link'}
      >
        {shared ? <Check className="h-3.5 w-3.5 text-success" /> : <Link2 className="h-3.5 w-3.5" />}
        {shared ? 'Shared' : 'Share'}
      </button>
      {shared && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
              title="Sharing options"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleCopyLink}>
              <Link2 className="h-3.5 w-3.5 mr-2" />
              Copy link
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleStopSharing}>
              <EyeOff className="h-3.5 w-3.5 mr-2" />
              Stop sharing
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
