'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { CheckCircle, Copy, Check, LogOut } from 'lucide-react'
import { formatLastSessionDate } from '@/components/utils/date-utils'
import { copyActionsToClipboard } from '@/utils/copy-actions'
import type { ActionItem } from '@/components/ActionRow'

interface PortalSession {
  id: string
  calendar_event_id: string | null
  start_time: string
  title: string | null
  content: any
  connection_notes: string | null
  duration?: number
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
        return `<p>${(node.content || []).map(renderInline).join('')}</p>`
      case 'heading': {
        const level = node.attrs?.level || 2
        return `<h${level}>${(node.content || []).map(renderInline).join('')}</h${level}>`
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
        return `<pre><code>${(node.content || []).map(renderInline).join('')}</code></pre>`
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
      const portalData = await res.json()

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
    } catch (err) {
      console.error('Portal fetch failed:', err)
    } finally {
      setLoading(false)
    }
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
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="animate-pulse">
            <div className="flex items-center space-x-4 mb-6">
              <div className="space-y-2">
                <div className="h-6 bg-muted rounded w-32"></div>
                <div className="h-4 bg-muted rounded w-24"></div>
              </div>
            </div>
            <div className="h-32 bg-muted rounded mb-4"></div>
            <div className="h-48 bg-muted rounded"></div>
          </div>
        </div>
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
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Client Header — matches ClientDetail */}
        <Card className="border-l-4 border-l-primary">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold">{client.name}</h1>
                {client.company_name && (
                  <p className="text-muted-foreground font-medium">{client.company_name}</p>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-muted-foreground">
                <LogOut className="h-4 w-4 mr-1" />
                Sign out
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Actions — matches ClientDetail */}
        {actions.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Actions</CardTitle>
                <button
                  onClick={handleCopyActions}
                  className="p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  title="Copy actions to clipboard"
                >
                  {copiedActions ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {actions.map((action) => (
                  <div key={action.id} className="flex items-start gap-3 py-1">
                    <div className="flex items-center justify-center w-5 h-5 mt-0.5 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-foreground">{action.title}</span>
                      {action.due_date && (
                        <span className="text-xs text-muted-foreground ml-2">
                          by {formatLastSessionDate(action.due_date.slice(0, 10))}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Session History — matches ClientDetail */}
        <Card>
          <CardHeader>
            <CardTitle>
              Session History
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({sessions.length} session{sessions.length !== 1 ? 's' : ''})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sessions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No session history found.
              </div>
            ) : (
              <div className="space-y-4">
                {sessions.map((session, index) => {
                  const isExpanded = expandedSession === session.id
                  return (
                    <div key={session.id}>
                      <div
                        className="flex items-start gap-4 cursor-pointer hover:bg-muted/50 rounded-md -mx-2 px-2 py-1 transition-colors"
                        onClick={() => setExpandedSession(isExpanded ? null : session.id)}
                      >
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">
                                {session.title || 'Coaching Session'}
                              </p>
                              {session.duration && (
                                <Badge variant="outline" className="text-xs">
                                  {session.duration} min
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {isExpanded && session.content && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleCopyNotes(session); }}
                                  className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                                  title="Copy notes"
                                >
                                  {copiedNotes === session.id ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                                </button>
                              )}
                              <p className="text-sm text-muted-foreground">
                                {formatLastSessionDate(session.start_time)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                      {isExpanded && session.content && (
                        <div className="ml-12 mt-2 mb-2">
                          <div
                            className="prose prose-sm max-w-none text-foreground session-editor"
                            dangerouslySetInnerHTML={{ __html: renderTiptapContent(session.content) }}
                          />
                        </div>
                      )}
                      {index < sessions.length - 1 && (
                        <Separator className="my-4" />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
