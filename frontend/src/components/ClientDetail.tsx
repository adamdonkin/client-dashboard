'use client'

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, 
  Calendar, 
  Mail, 
  MessageSquare, 
  Phone, 
  Edit, 
  Plus,
  Clock,
  CheckCircle,
  XCircle
} from "lucide-react";
import { Client } from "@/components/types";
import { ClientEditDialog } from "@/components/ClientEditDialog";
import { formatLastSessionDate } from "@/components/utils/date-utils";

interface Session {
  id: string;
  date: Date;
  type: string;
  duration: number;
  status: 'completed' | 'cancelled' | 'no-show';
  notes?: string;
}

interface ClientDetailProps {
  client: Client;
  onBack: () => void;
  onClientUpdate?: (updatedClient: Client) => void;
}

export function ClientDetail({ client, onBack, onClientUpdate }: ClientDetailProps) {
  const [currentClient, setCurrentClient] = useState(client);
  const [notes, setNotes] = useState("Client is making good progress on career transition goals. Discussed new networking strategies and identified potential opportunities in tech sector.");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric',
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleClientUpdate = (updatedClient: Client) => {
    setCurrentClient(updatedClient);
    onClientUpdate?.(updatedClient);
  };

  // Mock session history
  const sessionHistory: Session[] = [
    {
      id: '1',
      date: new Date('2025-06-11'),
      type: 'Regular Session',
      duration: 60,
      status: 'completed',
      notes: 'Discussed career goals and next steps. Client feeling more confident about upcoming interviews.'
    },
    {
      id: '2', 
      date: new Date('2025-06-09'),
      type: 'Goal Setting',
      duration: 90,
      status: 'completed',
      notes: 'Set quarterly objectives and created action plan for professional development.'
    },
    {
      id: '3',
      date: new Date('2025-06-02'),
      type: 'Regular Session', 
      duration: 60,
      status: 'completed',
      notes: 'Worked on communication skills and presentation techniques.'
    },
    {
      id: '4',
      date: new Date('2025-05-26'),
      type: 'Check-in',
      duration: 30,
      status: 'cancelled',
      notes: 'Client had to reschedule due to work conflict.'
    }
  ];

  const getSessionIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'cancelled': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'no-show': return <Clock className="h-4 w-4 text-yellow-600" />;
      default: return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header with back button */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>

        {/* Client Overview */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="bg-gray-900 text-white text-xl">
                    {getInitials(currentClient.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <h1 className="text-2xl font-semibold">{currentClient.name}</h1>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(currentClient.status || 'active')}>
                      {(currentClient.status || 'active').charAt(0).toUpperCase() + (currentClient.status || 'active').slice(1)}
                    </Badge>
                  </div>
                </div>
              </div>
              <Button 
                variant="outline" 
                className="flex items-center gap-2"
                onClick={() => setIsEditDialogOpen(true)}
              >
                <Edit className="h-4 w-4" />
                Edit Client
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Contact Information with linked actions */}
            <div>
              <h3 className="font-medium mb-3">Contact Information</h3>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <a 
                      href={`mailto:${currentClient.email}`}
                      className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {currentClient.email}
                    </a>
                  </div>
                </div>
                {currentClient.slack && (
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Slack</p>
                      <a 
                        href={currentClient.slack}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        @{currentClient.name.split(' ')[0].toLowerCase()}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Session Schedule */}
            <div>
              <h3 className="font-medium mb-3">Session Schedule</h3>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Next Session</p>
                    <p className="font-medium">
                      {currentClient.nextSession ? formatDate(currentClient.nextSession) : 'Not scheduled'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Last Session</p>
                    <p className="font-medium">
                      {currentClient.lastSession 
                        ? (typeof currentClient.lastSession === 'string' 
                           ? formatLastSessionDate(currentClient.lastSession)
                           : formatLastSessionDate(currentClient.lastSession.toISOString()))
                        : 'None'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notes Section */}
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this client..."
              className="min-h-[120px]"
            />
            <div className="flex justify-end mt-3">
              <Button variant="outline">Save Notes</Button>
            </div>
          </CardContent>
        </Card>

        {/* Session History */}
        <Card>
          <CardHeader>
            <CardTitle>Session History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {sessionHistory.map((session, index) => (
                <div key={session.id}>
                  <div className="flex items-start gap-4">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted">
                      {getSessionIcon(session.status)}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{session.type}</p>
                          <Badge variant="outline" className="text-xs">
                            {session.duration} min
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatLastSessionDate(session.date.toISOString())}
                        </p>
                      </div>
                    </div>
                  </div>
                  {index < sessionHistory.length - 1 && (
                    <Separator className="my-4" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Edit Client Dialog */}
        <ClientEditDialog
          client={currentClient}
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onClientUpdate={handleClientUpdate}
        />
      </div>
    </div>
  );
}