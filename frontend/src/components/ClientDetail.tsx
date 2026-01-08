'use client'

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, 
  Calendar, 
  Mail, 
  MessageSquare, 
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  User,
  DollarSign,
  MapPin,
  Pencil,
  Check
} from "lucide-react";
import { Client } from "@/components/types";
import { formatLastSessionDate } from "@/components/utils/date-utils";
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Textarea } from "@/components/ui/textarea";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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

const ClientDetail = ({ client, onBack, onClientUpdate }: ClientDetailProps) => {
  const supabase = createClientComponentClient();
  const [currentClient, setCurrentClient] = useState<Client | null>(client);
  const [sessionHistory, setSessionHistory] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState(client.notes || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-muted text-muted-foreground';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-muted text-muted-foreground';
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
        .select('ea_name, ea_email, defacto_meeting, role, is_active, location, monthly_fee, notes, phone')
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

  // Sync notes state when client changes
  useEffect(() => {
    setNotes(currentClient?.notes || '');
  }, [currentClient?.notes]);

  // Save notes when exiting edit mode
  const saveNotes = async () => {
    if (notes === (currentClient?.notes || '')) return;
    
    try {
      setIsSaving(true);
      const { error: updateError } = await supabase
        .from('clients')
        .update({ notes })
        .eq('id', client.id);

      if (updateError) {
        console.error('Error saving notes:', updateError);
      } else {
        setCurrentClient(prev => prev ? { ...prev, notes } : prev);
      }
    } catch (err) {
      console.error('Error saving notes:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDoneEditing = () => {
    saveNotes();
    setIsEditingNotes(false);
  };

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
              <div className="w-16 h-16 bg-muted rounded-full"></div>
              <div className="space-y-2">
                <div className="h-6 bg-muted rounded w-32"></div>
                <div className="h-4 bg-muted rounded w-24"></div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="h-32 bg-muted rounded"></div>
              <div className="h-32 bg-muted rounded"></div>
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
                <h2 className="text-lg font-semibold text-foreground mb-2">
                  {error || 'Client not found'}
                </h2>
                <p className="text-muted-foreground mb-4">
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

        {/* Client Header */}
        <Card className="border-l-4 border-l-primary">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold">{clientName}</h1>
                  <Badge className={getStatusColor(currentClient?.status || 'active')}>
                    {(currentClient?.status || 'active').charAt(0).toUpperCase() + (currentClient?.status || 'active').slice(1)}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  {currentClient?.company_name && (
                    <>
                      <span className="font-medium">{currentClient.company_name}</span>
                      <span>•</span>
                    </>
                  )}
                  {currentClient?.role && <span>{currentClient.role}</span>}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex items-center gap-3 p-4 bg-accent/50 rounded-lg">
                <Calendar className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Next Session</p>
                  <p className="font-semibold text-foreground">
                    {currentClient.next_session_date ? formatDateWithTime(currentClient.next_session_date) : 'Not scheduled'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-accent/50 rounded-lg">
                <Clock className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Last Session</p>
                  <p className="font-semibold text-foreground">
                    {currentClient.last_session_date 
                      ? formatDateWithTime(currentClient.last_session_date)
                      : 'None'}
                  </p>
                </div>
              </div>
              {currentClient?.monthly_fee && (
                <div className="flex items-center gap-3 p-4 bg-accent/50 rounded-lg">
                  <DollarSign className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Monthly Fee</p>
                    <p className="font-semibold text-foreground">${Number(currentClient.monthly_fee).toLocaleString()}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-lg">Notes</CardTitle>
            <div className="flex items-center gap-2">
              {isSaving && (
                <span className="text-xs text-muted-foreground">Saving...</span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => isEditingNotes ? handleDoneEditing() : setIsEditingNotes(true)}
              >
                {isEditingNotes ? (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Done
                  </>
                ) : (
                  <>
                    <Pencil className="h-4 w-4 mr-1" />
                    Edit
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isEditingNotes ? (
              <Textarea
                autoFocus
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Jot down important themes, insights, patterns...

Use Markdown: **bold**, *italic*, - bullets, # headers"
                className="min-h-[150px] text-sm"
              />
            ) : notes ? (
              <div className="text-sm [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_li]:my-1 [&_p]:my-2 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:my-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:my-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:my-2 [&_strong]:font-semibold [&_a]:text-primary [&_a]:underline">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {notes}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                No notes yet. Click Edit to add notes.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Two Column Layout - Compact */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Contact & Communication */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {currentClient?.client_email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${currentClient.client_email}`} className="hover:underline truncate">
                    {currentClient.client_email}
                  </a>
                </div>
              )}
              {currentClient?.slack && (
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <a href={currentClient.slack} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    Slack
                  </a>
                </div>
              )}
              {currentClient?.defacto_meeting && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <a href={currentClient.defacto_meeting} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    Meeting Link
                  </a>
                </div>
              )}
              {currentClient?.granola_notes_folder && (
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <a href={currentClient.granola_notes_folder} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    Granola Notes
                  </a>
                </div>
              )}
              {(currentClient?.ea_name || currentClient?.ea_email) && (
                <div className="flex items-center gap-2 pt-2 border-t">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>EA: {currentClient?.ea_name || currentClient?.ea_email}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Client Details */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {currentClient?.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{currentClient.location}</span>
                </div>
              )}
              <div className="flex items-center gap-4 pt-2 border-t">
                <div>
                  <span className="text-muted-foreground">Sessions:</span>{' '}
                  <span className="font-semibold">{loading ? '...' : sessionHistory.length}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Engagement:</span>{' '}
                  <span className="font-semibold">
                    {loading || sessionHistory.length === 0 ? '—' : (() => {
                      const firstSession = new Date(sessionHistory[sessionHistory.length - 1].session_date);
                      const lastSession = new Date(sessionHistory[0].session_date);
                      const now = new Date();
                      const endDate = lastSession > now ? lastSession : now;
                      const months = Math.floor((endDate.getTime() - firstSession.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
                      return `${months}mo`;
                    })()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

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
      </div>
    </div>
  );
}

export default ClientDetail;