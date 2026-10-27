'use client'

import { useRef, useState } from 'react'
import { Pencil, X } from 'lucide-react'
import { SessionEditor } from '@/components/session/SessionEditor'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PANEL_MOBILE_CLASS, panelSlideClass, useDismissiblePanel } from '@/lib/dismissiblePanel'
import { visionFromDoc, type VisionVersion } from '@/lib/magicQuestions'
import { formatRoundDate } from './MagicQuestionsPanel'

interface VisionPanelProps {
  /** Newest first */
  versions: VisionVersion[]
  onVersionSelect: (sessionNoteId: string) => void
  /** Rewrites the current version in place; resolves to whether it saved */
  onEditCurrent: (vision: any) => Promise<boolean>
  onClose: () => void
}

/** Every version of a client's five-year vision, with the dates each one held */
export function VisionPanel({ versions, onVersionSelect, onEditCurrent, onClose }: VisionPanelProps) {
  const { panelRef, closing, requestClose } = useDismissiblePanel<HTMLDivElement>(onClose)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const editorRef = useRef<any>(null)

  const save = async () => {
    const vision = visionFromDoc(editorRef.current?.getJSON())
    if (!vision) return
    setSaving(true)
    const saved = await onEditCurrent(vision)
    setSaving(false)
    if (saved) setEditing(false)
  }

  return (
    <div
      ref={panelRef}
      className={cn(
        'fixed top-0 right-0 z-50 h-full w-[480px] max-w-[90vw] bg-background border-l border-border shadow-xl',
        PANEL_MOBILE_CLASS,
        panelSlideClass(closing),
      )}
    >
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/50">
          <span className="text-[14px] font-medium">Five-year vision</span>
          <button
            onClick={requestClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pt-4 pb-8">
          {versions.map((version, i) => {
            const isEditing = editing && i === 0
            return (
              <div key={version.sessionNoteId} className={cn('pb-4', i > 0 && 'pt-4 border-t border-border/40')}>
                <div className="flex items-center justify-between">
                  <div>
                    <button
                      onClick={() => onVersionSelect(version.sessionNoteId)}
                      className="text-[13px] font-medium underline underline-offset-2 decoration-muted-foreground/40 hover:decoration-foreground cursor-pointer"
                      title="Open the round where this was written"
                    >
                      {formatRoundDate(version.from)} – {version.to ? formatRoundDate(version.to) : 'now'}
                    </button>
                    {!version.to && <span className="text-[13px] text-muted-foreground"> · current</span>}
                    {version.editedAt && (
                      <span className="text-[13px] text-muted-foreground"> · edited {formatRoundDate(version.editedAt)}</span>
                    )}
                  </div>
                  {i === 0 && !editing && (
                    <button
                      onClick={() => setEditing(true)}
                      className="flex items-center gap-1 px-2 py-1 rounded-md text-[13px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                  )}
                </div>
                <div
                  className={cn(
                    'mt-1',
                    version.to && 'opacity-70',
                    isEditing && 'rounded-md border border-border px-2',
                  )}
                >
                  <SessionEditor
                    key={isEditing ? 'edit' : 'view'}
                    content={{ type: 'doc', content: [version.vision] }}
                    onUpdate={async () => {}}
                    onEditorReady={isEditing ? (ed) => { editorRef.current = ed } : undefined}
                    readOnly={!isEditing}
                    autofocus={isEditing}
                    dimWhenReadOnly={false}
                    placeholder=""
                    showActionButtons={false}
                    trailingParagraph={false}
                  />
                </div>
                {isEditing && (
                  <div className="flex justify-end gap-2 mt-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={saving}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={save} disabled={saving}>
                      {saving ? 'Saving…' : 'Save'}
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
