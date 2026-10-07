"use client";

import { useState } from "react";
import { Client } from "@/types";
import { ClientListView } from "./ClientListView";
import { StatsSection } from "./StatsSection";
import { useAuth } from '@/components/auth/AuthProvider'
import { RevenueFilterType } from './RevenueFilter'
import { RefreshCw, Calendar, Mail, MessageSquare, Loader2 } from 'lucide-react'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { useRouter } from "next/navigation";
import { toast } from 'sonner'

// Define the shape of the data this component will receive
interface CoachingDashboardProps {
  needsScheduling: Client[];
  thisWeek: Client[];
  future: Client[];
  totalClients: number;
  statsData: {
    sessionsThisWeek: number;
    avgSessionsPerWeek: number;
    avgSessionsPerMonth: number;
    rescheduleRate: number;
    avgEngagementLength: number;
    totalSessionsThisYear: number;
    revenueStats: any;
    revenueStatsMochary?: any;
  };
  lastSyncedAt?: string | null;
}

// Locale and time zone are pinned so the server and client render an identical string
// (a relative "2 hours ago" would hydrate inconsistently) and so the time always reads
// as Pacific regardless of where the dashboard is opened from.
// Date and time are formatted separately because engines disagree on the joiner
// ("Oct 7, 2:09 PM" vs "Oct 7 at 2:09 PM") and on the space before AM/PM, which
// breaks hydration.
function formatSyncTime(iso: string) {
  const d = new Date(iso)
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles' })
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' })
  return `${date}, ${time}`.replace(/\s/g, ' ')
}

// Add this interface for the sync response
interface SyncResponse {
  success: boolean
  message: string
  stats?: {
    totalFetched: number
    synced: number
    deleted: number
    errors: number
  }
}

// Add this sync function component
function ManualSyncButton({ user, lastSyncedAt }: { user: any; lastSyncedAt?: string | null }) {
  const router = useRouter()
  const [isSyncing, setIsSyncing] = useState(false)

  const handleSync = async () => {
    if (!user?.id) {
      toast.error('No authenticated user found')
      return
    }

    setIsSyncing(true)
    try {
      const response = await fetch('/api/sync-calendar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: user.id }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(data.message || 'Calendar synced')
        router.refresh()
      } else {
        toast.error(data.message || 'Sync failed')
      }
    } catch (error) {
      toast.error(`Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-muted-foreground whitespace-nowrap max-sm:hidden">
        {lastSyncedAt ? `Synced ${formatSyncTime(lastSyncedAt)}` : 'Never synced'}
      </span>
      <button
        onClick={handleSync}
        disabled={isSyncing || !user?.id}
        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50"
        title="Sync calendar now"
      >
        {isSyncing
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : <RefreshCw className="h-3.5 w-3.5" />}
      </button>
    </div>
  )
}

export default function CoachingDashboard({ needsScheduling, thisWeek, future, totalClients, statsData, lastSyncedAt }: CoachingDashboardProps) {
  const { user, signOut } = useAuth()

  return (
    <div>
      {/* Updated Header with clickable avatar - Full Width */}
      <div className="px-4 sm:px-6 mb-2">
        <div className="h-12 flex items-center justify-end">
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="flex items-center gap-2">
                <ManualSyncButton user={user} lastSyncedAt={lastSyncedAt} />
                <ThemeToggle />
              </div>
            </div>
          </div>
      </div>

      {/* Content Area - Constrained Width */}
      <div className="px-4 sm:px-6 pb-6 max-w-[900px] mx-auto">
        {/* Stats Section */}
        <div className="mb-10 sm:mb-16">
          <StatsSection 
            statsData={statsData} 
          />
        </div>

      {/* Use the provided ClientListView component for each section */}
      <div className="space-y-8">
        {needsScheduling.length > 0 && (
          <ClientListView
            clients={needsScheduling}
            title="Needs Scheduling"
            badgeColor="bg-danger/10 text-danger"
          />
        )}
        
        {thisWeek.length > 0 && (
          <ClientListView
            clients={thisWeek}
            title="Coming up this week"
            badgeColor="bg-warning/10 text-warning"
          />
        )}
        
        {future.length > 0 && (
          <ClientListView
            clients={future}
            title="Upcoming"
            badgeColor="bg-success/10 text-success"
          />
        )}
      </div>
      </div>
    </div>
  )
}