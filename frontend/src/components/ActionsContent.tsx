'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChevronDown, ChevronRight, Loader2, Calendar, AlertCircle, RefreshCw, Search, Copy, Check } from 'lucide-react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { ClientActionGroup, ClientAction } from '@/app/api/actions/route'
import { formatRelativeDate } from '@/utils/date-utils'
import { parseISO, isThisWeek } from 'date-fns'
import { ActionRow } from '@/components/ActionRow'
import type { ActionItem } from '@/components/ActionRow'
import { ActionDetailPanel } from '@/components/session/ActionDetailPanel'
import { copyActionsToClipboard } from '@/utils/copy-actions'

function ClientGroup({ group, onSelectAction }: { group: ClientActionGroup; onSelectAction: (action: ActionItem, clientName: string) => void }) {
  const [expanded, setExpanded] = useState(group.actions.length > 0)
  const [copied, setCopied] = useState(false)
  const router = useRouter()

  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none pb-0"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {expanded
              ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
              : <ChevronRight className="h-4 w-4 text-muted-foreground" />
            }
            <CardTitle
              className="text-base cursor-pointer hover:underline"
              onClick={(e) => {
                e.stopPropagation()
                if (group.client_id) router.push(`/clients/${group.client_id}`)
              }}
            >
              {group.client_name}
            </CardTitle>
            {group.company_name && (
              <span className="text-xs text-muted-foreground">
                {group.company_name}{group.role ? ` · ${group.role}` : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {group.actions.length > 0 && (
              <button
                onClick={async (e) => {
                  e.stopPropagation()
                  await copyActionsToClipboard(group.actions)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                }}
                className="p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="Copy actions to clipboard"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            )}
            {group.next_session_date && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatRelativeDate(group.next_session_date)}
              </span>
            )}
            <Badge variant="secondary" className="text-xs">
              {group.actions.length} {group.actions.length === 1 ? 'action' : 'actions'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-2 pb-2">
          {group.actions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2 px-4">No active actions</p>
          ) : (
            <div className="space-y-1.5 px-2">
              {group.actions.map((action) => (
                <ActionRow
                  key={action.id}
                  action={action}
                  onSelect={(a) => onSelectAction(a, group.client_name)}
                  showSource
                />
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}

function DueThisWeekView({ groups, onSelectAction }: { groups: ClientActionGroup[]; onSelectAction: (action: ActionItem, clientName: string) => void }) {
  const router = useRouter()

  const dueThisWeek = useMemo(() => {
    const all: (ClientAction & { client_name: string; client_id: string | null })[] = []
    for (const g of groups) {
      for (const a of g.actions) {
        if (!a.due_date) continue
        const due = parseISO(a.due_date)
        if (isThisWeek(due, { weekStartsOn: 1 })) {
          all.push({ ...a, client_name: g.client_name, client_id: g.client_id })
        }
      }
    }
    return all.sort((a, b) => {
      const da = new Date(a.due_date!).getTime()
      const db = new Date(b.due_date!).getTime()
      return da - db
    })
  }, [groups])

  if (dueThisWeek.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <p className="text-center text-muted-foreground">No actions due this week</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <p className="text-sm text-muted-foreground">
        {dueThisWeek.length} {dueThisWeek.length === 1 ? 'action' : 'actions'} due this week
      </p>
      <Card>
        <CardContent className="pt-4 pb-2">
          <div className="space-y-1">
            {dueThisWeek.map((action) => {
              return (
                <div key={action.id} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <ActionRow
                      action={action}
                      onSelect={(a) => onSelectAction(a, action.client_name)}
                      showSource
                    />
                  </div>
                  <span
                    className="text-xs text-primary hover:underline cursor-pointer shrink-0"
                    onClick={() => {
                      if (action.client_id) router.push(`/clients/${action.client_id}`)
                    }}
                  >
                    {action.client_name}
                  </span>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </>
  )
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function MyActionsGroup({ actions, onSelectAction }: { actions: ClientAction[]; onSelectAction: (action: ActionItem, clientName: string) => void }) {
  const [expanded, setExpanded] = useState(true)

  return (
    <Card className="border-amber-500/20">
      <CardHeader
        className="cursor-pointer select-none pb-0"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {expanded
              ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
              : <ChevronRight className="h-4 w-4 text-muted-foreground" />
            }
            <CardTitle className="text-base">My Actions</CardTitle>
          </div>
          <Badge variant="secondary" className="text-xs">
            {actions.length} {actions.length === 1 ? 'action' : 'actions'}
          </Badge>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-3 pb-2">
          <div className="space-y-1">
            {actions.map(a => (
              <div key={a.id} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <ActionRow
                    action={a}
                    onSelect={(action) => onSelectAction(action, (a as any).client_name || 'Client')}
                    showSource
                  />
                </div>
                {(a as any).client_name && (a as any).client_name !== 'Unmatched' && (
                  <span className="text-xs text-muted-foreground shrink-0">{(a as any).client_name}</span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  )
}

type ViewTab = 'by_client' | 'due_this_week'

export function ActionsContent() {
  const [groups, setGroups] = useState<ClientActionGroup[]>([])
  const [myActions, setMyActions] = useState<ClientAction[]>([])
  const [totalActions, setTotalActions] = useState(0)
  const [lastSynced, setLastSynced] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [viewTab, setViewTab] = useState<ViewTab>('by_client')
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [selectedAction, setSelectedAction] = useState<ActionItem | null>(null)
  const [selectedClientName, setSelectedClientName] = useState<string | null>(null)

  const handleSelectAction = useCallback((action: ActionItem, clientName: string) => {
    setSelectedAction(action)
    setSelectedClientName(clientName)
  }, [])

  const fetchActions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/actions?status=to_do')
      if (!response.ok) throw new Error('Failed to fetch actions')
      const data = await response.json()
      setGroups(data.groups || [])
      setMyActions(data.my_actions || [])
      setTotalActions(data.total_actions || 0)
      setLastSynced(data.last_synced || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchActions()
  }, [fetchActions])

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups
    const q = searchQuery.toLowerCase()
    return groups.filter(g =>
      g.client_name.toLowerCase().includes(q) ||
      g.company_name.toLowerCase().includes(q)
    )
  }, [groups, searchQuery])

  async function handleSync() {
    setSyncing(true)
    setSyncMessage(null)
    setError(null)
    try {
      const supabase = createClientComponentClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const res = await fetch('/api/sync-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: session.user.id })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Sync failed')

      setSyncMessage(`Synced ${data.stats?.upserted || 0} actions`)
      await fetchActions()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const viewTabs: { value: ViewTab; label: string }[] = [
    { value: 'by_client', label: 'By Client' },
    { value: 'due_this_week', label: 'Due This Week' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
            {viewTabs.map(tab => (
              <button
                key={tab.value}
                onClick={() => setViewTab(tab.value)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  viewTab === tab.value
                    ? 'bg-background text-foreground shadow-sm font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {viewTab === 'by_client' && (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Filter clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 w-[200px] text-sm"
              />
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {lastSynced && (
            <span className="text-xs text-muted-foreground">
              Synced {formatTimeAgo(lastSynced)}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={syncing}
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {syncing ? 'Syncing...' : 'Sync Actions'}
          </Button>
        </div>
      </div>

      {syncMessage && (
        <p className="text-sm text-success">{syncMessage}</p>
      )}

      {error && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-danger">
              <AlertCircle className="h-4 w-4" />
              <p className="text-sm">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-3 text-muted-foreground">Loading actions...</span>
        </div>
      ) : viewTab === 'due_this_week' ? (
        <DueThisWeekView groups={groups} onSelectAction={handleSelectAction} />
      ) : filteredGroups.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">
              {searchQuery
                ? 'No clients match your search'
                : 'No actions yet. Hit "Sync Actions" to pull from Defacto and Granola.'
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {totalActions} {totalActions === 1 ? 'action' : 'actions'} across {groups.length} {groups.length === 1 ? 'client' : 'clients'}
            {myActions.length > 0 && ` · ${myActions.length} for me`}
          </p>
          <div className="space-y-3">
            {myActions.length > 0 && (
              <MyActionsGroup actions={myActions} onSelectAction={handleSelectAction} />
            )}
            {filteredGroups.map((group) => (
              <ClientGroup key={group.client_id || group.company_name} group={group} onSelectAction={handleSelectAction} />
            ))}
          </div>
        </>
      )}

      {selectedAction && (
        <ActionDetailPanel
          key={selectedAction.id}
          action={selectedAction}
          clientName={selectedClientName}
          onClose={() => setSelectedAction(null)}
          onUpdated={(updated) => {
            setSelectedAction(updated)
            fetchActions()
          }}
          onDeleted={(id) => {
            setSelectedAction(null)
            fetchActions()
          }}
        />
      )}
    </div>
  )
}
