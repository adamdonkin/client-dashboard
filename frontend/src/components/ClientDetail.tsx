'use client'

import { useState, useEffect } from "react";
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
  XCircle,
  FileText,
  ExternalLink,
  User
} from "lucide-react";
import { Client } from "@/components/types";
import { ClientEditDialog } from "@/components/ClientEditDialog";
import { formatLastSessionDate } from "@/components/utils/date-utils";
import { supabase } from "@/lib/supabaseClient";

interface Session {
  session_id: string;
  session_date: string;
  session_notes: string;
  session_status: string;
  session_type: string;
  session_duration?: number;
  calendar_title?: string;
}

interface ClientDetailProps {
  client: Client;
  onBack: () => void;
  onClientUpdate?: (updatedClient: Client) => void;
}

// Add getInitials helper
const getInitials = (name: string | undefined | null): string => {
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return '??';
  }
  return name
    .trim()
    .split(' ')
    .filter(part => part.length > 0)
    .map(part => part[0]?.toUpperCase() || '')
    .slice(0, 2)
    .join('');
};

const ClientDetail = ({ client, onBack, onClientUpdate }: ClientDetailProps) => {
  const [currentClient, setCurrentClient] = useState<Client | null>(client);
  const [notes, setNotes] = useState("Client is making good progress on career transition goals. Discussed new networking strategies and identified potential opportunities in tech sector.");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [sessionHistory, setSessionHistory] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const formatDateWithTime = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('en-US', { 
      year: 'numeric',
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleClientUpdate = (updatedClient: Client) => {
    setCurrentClient(updatedClient);
    onClientUpdate?.(updatedClient);
  };

  // Fetch real session history from database
  useEffect(() => {
    const fetchSessionHistory = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Call the get_sessions_by_client_id function
        const { data, error } = await supabase
          .rpc('get_sessions_by_client_id', { p_client_id: client.id });

        if (error) {
          console.error("Error fetching session history:", error);
          setError('Failed to load session history');
          setSessionHistory([]);
        } else {
          // Sort sessions by date, most recent first (reverse chronological)
          const sortedSessions = (data || []).sort((a: Session, b: Session) => {
            return new Date(b.session_date).getTime() - new Date(a.session_date).getTime();
          });
          setSessionHistory(sortedSessions);
        }
      } catch (error) {
        console.error("Error fetching session history:", error);
        setError('Failed to load session history');
        setSessionHistory([]);
      } finally {
        setLoading(false);
      }
    };

    if (client.id) {
        fetchSessionHistory();
    }
  }, [client.id]);

  // Fetch additional client details that may not have been passed in the initial client prop.
  useEffect(() => {
    const fetchClientDetails = async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('ea_name, ea_email, defacto_meeting, role, is_active, location')
        .eq('id', client.id)
        .single();
      
      if (error) {
        console.error('Error fetching additional client details:', error);
        return;
      }

      if (data) {
        const clientData = { ...data, status: data.is_active ? 'active' : 'inactive' };
        setCurrentClient(prev => prev ? ({ ...prev, ...clientData }) : clientData as Client);
      }
    };
    
    if (client.id) {
      fetchClientDetails();
    }
  }, [client.id]);

  const getSessionIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'cancelled': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'no-show': return <Clock className="h-4 w-4 text-yellow-600" />;
      default: return <CheckCircle className="h-4 w-4 text-green-600" />; // Default to completed
    }
  };

  const getSessionTitle = (session: Session) => {
    // Use calendar title if available and not empty, otherwise fall back to session type
    if (session.calendar_title && session.calendar_title.trim() !== '' && session.calendar_title !== 'Coaching Session') {
      return session.calendar_title;
    }
    return session.session_type || 'Coaching Session';
  };

  const formatSessionDuration = (duration?: number) => {
    if (!duration) return '60 min'; // Default to 60 minutes
    return `${duration} min`;
  };

  // Loading state
  if (loading && !currentClient) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <Button variant="ghost" onClick={onBack} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
          <div className="animate-pulse">
            <div className="flex items-center space-x-4 mb-6">
              <div className="w-16 h-16 bg-gray-200 rounded-full"></div>
              <div className="space-y-2">
                <div className="h-6 bg-gray-200 rounded w-32"></div>
                <div className="h-4 bg-gray-200 rounded w-24"></div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="h-32 bg-gray-200 rounded"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !currentClient) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <Button variant="ghost" onClick={onBack} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">
                  {error || 'Client not found'}
                </h2>
                <p className="text-gray-600 mb-4">
                  {error ? 'Please try again or contact support.' : 'The requested client could not be found.'}
                </p>
                <Button onClick={onBack}>
                  Return to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Safe rendering with null checks
  const initials = getInitials(currentClient?.client_name);
  const clientName = currentClient?.client_name || 'Unknown Client';

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
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <h1 className="text-2xl font-semibold">{clientName}</h1>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(currentClient?.status || 'active')}>
                      {(currentClient?.status || 'active').charAt(0).toUpperCase() + (currentClient?.status || 'active').slice(1)}
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
                {currentClient?.client_email && (
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <a 
                        href={`mailto:${currentClient.client_email}`}
                        className="font-medium hover:underline"
                      >
                        {currentClient.client_email}
                      </a>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Slack</p>
                    {currentClient?.slack ? (
                      <a 
                        href={currentClient.slack}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium hover:underline"
                      >
                        @{(currentClient?.client_name || 'user').split(' ')[0].toLowerCase()}
                      </a>
                    ) : (
                      <p className="font-medium text-muted-foreground">Not provided</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Granola Notes</p>
                    {currentClient?.granola_notes_folder ? (
                      <a 
                        href={currentClient.granola_notes_folder}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium hover:underline"
                      >
                        View Notes Folder
                      </a>
                    ) : (
                      <p className="font-medium text-muted-foreground">Not provided</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Defacto Meeting</p>
                    {currentClient?.defacto_meeting ? (
                      <a 
                        href={currentClient.defacto_meeting}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium hover:underline"
                      >
                        Join Meeting
                      </a>
                    ) : (
                      <p className="font-medium text-muted-foreground">Not provided</p>
                    )}
                  </div>
                </div>
                {currentClient?.company_name && (
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <div className="h-4 w-4 flex items-center justify-center">
                      <span className="text-xs font-bold text-muted-foreground">CO</span>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Company</p>
                      <p className="font-medium">{currentClient.company_name}</p>
                    </div>
                  </div>
                )}
                {currentClient?.role && (
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <div className="h-4 w-4 flex items-center justify-center">
                      <span className="text-xs font-bold text-muted-foreground">R</span>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Role</p>
                      <p className="font-medium">{currentClient.role}</p>
                    </div>
                  </div>
                )}
                {currentClient?.location && (
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <div className="h-4 w-4 flex items-center justify-center">
                      <span className="text-xs font-bold text-muted-foreground">📍</span>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Location</p>
                      <p className="font-medium">{currentClient.location}</p>
                    </div>
                  </div>
                )}
                {(currentClient?.ea_name || currentClient?.ea_email) && (
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Executive Assistant</p>
                      {currentClient?.ea_name && (
                        <p className="font-medium">{currentClient.ea_name}</p>
                      )}
                      {currentClient?.ea_email && (
                        <a 
                          href={`mailto:${currentClient.ea_email}`}
                          className="text-sm text-muted-foreground hover:underline"
                        >
                          {currentClient.ea_email}
                        </a>
                      )}
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
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Last Session</p>
                    <p className="font-medium">
                      {currentClient.last_session_date 
                        ? formatDateWithTime(currentClient.last_session_date)
                        : 'None'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Next Session</p>
                    <p className="font-medium">
                      {currentClient.next_session_date ? formatDate(currentClient.next_session_date) : 'Not scheduled'}
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
            <CardTitle>
              Session History 
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({loading ? '...' : sessionHistory.length} session{sessionHistory.length !== 1 ? 's' : ''})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading && sessionHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading session history...
              </div>
            ) : sessionHistory.length > 0 ? (
              <div className="space-y-4">
                {sessionHistory.map((session, index) => (
                  <div key={session.session_id}>
                    <div className="flex items-start gap-4">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted">
                        {getSessionIcon(session.session_status)}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{getSessionTitle(session)}</p>
                            <Badge variant="outline" className="text-xs">
                              {formatSessionDuration(session.session_duration)}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {formatLastSessionDate(session.session_date)}
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
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No session history found for this client.
              </div>
            )}
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

export default ClientDetail;