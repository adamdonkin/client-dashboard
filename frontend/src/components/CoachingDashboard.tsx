"use client";

import { useState } from "react";
import { Client } from "@/types";
import { ClientListView } from "./ClientListView";
import { ClientDetail } from "./ClientDetail";
import { useAuth } from '@/components/auth/AuthProvider'
import { Users, RefreshCw, Calendar, Mail, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// Define the shape of the data this component will receive
interface CoachingDashboardProps {
  needsScheduling: Client[];
  thisWeek: Client[];
  future: Client[];
  totalClients: number;
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
function ManualSyncButton() {
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{
    message: string
    timestamp: string
    success: boolean
  } | null>(null)

  const handleSync = async () => {
    setIsSyncing(true)
    setSyncResult(null) // Clear previous result
    
    try {
      const response = await fetch('/api/sync-calendar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          user_id: '4587519f-dd12-4e18-be42-25854f6dfbe3' 
        })
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      
      const result: SyncResponse = await response.json()
      
      const timestamp = new Date().toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
      
      if (result.success) {
        setSyncResult({
          message: `${result.stats?.synced || 0} events synced, ${result.stats?.deleted || 0} deleted`,
          timestamp,
          success: true
        })
        
        // Refresh the page after a short delay to show the success message
        setTimeout(() => {
          window.location.reload()
        }, 1500)
      } else {
        setSyncResult({
          message: `Sync failed: ${result.message}`,
          timestamp,
          success: false
        })
      }
    } catch (error) {
      console.error('Sync error:', error)
      const timestamp = new Date().toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
      setSyncResult({
        message: `Sync failed: ${error}`,
        timestamp,
        success: false
      })
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className="flex flex-col items-end">
      <Button 
        onClick={handleSync} 
        disabled={isSyncing}
        variant="outline"
        size="sm"
      >
        <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
        {isSyncing ? 'Syncing...' : 'Sync Calendar'}
      </Button>
      
      {/* Persistent feedback below button */}
      {syncResult && (
        <div className="mt-1 text-xs text-right">
          <div className={syncResult.success ? 'text-green-600' : 'text-red-600'}>
            {syncResult.success ? '✅' : '❌'} {syncResult.message}
          </div>
          <div className="text-gray-400">
            {syncResult.timestamp}
          </div>
        </div>
      )}
      
      {/* Show syncing state below button */}
      {isSyncing && (
        <div className="mt-1 text-xs text-gray-500 text-right">
          Fetching calendar data...
        </div>
      )}
    </div>
  )
}

export function CoachingDashboard({ needsScheduling, thisWeek, future, totalClients }: CoachingDashboardProps) {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const { user, signOut } = useAuth();

  const handleClientSelect = (client: Client) => {
    setSelectedClient(client);
  };

  const handleBackToDashboard = () => {
    setSelectedClient(null);
  };

  const getUserInitials = (email: string) => {
    return email.split('@')[0].split('.').map(n => n[0]).join('').toUpperCase()
  }

  // Show client detail view if a client is selected
  if (selectedClient) {
    return (
      <ClientDetail 
        client={selectedClient} 
        onBack={handleBackToDashboard}
        onClientUpdate={(updated) => {
          setSelectedClient(updated);
          // Optionally refresh the main data
        }}
      />
    );
  }

  return (
    <div className="p-6">
      {/* Updated Header with clickable avatar */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Coaching Dashboard</h1>
          <p className="text-gray-600">Manage your client sessions and schedules</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Users className="h-4 w-4" />
            {totalClients} Total Clients
          </div>
          <div className="flex items-center gap-2">
            <ManualSyncButton />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full p-0">
                  <Avatar className="h-8 w-8">
                    <AvatarImage 
                      src={user?.user_metadata?.avatar_url || user?.user_metadata?.picture} 
                      alt={user?.user_metadata?.full_name || user?.email || 'User avatar'} 
                    />
                    <AvatarFallback className="bg-gray-900 text-white text-sm">
                      {user?.email ? getUserInitials(user.email) : 'JD'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <div className="flex flex-col space-y-1 p-2">
                  <p className="text-sm font-medium leading-none">
                    {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'John Doe'}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email || 'john.doe@coaching.com'}
                  </p>
                </div>
                <DropdownMenuItem onClick={signOut} className="cursor-pointer">
                  Sign out of Google
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Use the provided ClientListView component for each section */}
      <div className="space-y-8">
        <ClientListView
          clients={needsScheduling}
          title="Needs Scheduling"
          badgeColor="bg-red-100 text-red-800"
          onClientSelect={handleClientSelect}
        />
        
        <ClientListView
          clients={thisWeek}
          title="Coming up this week"
          badgeColor="bg-blue-100 text-blue-800"
          onClientSelect={handleClientSelect}
        />
        
        <ClientListView
          clients={future}
          title="Upcoming"
          badgeColor="bg-green-100 text-green-800"
          onClientSelect={handleClientSelect}
        />
      </div>
    </div>
  )
}