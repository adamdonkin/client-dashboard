"use client";

import { useState, useEffect } from "react";
import { Client } from "@/types";
import { ClientListView } from "./ClientListView";
import ClientDetail from "./ClientDetail";
import { StatsSection } from "./StatsSection";
import { useAuth } from '@/components/auth/AuthProvider'
import { Users, RefreshCw, Calendar, Mail, MessageSquare, Loader2, Globe } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { useRouter } from "next/navigation";

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
  const router = useRouter()
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

      // Refresh the page data after successful sync
      if (response.ok) {
        router.refresh()
      }
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

export default function CoachingDashboard({ needsScheduling, thisWeek, future, totalClients, statsData }: CoachingDashboardProps) {
  const { user, signOut } = useAuth()
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const router = useRouter();

  // Add browser history management
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const urlParams = new URLSearchParams(window.location.search);
      const clientId = urlParams.get('client');
      
      if (clientId && selectedClient?.id !== clientId) {
        // Find the client by ID from your existing data
        const allClients = [...needsScheduling, ...thisWeek, ...future];
        const client = allClients.find(c => c.id === clientId);
        if (client) {
          setSelectedClient(client);
        }
      } else if (!clientId && selectedClient) {
        setSelectedClient(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    
    // Check URL on component mount for direct links
    const urlParams = new URLSearchParams(window.location.search);
    const clientId = urlParams.get('client');
    if (clientId && !selectedClient) {
      const allClients = [...needsScheduling, ...thisWeek, ...future];
      const client = allClients.find(c => c.id === clientId);
      if (client) {
        setSelectedClient(client);
      }
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [selectedClient, needsScheduling, thisWeek, future]);

  const handleClientSelect = (client: Client) => {
    console.log("=== DASHBOARD CLIENT SELECTION ===");
    console.log("Selected client:", client);
    console.log("Selected client name:", client?.client_name);
    console.log("Selected client keys:", client ? Object.keys(client) : "no client");
    console.log("=== END SELECTION DEBUG ===");
    
    // Add to browser history so back button works
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('client', client.id);
    window.history.pushState({ clientId: client.id }, '', currentUrl.toString());
    
    setSelectedClient(client);
  };

  const handleBackToDashboard = () => {
    // Remove client from URL and go back in history
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.delete('client');
    window.history.pushState({}, '', currentUrl.toString());
    
    setSelectedClient(null);
  };

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
    <div>
      {/* Updated Header with clickable avatar - Full Width */}
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Coaching Dashboard</h1>
            </div>
            <div className="flex items-center gap-6">
              <Link 
                href="/clients" 
                className={`flex items-center gap-2 text-sm font-medium hover:opacity-80 transition-opacity ${
                  totalClients >= 22 ? 'text-danger' : 
                  totalClients >= 20 ? 'text-warning' : 
                  'text-success'
                }`}
              >
                <Users className="h-4 w-4" />
                {totalClients} Clients
              </Link>
              <Link 
                href="/timezones" 
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Globe className="h-4 w-4" />
                Timezones
              </Link>
              <div className="flex items-center gap-2">
                <ManualSyncButton user={user} />
                <ThemeToggle />
                <Button variant="ghost" size="sm" onClick={signOut}>
                  Sign out
                </Button>
              </div>
            </div>
          </div>
      </div>

      {/* Content Area - Constrained Width */}
      <div className="p-6 max-w-[900px] mx-auto">
        {/* Stats Section */}
        <div className="mb-16">
          <StatsSection statsData={statsData} />
        </div>

      {/* Use the provided ClientListView component for each section */}
      <div className="space-y-8">
        {needsScheduling.length > 0 && (
          <ClientListView
            clients={needsScheduling}
            title="Needs Scheduling"
            badgeColor="bg-danger/10 text-danger"
            onClientSelect={handleClientSelect}
          />
        )}
        
        {thisWeek.length > 0 && (
          <ClientListView
            clients={thisWeek}
            title="Coming up this week"
            badgeColor="bg-warning/10 text-warning"
            onClientSelect={handleClientSelect}
          />
        )}
        
        {future.length > 0 && (
          <ClientListView
            clients={future}
            title="Upcoming"
            badgeColor="bg-success/10 text-success"
            onClientSelect={handleClientSelect}
          />
        )}
      </div>
      </div>
    </div>
  )
}