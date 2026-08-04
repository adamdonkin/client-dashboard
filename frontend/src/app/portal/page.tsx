'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { format, parseISO } from 'date-fns'
import { Copy, Check, ChevronRight, LogOut } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { copyActionsToClipboard } from '@/utils/copy-actions'
import type { ActionItem } from '@/components/ActionRow'

interface PortalSession {
  id: string
  calendar_event_id: string
  start_time: string
  title: string
  content: any
  connection_notes: string | null
}

interface PortalClient {
  id: string
  name: string
  company_name: string | null
}

function renderTiptapContent(doc: any): string {
  if (!doc || !doc.content) return ''

  function renderNode(node: any): string {
    switch (node.type) {
      case 'doc':
        return (node.content || []).map(renderNode).join('')
      case 'paragraph':
        const pText = (node.content || []).map(renderInline).join('')
        return `<p>${pText}</p>`
      case 'heading': {
        const level = node.attrs?.level || 2
        const hText = (node.content || []).map(renderInline).join('')
        return `<h${level}>${hText}</h${level}>`
      }
      case 'bulletList':
        return `<ul>${(node.content || []).map(renderNode).join('')}</ul>`
      case 'orderedList':
        return `<ol>${(node.content || []).map(renderNode).join('')}</ol>`
      case 'listItem':
        return `<li>${(node.content || []).map(renderNode).join('')}</li>`
      case 'blockquote':
        return `<blockquote>${(node.content || []).map(renderNode).join('')}</blockquote>`
      case 'codeBlock':
        const code = (node.content || []).map(renderInline).join('')
        return `<pre><code>${code}</code></pre>`
      case 'horizontalRule':
        return '<hr />'
      case 'image':
        return `<img src="${node.attrs?.src || ''}" alt="${node.attrs?.alt || ''}" />`
      default:
        if (node.content) return (node.content || []).map(renderNode).join('')
        return ''
    }
  }

  function renderInline(node: any): string {
    if (node.type === 'text') {
      let text = (node.text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      if (node.marks) {
        for (const mark of node.marks) {
          switch (mark.type) {
            case 'bold': text = `<strong>${text}</strong>`; break
            case 'italic': text = `<em>${text}</em>`; break
            case 'strike': text = `<s>${text}</s>`; break
            case 'code': text = `<code>${text}</code>`; break
            case 'link': text = `<a href="${mark.attrs?.href || '#'}" target="_blank" rel="noopener">${text}</a>`; break
          }
        }
      }
      return text
    }
    if (node.type === 'hardBreak') return '<br />'
    return ''
  }

  return renderNode(doc)
}

function tiptapToPlainText(doc: any): string {
  if (!doc || !doc.content) return ''

  function extractText(node: any): string {
    if (node.type === 'text') return node.text || ''
    if (node.type === 'hardBreak') return '\n'
    if (!node.content) return ''
    const childText = node.content.map(extractText).join('')
    if (node.type === 'paragraph' || node.type === 'heading') return childText + '\n'
    if (node.type === 'listItem') return '• ' + childText
    return childText
  }

  return extractText(doc).trim()
}

export default function PortalPage() {
  const supabase = createClientComponentClient()
  const [client, setClient] = useState<PortalClient | null>(null)
  const [actions, setActions] = useState<ActionItem[]>([])
  const [sessions, setSessions] = useState<PortalSession[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedSession, setExpandedSession] = useState<string | null>(null)
  const [copiedActions, setCopiedActions] = useState(false)
  const [copiedNotes, setCopiedNotes] = useState<string | null>(null)

  useEffect(() => {
    fetchPortalData()
  }, [])

  const fetchPortalData = async () => {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Fetch all portal data (auto-links by email if needed)
    let portalData: any
    try {
      const res = await fetch('/api/portal-autolink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) {
        console.error('Portal API error:', res.status)
        setLoading(false)
        return
      }
      portalData = await res.json()
    } catch (err) {
      console.error('Portal fetch failed:', err)
      setLoading(false)
      return
    }

    if (!portalData?.client) {
      setLoading(false)
      return
    }

    setClient(portalData.client)

    setActions((portalData.actions || []).map((a: any) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      description_content: a.description_content,
      status: a.status,
      due_date: a.due_date,
      created_at: a.created_at,
    })))

    setSessions(portalData.sessions || [])

    setLoading(false)
  }

  const handleCopyActions = async () => {
    await copyActionsToClipboard(actions)
    setCopiedActions(true)
    setTimeout(() => setCopiedActions(false), 2000)
  }

  const handleCopyNotes = async (session: PortalSession) => {
    const plainText = tiptapToPlainText(session.content)
    const html = renderTiptapContent(session.content)

    await navigator.clipboard.write([
      new ClipboardItem({
        'text/plain': new Blob([plainText], { type: 'text/plain' }),
        'text/html': new Blob([html], { type: 'text/html' }),
      }),
    ])
    setCopiedNotes(session.id)
    setTimeout(() => setCopiedNotes(null), 2000)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.replace('/auth/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Loading...</p>
        <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-muted-foreground">
          <LogOut className="h-4 w-4 mr-1" />
          Sign out
        </Button>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">No client portal access found for this account.</p>
          <Button variant="outline" onClick={handleSignOut}>Sign Out</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-foreground">{client.name}</h1>
            {client.company_name && (
              <p className="text-sm text-muted-foreground">{client.company_name}</p>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-muted-foreground">
            <LogOut className="h-4 w-4 mr-1" />
            Sign out
          </Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        {/* Actions */}
        {actions.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Open Actions</h2>
              <button
                onClick={handleCopyActions}
                className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                title="Copy actions"
              >
                {copiedActions ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <Card>
              <CardContent className="pt-4">
                <ul className="space-y-2">
                  {actions.map(action => (
                    <li key={action.id} className="flex items-start gap-3 py-1">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-foreground shrink-0" />
                      <div className="min-w-0">
                        <span className="text-sm text-foreground">{action.title}</span>
                        {action.due_date && (
                          <span className="text-xs text-muted-foreground ml-2">
                            by {format(parseISO(action.due_date.slice(0, 10)), 'MMM d')}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Sessions */}
        <section>
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Session Notes</h2>
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No session notes available yet.</p>
          ) : (
            <div className="space-y-2">
              {sessions.map(session => {
                const isExpanded = expandedSession === session.id
                return (
                  <Card key={session.id}>
                    <button
                      onClick={() => setExpandedSession(isExpanded ? null : session.id)}
                      className="w-full text-left"
                    >
                      <CardHeader className="py-3 px-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {format(parseISO(session.start_time), 'EEEE, MMMM d, yyyy')}
                              </p>
                            </div>
                          </div>
                          {isExpanded && (
                            <div
                              onClick={(e) => { e.stopPropagation(); handleCopyNotes(session); }}
                              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                              title="Copy notes"
                            >
                              {copiedNotes === session.id ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                            </div>
                          )}
                        </div>
                      </CardHeader>
                    </button>
                    {isExpanded && (
                      <CardContent className="px-4 pb-4 pt-0">
                        <div
                          className="prose prose-sm max-w-none text-foreground session-editor"
                          dangerouslySetInnerHTML={{ __html: renderTiptapContent(session.content) }}
                        />
                      </CardContent>
                    )}
                  </Card>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
