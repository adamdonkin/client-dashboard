'use client'

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
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
  Check,
  RefreshCw,
  Timer,
  Phone,
  Plus,
  Copy
} from "lucide-react";
import { Client } from "@/components/types";
import { formatLastSessionDate } from "@/components/utils/date-utils";
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { ActionCreateForm } from '@/components/session/ActionCreateForm';
import { ActionReviewSection } from '@/components/session/ActionReviewSection';
import type { ActionReviewSectionHandle } from '@/components/session/ActionReviewSection';
import { ActionDetailPanel } from '@/components/session/ActionDetailPanel';
import type { ActionItem } from '@/components/ActionRow';
import { copyActionsToClipboard } from '@/utils/copy-actions';
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ClientStatus } from "@/components/types";

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
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [currentClient, setCurrentClient] = useState<Client | null>(client);
  const [sessionHistory, setSessionHistory] = useState<Session[]>([]);
  const [showActionCreate, setShowActionCreate] = useState(false);
  const [actionRefreshKey, setActionRefreshKey] = useState(0);
  const [copiedActions, setCopiedActions] = useState(false);
  const [selectedAction, setSelectedAction] = useState<ActionItem | null>(null);
  const reviewSectionRef = useRef<ActionReviewSectionHandle>(null)

  const handleActionChanged = (updated: ActionItem) => {
    setSelectedAction(prev => prev?.id === updated.id ? updated : prev)
  }

  const handleActionRemoved = (id: string) => {
    setSelectedAction(prev => prev?.id === id ? null : prev)
  }

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState(client.notes || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  
  // Edit details state
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editRole, setEditRole] = useState(client.role || '');
  const [editLocation, setEditLocation] = useState(client.location || '');
  const [editMonthlyFee, setEditMonthlyFee] = useState(client.monthly_fee?.toString() || '');
  const [editCadence, setEditCadence] = useState(client.cadence || '');
  const [editDuration, setEditDuration] = useState(client.session_duration || '');
  
  // Copy to clipboard state
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const copyToClipboard = (value: string, field: string) => {
    navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Edit contact state
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [editName, setEditName] = useState(client.client_name || '');
  const [editEmail, setEditEmail] = useState(client.client_email || '');
  const [editCompanyName, setEditCompanyName] = useState(client.company_name || '');
  const [editPhone, setEditPhone] = useState(client.phone || '');
  const [editSlack, setEditSlack] = useState(client.slack || '');
  const [editEaName, setEditEaName] = useState(client.ea_name || '');
  const [editEaEmail, setEditEaEmail] = useState(client.ea_email || '');
  const [editEaSlack, setEditEaSlack] = useState(client.ea_slack || '');
  const [editDefactoMeeting, setEditDefactoMeeting] = useState(client.defacto_meeting || '');
  const [editGranolaNotesFolder, setEditGranolaNotesFolder] = useState(client.granola_notes_folder || '');
  
  // Enum options from database
  const [cadenceOptions, setCadenceOptions] = useState<string[]>([]);
  const [durationOptions, setDurationOptions] = useState<string[]>([]);

  // Fetch enum values from database
  useEffect(() => {
    const fetchEnumValues = async () => {
      // Fetch cadence enum values
      const { data: cadenceData, error: cadenceError } = await supabase
        .rpc('get_enum_values', { enum_name: 'cadence' });
      if (cadenceError) {
        console.error('Error fetching cadence options:', cadenceError.message || cadenceError);
        // Fallback to querying distinct values from clients table
        const { data: fallbackCadence } = await supabase
          .from('clients')
          .select('cadence')
          .not('cadence', 'is', null);
        if (fallbackCadence) {
          const uniqueCadences = [...new Set(fallbackCadence.map(c => c.cadence).filter(Boolean))];
          setCadenceOptions(uniqueCadences as string[]);
        }
      } else if (cadenceData) {
        setCadenceOptions(cadenceData.map((row: { value: string }) => row.value));
      }
      
      // Fetch session_duration enum values
      const { data: durationData, error: durationError } = await supabase
        .rpc('get_enum_values', { enum_name: 'session_duration' });
      if (durationError) {
        console.error('Error fetching duration options:', durationError.message || durationError);
        // Fallback to querying distinct values from clients table
        const { data: fallbackDuration } = await supabase
          .from('clients')
          .select('session_duration')
          .not('session_duration', 'is', null);
        if (fallbackDuration) {
          const uniqueDurations = [...new Set(fallbackDuration.map(d => d.session_duration).filter(Boolean))];
          setDurationOptions(uniqueDurations as string[]);
        }
      } else if (durationData) {
        setDurationOptions(durationData.map((row: { value: string }) => row.value));
      }
    };
    
    fetchEnumValues();
  }, [supabase]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'pending': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
      case 'waiting': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'inactive': return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const statusOptions: { value: ClientStatus; label: string }[] = [
    { value: 'active', label: 'Active' },
    { value: 'pending', label: 'Pending' },
    { value: 'waiting', label: 'Waitlist' },
    { value: 'inactive', label: 'Inactive' },
  ];

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
      // Fetch client details
      const { data, error } = await supabase
        .from('clients')
        .select('ea_name, ea_email, ea_slack, defacto_meeting, role, is_active, status, location, monthly_fee, notes, phone, cadence, session_duration')
        .eq('id', client.id)
        .single();
      
      if (error) {
        console.error('Error fetching additional client details:', error);
        return;
      }

      // Fetch next upcoming session
      const { data: nextSessionData } = await supabase
        .from('calendar_events')
        .select('id, start_time')
        .eq('client_id', client.id)
        .gt('start_time', new Date().toISOString())
        .or('status.is.null,status.neq.cancelled')
        .order('start_time', { ascending: true })
        .limit(1)
        .single();

      // Fetch last session (most recent past session)
      const { data: lastSessionData } = await supabase
        .from('calendar_events')
        .select('id, start_time')
        .eq('client_id', client.id)
        .lte('start_time', new Date().toISOString())
        .or('status.is.null,status.neq.cancelled')
        .order('start_time', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        // Use status field if available, otherwise derive from is_active
        const effectiveStatus = data.status || (data.is_active === false ? 'inactive' : 'active');
        const clientData = { 
          ...data, 
          status: effectiveStatus,
          next_session_date: nextSessionData?.start_time || null,
          next_session_event_id: nextSessionData?.id || null,
          last_session_date: lastSessionData?.start_time || null,
          last_session_event_id: lastSessionData?.id || null,
        };
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

  // Sync edit details state when client changes
  useEffect(() => {
    setEditRole(currentClient?.role || '');
    setEditLocation(currentClient?.location || '');
    setEditMonthlyFee(currentClient?.monthly_fee?.toString() || '');
    setEditCadence(currentClient?.cadence || '');
    setEditDuration(currentClient?.session_duration || '');
  }, [currentClient]);

  // Save details
  const saveDetails = async () => {
    try {
      setIsSaving(true);
      const updates: Record<string, unknown> = {
        role: editRole || null,
        location: editLocation || null,
        monthly_fee: editMonthlyFee ? parseFloat(editMonthlyFee) : null,
        cadence: editCadence || null,
        session_duration: editDuration || null,
      };

      const { error: updateError } = await supabase
        .from('clients')
        .update(updates)
        .eq('id', client.id);

      if (updateError) {
        console.error('Error saving details:', updateError);
      } else {
        setCurrentClient(prev => prev ? { 
          ...prev, 
          role: editRole || undefined,
          location: editLocation || undefined,
          monthly_fee: editMonthlyFee ? parseFloat(editMonthlyFee) : undefined,
          cadence: editCadence || undefined,
          session_duration: editDuration || undefined,
        } : prev);
      }
    } catch (err) {
      console.error('Error saving details:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDoneEditingDetails = () => {
    saveDetails();
    setIsEditingDetails(false);
  };

  // Sync edit contact state when client changes
  useEffect(() => {
    setEditName(currentClient?.client_name || '');
    setEditEmail(currentClient?.client_email || '');
    setEditCompanyName(currentClient?.company_name || '');
    setEditPhone(currentClient?.phone || '');
    setEditSlack(currentClient?.slack || '');
    setEditEaName(currentClient?.ea_name || '');
    setEditEaEmail(currentClient?.ea_email || '');
    setEditEaSlack(currentClient?.ea_slack || '');
    setEditDefactoMeeting(currentClient?.defacto_meeting || '');
    setEditGranolaNotesFolder(currentClient?.granola_notes_folder || '');
  }, [currentClient]);

  // Save contact info
  const saveContact = async () => {
    try {
      setIsSaving(true);
      const updates: Record<string, unknown> = {
        name: editName || null,
        email: editEmail || null,
        company_name: editCompanyName || null,
        phone: editPhone || null,
        slack: editSlack || null,
        ea_name: editEaName || null,
        ea_email: editEaEmail || null,
        ea_slack: editEaSlack || null,
        defacto_meeting: editDefactoMeeting || null,
        granola_notes_folder: editGranolaNotesFolder || null,
      };

      const { error: updateError } = await supabase
        .from('clients')
        .update(updates)
        .eq('id', client.id);

      if (updateError) {
        console.error('Error saving contact:', updateError);
      } else {
        setCurrentClient(prev => prev ? { 
          ...prev, 
          client_name: editName || undefined,
          client_email: editEmail || undefined,
          company_name: editCompanyName || undefined,
          phone: editPhone || undefined,
          slack: editSlack || undefined,
          ea_name: editEaName || undefined,
          ea_email: editEaEmail || undefined,
          ea_slack: editEaSlack || undefined,
          defacto_meeting: editDefactoMeeting || undefined,
          granola_notes_folder: editGranolaNotesFolder || undefined,
        } : prev);
      }
    } catch (err) {
      console.error('Error saving contact:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDoneEditingContact = () => {
    saveContact();
    setIsEditingContact(false);
  };

  // Handle status change
  const handleStatusChange = async (newStatus: ClientStatus) => {
    try {
      const { error: updateError } = await supabase
        .from('clients')
        .update({ 
          status: newStatus,
          // Also update is_active for backward compatibility
          is_active: newStatus === 'active' || newStatus === 'pending'
        })
        .eq('id', client.id);

      if (updateError) {
        console.error('Error updating status:', updateError);
      } else {
        const updatedClient = { ...currentClient!, status: newStatus };
        setCurrentClient(updatedClient);
        onClientUpdate?.(updatedClient);
      }
    } catch (err) {
      console.error('Error updating status:', err);
    }
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
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <h2 className="text-lg font-semibold text-foreground mb-2">
                  {error || 'Client not found'}
                </h2>
                <p className="text-muted-foreground mb-4">
                  {error ? 'Please try again or contact support.' : 'The requested client could not be found.'}
                </p>
                <Button onClick={() => window.location.href = '/clients'}>
                  View Clients
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Inline header editing
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [headerName, setHeaderName] = useState(currentClient?.client_name || '');
  const [headerCompany, setHeaderCompany] = useState(currentClient?.company_name || '');
  const [headerRole, setHeaderRole] = useState(currentClient?.role || '');

  useEffect(() => {
    setHeaderName(currentClient?.client_name || '');
    setHeaderCompany(currentClient?.company_name || '');
    setHeaderRole(currentClient?.role || '');
  }, [currentClient?.client_name, currentClient?.company_name, currentClient?.role]);

  const saveHeader = async () => {
    try {
      setIsSaving(true);
      const updates: Record<string, unknown> = {
        name: headerName || null,
        company_name: headerCompany || null,
        role: headerRole || null,
      };
      const { error: updateError } = await supabase
        .from('clients')
        .update(updates)
        .eq('id', client.id);

      if (updateError) {
        console.error('Error saving header:', updateError);
      } else {
        const updated = {
          ...currentClient!,
          client_name: headerName || undefined,
          company_name: headerCompany || undefined,
          role: headerRole || undefined,
        };
        setCurrentClient(updated);
        onClientUpdate?.(updated);
        setEditName(headerName);
        setEditCompanyName(headerCompany);
        setEditRole(headerRole);
      }
    } catch (err) {
      console.error('Error saving header:', err);
    } finally {
      setIsSaving(false);
      setIsEditingHeader(false);
    }
  };

  const cancelHeaderEdit = () => {
    setHeaderName(currentClient?.client_name || '');
    setHeaderCompany(currentClient?.company_name || '');
    setHeaderRole(currentClient?.role || '');
    setIsEditingHeader(false);
  };

  // Safe rendering with null checks
  const clientName = currentClient?.client_name || 'Unknown Client';

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Client Header */}
        <Card className="border-l-4 border-l-primary">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                {isEditingHeader ? (
                  <div className="space-y-3">
                    <input
                      autoFocus
                      type="text"
                      value={headerName}
                      onChange={(e) => setHeaderName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveHeader();
                        if (e.key === 'Escape') cancelHeaderEdit();
                      }}
                      className="w-full text-3xl font-bold bg-transparent border-b-2 border-primary outline-none"
                      placeholder="Client name"
                    />
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        value={headerCompany}
                        onChange={(e) => setHeaderCompany(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveHeader();
                          if (e.key === 'Escape') cancelHeaderEdit();
                        }}
                        className="bg-transparent border-b border-muted-foreground/30 outline-none text-muted-foreground font-medium placeholder:text-muted-foreground/50"
                        placeholder="Company"
                      />
                      <span className="text-muted-foreground">•</span>
                      <input
                        type="text"
                        value={headerRole}
                        onChange={(e) => setHeaderRole(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveHeader();
                          if (e.key === 'Escape') cancelHeaderEdit();
                        }}
                        className="bg-transparent border-b border-muted-foreground/30 outline-none text-muted-foreground placeholder:text-muted-foreground/50"
                        placeholder="Role"
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <Button size="sm" onClick={saveHeader} disabled={isSaving}>
                        <Check className="h-3 w-3 mr-1" />
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancelHeaderEdit}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 mb-1">
                      <h1
                        className="text-2xl font-bold cursor-pointer hover:text-primary/80 transition-colors"
                        onClick={() => setIsEditingHeader(true)}
                        title="Click to edit"
                      >
                        {clientName}
                      </h1>
                      <Select
                        value={currentClient?.status || 'active'}
                        onValueChange={(value) => handleStatusChange(value as ClientStatus)}
                      >
                        <SelectTrigger className={`w-[120px] h-7 text-xs font-medium border-0 ${getStatusColor(currentClient?.status || 'active')}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(option.value)}`}>
                                {option.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div
                      className="flex items-center gap-2 text-muted-foreground cursor-pointer hover:text-muted-foreground/70 transition-colors"
                      onClick={() => setIsEditingHeader(true)}
                      title="Click to edit"
                    >
                      {currentClient?.company_name && (
                        <>
                          <span className="font-medium">{currentClient.company_name}</span>
                          {currentClient?.role && <span>•</span>}
                        </>
                      )}
                      {currentClient?.role && <span>{currentClient.role}</span>}
                      {!currentClient?.company_name && !currentClient?.role && (
                        <span className="text-muted-foreground/50 italic text-sm">Add company & role</span>
                      )}
                      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100" />
                    </div>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Last: {currentClient.last_session_date ? (
                  (currentClient as any).last_session_event_id ? (
                    <a
                      href={`/sessions/${(currentClient as any).last_session_event_id}`}
                      className="font-medium text-primary hover:underline"
                      onClick={(e) => {
                        e.preventDefault()
                        router.push(`/sessions/${(currentClient as any).last_session_event_id}`)
                      }}
                    >
                      {formatDateWithTime(currentClient.last_session_date)}
                    </a>
                  ) : (
                    <span className="font-medium text-foreground">{formatDateWithTime(currentClient.last_session_date)}</span>
                  )
                ) : (
                  <span className="font-medium text-foreground">None</span>
                )}
              </span>
              <span className="text-border">·</span>
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Next: {currentClient.next_session_date ? (
                  (currentClient as any).next_session_event_id ? (
                    <a
                      href={`/sessions/${(currentClient as any).next_session_event_id}`}
                      className="font-medium text-primary hover:underline"
                      onClick={(e) => {
                        e.preventDefault()
                        router.push(`/sessions/${(currentClient as any).next_session_event_id}`)
                      }}
                    >
                      {formatDateWithTime(currentClient.next_session_date)}
                    </a>
                  ) : (
                    <span className="font-medium text-foreground">{formatDateWithTime(currentClient.next_session_date)}</span>
                  )
                ) : (
                  <span className="font-medium text-foreground">Not scheduled</span>
                )}
              </span>
              <span className="text-border">·</span>
              <button
                onClick={() => router.push(`/sessions/new?clientId=${client.id}`)}
                className="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
              >
                Start Session
              </button>
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
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault();
                    handleDoneEditing();
                  }
                }}
                placeholder="Jot down important themes, insights, patterns...

Use Markdown: **bold**, *italic*, - bullets, # headers"
                className="min-h-[150px] text-sm"
              />
            ) : notes ? (
              <div 
                onClick={() => setIsEditingNotes(true)}
                className="text-sm cursor-pointer hover:bg-accent/50 rounded -m-2 p-2 transition-colors [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_li]:my-1 [&_p]:my-2 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:my-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:my-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:my-2 [&_strong]:font-semibold [&_a]:text-primary [&_a]:underline"
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {notes}
                </ReactMarkdown>
              </div>
            ) : (
              <p 
                onClick={() => setIsEditingNotes(true)}
                className="text-muted-foreground text-sm cursor-pointer hover:text-foreground transition-colors"
              >
                No notes yet. Click to add notes.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Two Column Layout - Compact */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Contact & Communication */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Contact</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => isEditingContact ? handleDoneEditingContact() : setIsEditingContact(true)}
              >
                {isEditingContact ? (
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
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {isEditingContact ? (
                <div
                  className="space-y-3"
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                      e.preventDefault();
                      handleDoneEditingContact();
                    }
                  }}
                >
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Name</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-2 py-1 text-sm border rounded bg-background"
                        placeholder="Client name"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Company</label>
                      <input
                        type="text"
                        value={editCompanyName}
                        onChange={(e) => setEditCompanyName(e.target.value)}
                        className="w-full px-2 py-1 text-sm border rounded bg-background"
                        placeholder="Company name"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-muted-foreground">Email</label>
                      <input
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        className="w-full px-2 py-1 text-sm border rounded bg-background"
                        placeholder="email@example.com"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-muted-foreground">Phone</label>
                      <input
                        type="tel"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        className="w-full px-2 py-1 text-sm border rounded bg-background"
                        placeholder="+1 (555) 123-4567"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-muted-foreground">Slack</label>
                      <input
                        type="text"
                        value={editSlack}
                        onChange={(e) => setEditSlack(e.target.value)}
                        className="w-full px-2 py-1 text-sm border rounded bg-background"
                        placeholder="Slack ID or handle"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-muted-foreground">Meeting Link</label>
                      <input
                        type="url"
                        value={editDefactoMeeting}
                        onChange={(e) => setEditDefactoMeeting(e.target.value)}
                        className="w-full px-2 py-1 text-sm border rounded bg-background"
                        placeholder="https://zoom.us/..."
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-muted-foreground">Granola Notes Folder</label>
                      <input
                        type="url"
                        value={editGranolaNotesFolder}
                        onChange={(e) => setEditGranolaNotesFolder(e.target.value)}
                        className="w-full px-2 py-1 text-sm border rounded bg-background"
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground mb-2">Executive Assistant</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground">EA Name</label>
                        <input
                          type="text"
                          value={editEaName}
                          onChange={(e) => setEditEaName(e.target.value)}
                          className="w-full px-2 py-1 text-sm border rounded bg-background"
                          placeholder="EA name"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">EA Email</label>
                        <input
                          type="email"
                          value={editEaEmail}
                          onChange={(e) => setEditEaEmail(e.target.value)}
                          className="w-full px-2 py-1 text-sm border rounded bg-background"
                          placeholder="ea@example.com"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-muted-foreground">EA Slack</label>
                        <input
                          type="text"
                          value={editEaSlack}
                          onChange={(e) => setEditEaSlack(e.target.value)}
                          className="w-full px-2 py-1 text-sm border rounded bg-background"
                          placeholder="Slack ID or handle"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                    {currentClient?.client_email && (
                      <button
                        onClick={() => copyToClipboard(currentClient.client_email!, 'email')}
                        className="flex items-center gap-1.5 hover:text-foreground transition-colors text-left group"
                      >
                        <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">{currentClient.client_email}</span>
                        {copiedField === 'email'
                          ? <Check className="h-3 w-3 text-green-500 shrink-0" />
                          : <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />}
                      </button>
                    )}
                    {currentClient?.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span>{currentClient.phone}</span>
                      </div>
                    )}
                    {currentClient?.slack && (
                      <button
                        onClick={() => copyToClipboard(currentClient.slack!, 'slack')}
                        className="flex items-center gap-1.5 hover:text-foreground transition-colors text-left group"
                      >
                        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span>Slack</span>
                        {copiedField === 'slack'
                          ? <Check className="h-3 w-3 text-green-500 shrink-0" />
                          : <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />}
                      </button>
                    )}
                    {currentClient?.defacto_meeting && (
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <a href={currentClient.defacto_meeting} target="_blank" rel="noopener noreferrer" className="hover:underline">
                          Meeting Link
                        </a>
                      </div>
                    )}
                    {currentClient?.granola_notes_folder && (
                      <div className="flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <a href={currentClient.granola_notes_folder} target="_blank" rel="noopener noreferrer" className="hover:underline">
                          Granola Notes
                        </a>
                      </div>
                    )}
                  </div>
                  {(currentClient?.ea_name || currentClient?.ea_email || currentClient?.ea_slack) && (
                    <div className="pt-2 border-t space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span>EA: {currentClient?.ea_name || currentClient?.ea_email}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pl-5">
                        {currentClient?.ea_email && (
                          <button
                            onClick={() => copyToClipboard(currentClient.ea_email!, 'ea_email')}
                            className="flex items-center gap-1.5 hover:text-foreground transition-colors text-left group"
                          >
                            <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="truncate">{currentClient.ea_email}</span>
                            {copiedField === 'ea_email'
                              ? <Check className="h-3 w-3 text-green-500 shrink-0" />
                              : <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />}
                          </button>
                        )}
                        {currentClient?.ea_slack && (
                          <button
                            onClick={() => copyToClipboard(currentClient.ea_slack!, 'ea_slack')}
                            className="flex items-center gap-1.5 hover:text-foreground transition-colors text-left group"
                          >
                            <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span>Slack</span>
                            {copiedField === 'ea_slack'
                              ? <Check className="h-3 w-3 text-green-500 shrink-0" />
                              : <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  {!currentClient?.client_email && !currentClient?.phone && !currentClient?.slack && !currentClient?.defacto_meeting && !currentClient?.granola_notes_folder && !currentClient?.ea_name && !currentClient?.ea_email && !currentClient?.ea_slack && (
                    <p className="text-muted-foreground">No contact information. Click Edit to add.</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Client Details */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Details</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => isEditingDetails ? handleDoneEditingDetails() : setIsEditingDetails(true)}
              >
                {isEditingDetails ? (
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
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {isEditingDetails ? (
                <div
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                      e.preventDefault();
                      handleDoneEditingDetails();
                    }
                  }}
                >
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Role</label>
                      <input
                        type="text"
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value)}
                        className="w-full px-2 py-1 text-sm border rounded bg-background"
                        placeholder="e.g. CEO"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Location</label>
                      <input
                        type="text"
                        value={editLocation}
                        onChange={(e) => setEditLocation(e.target.value)}
                        className="w-full px-2 py-1 text-sm border rounded bg-background"
                        placeholder="e.g. San Francisco"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Monthly Fee</label>
                      <input
                        type="number"
                        value={editMonthlyFee}
                        onChange={(e) => setEditMonthlyFee(e.target.value)}
                        className="w-full px-2 py-1 text-sm border rounded bg-background"
                        placeholder="e.g. 5000"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Cadence</label>
                      <select
                        value={editCadence}
                        onChange={(e) => setEditCadence(e.target.value)}
                        className="w-full px-2 py-1 text-sm border rounded bg-background"
                      >
                        <option value="">Select...</option>
                        {cadenceOptions.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Duration</label>
                      <select
                        value={editDuration}
                        onChange={(e) => setEditDuration(e.target.value)}
                        className="w-full px-2 py-1 text-sm border rounded bg-background"
                      >
                        <option value="">Select...</option>
                        {durationOptions.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {currentClient?.location && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span>{currentClient.location}</span>
                    </div>
                  )}
                  {currentClient?.monthly_fee && (
                    <div>
                      <span className="text-muted-foreground">Fee:</span>{' '}
                      <span className="font-medium">${Number(currentClient.monthly_fee).toLocaleString()}/mo</span>
                    </div>
                  )}
                  {currentClient?.cadence && (
                    <div>
                      <span className="text-muted-foreground">Cadence:</span>{' '}
                      <span className="font-medium">{currentClient.cadence}</span>
                    </div>
                  )}
                  {currentClient?.session_duration && (
                    <div>
                      <span className="text-muted-foreground">Duration:</span>{' '}
                      <span className="font-medium">{currentClient.session_duration}</span>
                    </div>
                  )}
                </div>
              )}
              <div className="flex items-center gap-4 pt-1.5 border-t">
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

        {/* Actions */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Actions</CardTitle>
              <div className="flex items-center gap-1">
                <button
                  onClick={async () => {
                    const actions = reviewSectionRef.current?.getActions()
                    if (actions && actions.length > 0) {
                      await copyActionsToClipboard(actions)
                      setCopiedActions(true)
                      setTimeout(() => setCopiedActions(false), 2000)
                    }
                  }}
                  className="p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  title="Copy actions to clipboard"
                >
                  {copiedActions ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => setShowActionCreate(true)}
                  className="p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  title="Add action"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {showActionCreate && (
              <div className="mb-3">
                <ActionCreateForm
                  onSubmit={async (title, dueDate) => {
                    const { data: { session } } = await supabase.auth.getSession()
                    if (!session) return
                    await supabase
                      .from('client_actions')
                      .insert({
                        user_id: session.user.id,
                        client_id: client.id,
                        source: 'manual',
                        source_id: `manual-${Date.now()}`,
                        title,
                        status: 'to_do',
                        due_date: dueDate,
                      })
                    setShowActionCreate(false)
                    setActionRefreshKey(k => k + 1)
                  }}
                  onCancel={() => setShowActionCreate(false)}
                />
              </div>
            )}
            <ActionReviewSection
              ref={reviewSectionRef}
              clientId={client.id}
              refreshKey={actionRefreshKey}
              onActionSelect={setSelectedAction}
              onActionChanged={handleActionChanged}
              onActionRemoved={handleActionRemoved}
            />
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
                    <div
                      className="flex items-start gap-4 cursor-pointer hover:bg-muted/50 rounded-md -mx-2 px-2 py-1 transition-colors"
                      onClick={() => router.push(`/sessions/${session.session_id}`)}
                    >
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

      {selectedAction && (
        <ActionDetailPanel
          key={selectedAction.id}
          action={selectedAction}
          onClose={() => setSelectedAction(null)}
          onUpdated={(updated) => {
            setSelectedAction(updated)
            reviewSectionRef.current?.applyChanged(updated)
          }}
          onDeleted={(id) => {
            setSelectedAction(null)
            reviewSectionRef.current?.applyRemoved(id)
          }}
        />
      )}
    </div>
  );
}

export default ClientDetail;