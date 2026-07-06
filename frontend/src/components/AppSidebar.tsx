'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { PanelLeft, LayoutDashboard, Users, Zap, Globe, X } from 'lucide-react'
import { useAuth } from '@/components/auth/AuthProvider'
import { format, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'

interface UpcomingSession {
  id: string
  title: string
  start_time: string
  client_name: string
  client_id: string
}

interface RecentSession {
  id: string
  start_time: string
  client_name: string
}

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/actions', label: 'Actions', icon: Zap },
  { href: '/timezones', label: 'Timezones', icon: Globe },
]

function isOverlayRoute(pathname: string) {
  return pathname.startsWith('/sessions/') || pathname.startsWith('/auth/')
}

export function AppSidebar({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClientComponentClient()

  const isPersistent = !isOverlayRoute(pathname)
  const [overlayOpen, setOverlayOpen] = useState(false)
  const [upcoming, setUpcoming] = useState<UpcomingSession[]>([])
  const [recent, setRecent] = useState<RecentSession[]>([])

  const sidebarVisible = isPersistent || overlayOpen

  const fetchSidebarData = useCallback(async () => {
    if (!user) return

    const now = new Date().toISOString()
    const [upcomingRes, recentRes] = await Promise.all([
      supabase
        .from('calendar_events')
        .select('id, title, start_time, client_id, clients(id, name)')
        .gt('start_time', now)
        .order('start_time', { ascending: true })
        .limit(5),
      supabase
        .from('calendar_events')
        .select('id, title, start_time, client_id, clients(id, name)')
        .lt('start_time', now)
        .order('start_time', { ascending: false })
        .limit(5),
    ])

    if (upcomingRes.data) {
      setUpcoming(
        upcomingRes.data.map((e: any) => ({
          id: e.id,
          title: e.title,
          start_time: e.start_time,
          client_name: e.clients?.name || e.title,
          client_id: e.client_id,
        }))
      )
    }

    if (recentRes.data) {
      setRecent(
        recentRes.data.map((e: any) => ({
          id: e.id,
          start_time: e.start_time,
          client_name: e.clients?.name || e.title,
        }))
      )
    }
  }, [user, supabase])

  useEffect(() => {
    fetchSidebarData()
  }, [fetchSidebarData])

  useEffect(() => {
    setOverlayOpen(false)
  }, [pathname])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && overlayOpen) {
        setOverlayOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [overlayOpen])

  if (!user) return <>{children}</>

  const navigate = (href: string) => {
    router.push(href)
    if (!isPersistent) setOverlayOpen(false)
  }

  const formatRecentDate = (startTime: string) => {
    try {
      const date = parseISO(startTime)
      const now = new Date()
      const isToday = date.toDateString() === now.toDateString()
      const yesterday = new Date(now)
      yesterday.setDate(yesterday.getDate() - 1)
      const isYesterday = date.toDateString() === yesterday.toDateString()

      if (isToday) return 'Today'
      if (isYesterday) return 'Yesterday'
      return format(date, 'MMM d')
    } catch {
      return ''
    }
  }

  const formatSessionTime = (startTime: string) => {
    try {
      const date = parseISO(startTime)
      const now = new Date()
      const isToday = date.toDateString() === now.toDateString()
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const isTomorrow = date.toDateString() === tomorrow.toDateString()

      const time = format(date, 'h:mma').toLowerCase()
      if (isToday) return `Today ${time}`
      if (isTomorrow) return `Tomorrow ${time}`
      return format(date, 'EEE') + ' ' + time
    } catch {
      return ''
    }
  }

  return (
    <>
      {/* Toggle button — only visible on overlay pages */}
      {!isPersistent && (
        <button
          onClick={() => { setOverlayOpen(true); fetchSidebarData() }}
          className="fixed top-3 left-3 z-40 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title="Open navigation"
        >
          <PanelLeft className="h-4.5 w-4.5" />
        </button>
      )}

      {/* Backdrop — only on overlay mode */}
      {!isPersistent && overlayOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/20 dark:bg-black/40 transition-opacity"
          onClick={() => setOverlayOpen(false)}
        />
      )}

      {/* Sidebar panel */}
      <div
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-60 bg-background border-r border-border transition-transform duration-200 ease-out overflow-y-auto',
          sidebarVisible ? 'translate-x-0' : '-translate-x-full',
          !isPersistent && 'shadow-lg'
        )}
      >
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <button
            onClick={() => navigate('/')}
            className="text-[15px] font-semibold text-foreground hover:text-foreground/80 transition-colors"
          >
            Coaching
          </button>
          {!isPersistent && (
            <button
              onClick={() => setOverlayOpen(false)}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <nav className="px-2 mt-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
            return (
              <button
                key={item.href}
                onClick={() => navigate(item.href)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] transition-colors',
                  isActive
                    ? 'bg-accent text-accent-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            )
          })}
        </nav>

        {upcoming.length > 0 && (
          <div className="mt-5 px-2">
            <p className="px-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-widest mb-1.5">
              Upcoming
            </p>
            {upcoming.map((session) => (
              <button
                key={session.id}
                onClick={() => navigate(`/sessions/${session.id}`)}
                className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-[13px] text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
              >
                <span className="truncate">{session.client_name}</span>
                <span className="text-[11px] text-muted-foreground/70 shrink-0">
                  {formatSessionTime(session.start_time)}
                </span>
              </button>
            ))}
          </div>
        )}

        {recent.length > 0 && (
          <div className="mt-5 px-2">
            <p className="px-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-widest mb-1.5">
              Recent
            </p>
            {recent.map((session) => (
              <button
                key={session.id}
                onClick={() => navigate(`/sessions/${session.id}`)}
                className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-[13px] text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
              >
                <span className="truncate">{session.client_name}</span>
                <span className="text-[11px] text-muted-foreground/70 shrink-0">
                  {formatRecentDate(session.start_time)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Page content — shifts right when sidebar is persistent */}
      <div className={cn(
        'transition-[margin-left] duration-200',
        isPersistent && 'ml-60'
      )}>
        {children}
      </div>
    </>
  )
}
