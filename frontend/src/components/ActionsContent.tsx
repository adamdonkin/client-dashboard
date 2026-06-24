'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChevronDown, ChevronRight, Loader2, Calendar, AlertCircle, RefreshCw, Search } from 'lucide-react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { ClientActionGroup, ClientAction } from '@/app/api/actions/route'
import { formatRelativeDate } from '@/utils/date-utils'
import { format, isPast, parseISO, isThisWeek } from 'date-fns'

function formatDueDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return format(parseISO(dateStr), 'MMM d')
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false
  return isPast(parseISO(dateStr))
}

function SourceBadge({ source }: { source: 'defacto' | 'granola' }) {
  if (source === 'defacto') {
    return (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-chart-3/30 text-chart-3 font-medium">
        Defacto
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-success/30 text-success font-medium">
      Granola
    </Badge>
  )
}


function ActionRow({ action }: { action: ClientAction }) {
  const overdue = isOverdue(action.due_date)
  const clickable = !!action.source_url

  function handleClick() {
    if (action.source_url) {
      window.open(action.source_url, '_blank', 'noopener')
    }
  }

  return (
    <div
      className={`py-2.5 px-4 hover:bg-muted/50 rounded-md transition-colors ${clickable ? 'cursor-pointer' : ''}`}
      onClick={handleClick}
    >
      <div className="flex items-center gap-3">
        <div className="shrink-0 w-[52px]">
          <SourceBadge source={action.source} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground leading-snug">{action.title}</p>
          {action.description && (
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{action.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {action.due_date && (
            <span className={`text-xs flex items-center gap-1 ${overdue ? 'text-danger' : 'text-muted-foreground'}`}>
              <Calendar className="h-3 w-3" />
              {formatDueDate(action.due_date)}
            </span>
          )}
          {!action.due_date && (
            <span className="text-xs text-muted-foreground w-[60px] text-right">—</span>
          )}
        </div>
      </div>
    </div>
  )
}

function ClientGroup({ group }: { group: ClientActionGroup }) {
  const [expanded, setExpanded] = useState(group.actions.length > 0)
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
            <div className="divide-y divide-border">
              {group.actions.map((action) => (
                <ActionRow key={action.id} action={action} />
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}

function DueThisWeekView({ groups }: { groups: ClientActionGroup[] }) {
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
          <div className="divide-y divide-border">
            {dueThisWeek.map((action) => {
              const overdue = isOverdue(action.due_date)
              const clickable = !!action.source_url

              return (
                <div
                  key={action.id}
                  className={`py-2.5 px-4 hover:bg-muted/50 rounded-md transition-colors ${clickable ? 'cursor-pointer' : ''}`}
                  onClick={() => clickable && window.open(action.source_url!, '_blank', 'noopener')}
                >
                  <div className="flex items-center gap-3">
                    <div className="shrink-0 w-[52px]">
                      <SourceBadge source={action.source} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground leading-snug">{action.title}</p>
                      {action.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{action.description}</p>
                      )}
                    </div>
                    <span
                      className="text-xs text-primary hover:underline cursor-pointer shrink-0 w-[120px]"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (action.client_id) router.push(`/clients/${action.client_id}`)
                      }}
                    >
                      {action.client_name}
                    </span>
                    <span className={`text-xs flex items-center gap-1 shrink-0 w-[60px] ${overdue ? 'text-danger' : 'text-muted-foreground'}`}>
                      <Calendar className="h-3 w-3" />
                      {formatDueDate(action.due_date)}
                    </span>
                  </div>
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

type ViewTab = 'by_client' | 'due_this_week'

export function ActionsContent() {
  const [groups, setGroups] = useState<ClientActionGroup[]>([])
  const [totalActions, setTotalActions] = useState(0)
  const [lastSynced, setLastSynced] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [viewTab, setViewTab] = useState<ViewTab>('by_client')
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  const fetchActions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/actions?status=to_do')
      if (!response.ok) throw new Error('Failed to fetch actions')
      const data = await response.json()
      setGroups(data.groups || [])
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

      setSyncMessage(`Synced ${data.stats?.defacto || 0} from Defacto, ${data.stats?.granola || 0} from Granola`)
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
        <DueThisWeekView groups={groups} />
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
          </p>
          <div className="space-y-3">
            {filteredGroups.map((group) => (
              <ClientGroup key={group.client_id || group.company_name} group={group} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
