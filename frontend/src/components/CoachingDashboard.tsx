"use client";

import { useState } from "react";
import { Client } from "@/types";
import { ClientListView } from "./ClientListView";
import { ClientDetail } from "./ClientDetail";
import { Users } from "lucide-react";

// Define the shape of the data this component will receive
interface CoachingDashboardProps {
  needsScheduling: Client[];
  thisWeek: Client[];
  future: Client[];
  totalClients: number;
}

export function CoachingDashboard({ needsScheduling, thisWeek, future, totalClients }: CoachingDashboardProps) {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

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
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Coaching Dashboard</h1>
            <p className="text-muted-foreground">
              Manage your client sessions and schedules
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <span>{totalClients} Total Clients</span>
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