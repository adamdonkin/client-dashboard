"use client";

import { useState } from "react";
import { Client } from "@/types";
import { ClientListView } from "./ClientListView";
import { ClientDetail } from "./ClientDetail";
import { Users, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from '@/components/auth/AuthProvider'

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

  // Show client detail view if a client is selected
  if (selectedClient) {
    return <ClientDetail client={selectedClient} onBack={handleBackToDashboard} />;
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header with title, sync button, and sign out */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Coaching Dashboard</h1>
            <p className="text-gray-600">Manage your client sessions and schedules</p>
          </div>
          <div className="flex items-start gap-6">
            <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
              <Users className="h-5 w-5" />
              {totalClients} Total Clients
            </div>
            <div className="flex flex-col items-end gap-2">
              <ManualSyncButton />
              <button
                onClick={signOut}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Sign out ({user?.email})
              </button>
            </div>
          </div>
        </div>

        {/* Client Lists */}
        <div className="space-y-6">
          <ClientListView 
            title="Needs Scheduling" 
            clients={needsScheduling}
            badgeColor="bg-red-100 text-red-800"
            onClientSelect={handleClientSelect}
          />
         
          <ClientListView 
            title="Coming up this week" 
            clients={thisWeek}
            badgeColor="bg-blue-100 text-blue-800"
            onClientSelect={handleClientSelect}
          />
         
          <ClientListView 
            title="Future"
            clients={future}
            badgeColor="bg-green-100 text-green-800"
            onClientSelect={handleClientSelect}
          />
        </div>
      </div>
    </div>
  );
}