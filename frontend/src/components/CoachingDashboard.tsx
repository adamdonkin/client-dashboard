"use client";

import { useState } from "react";
import { Client } from "@/types";
import { ClientListView } from "./ClientListView";
import ClientDetail from "./ClientDetail";
import { StatsSection } from "./StatsSection";
import { useAuth } from '@/components/auth/AuthProvider'
import { Users, RefreshCw, Calendar, Mail, MessageSquare, Loader2 } from 'lucide-react'
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
  statsData: {
    sessionsThisWeek: number;
    avgSessionsPerWeek: number;
    avgSessionsPerMonth: number;
    rescheduleRate: number;
  };
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
function ManualSyncButton({ user }: { user: any }) {
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{
    message: string
    timestamp: string
    success: boolean
  } | null>(null)

  const handleSync = async () => {
    if (!user?.id) {
      setSyncResult({
        message: 'No authenticated user found',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        success: false
      });
      return;
    }

    setIsSyncing(true)
    setSyncResult(null) // Clear previous result
    
    try {
      const response = await fetch('/api/sync-calendar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: user.id }),
      })

      const data = await response.json()
      
      setSyncResult({
        message: data.message || 'Sync completed',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        success: response.ok
      })
    } catch (error) {
      setSyncResult({
        message: `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        success: false
      })
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button 
        onClick={handleSync} 
        disabled={isSyncing || !user?.id}
        className="w-full"
      >
        {isSyncing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Syncing...
          </>
        ) : (
          <>
            <RefreshCw className="mr-2 h-4 w-4" />
            Sync Calendar
          </>
        )}
      </Button>
      
      {syncResult && (
        <div className={`text-sm p-2 rounded ${
          syncResult.success 
            ? 'bg-green-50 text-green-700 border border-green-200' 
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          <div className="font-medium">{syncResult.message}</div>
          <div className="text-xs opacity-75">{syncResult.timestamp}</div>
        </div>
      )}
    </div>
  )
}

export function CoachingDashboard({ needsScheduling, thisWeek, future, totalClients, statsData }: CoachingDashboardProps) {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const { user, signOut } = useAuth();

  const handleClientSelect = (client: Client) => {
    console.log("=== DASHBOARD CLIENT SELECTION ===");
    console.log("Selected client:", client);
    console.log("Selected client name:", client?.client_name);
    console.log("Selected client keys:", client ? Object.keys(client) : "no client");
    console.log("=== END SELECTION DEBUG ===");
    
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
            <ManualSyncButton user={user} />
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

      {/* Stats Section */}
      <div className="mb-8">
        <StatsSection statsData={statsData} />
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