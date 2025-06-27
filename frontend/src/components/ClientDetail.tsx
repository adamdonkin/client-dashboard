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
  Edit, 
  Plus,
  Clock,
  CheckCircle,
  XCircle
} from "lucide-react";
import { Client } from "@/types";
import { supabase } from "@/lib/supabaseClient"; // Import the Supabase client
import { format, parseISO } from "date-fns"; // Import date-fns helpers

// Define the shape of a Session object based on our new function
interface Session {
  session_id: string;
  session_date: string;
  session_notes: string;
  session_status: string;
  session_type: string;
}

interface ClientDetailProps {
  client: Client;
  onBack: () => void;
}

// Make the component ASYNC to fetch data
export async function ClientDetail({ client, onBack }: ClientDetailProps) {
  const [notes, setNotes] = useState(client.notes || "Client is making good progress...");

  // Fetch the real session history from Supabase
  const { data: sessionHistory, error } = await supabase
    .rpc('get_sessions_by_client_id', { p_client_id: client.client_id });

  if (error) {
    console.error("Error fetching session history:", error);
  }
  
  const getInitials = (name?: string | null) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const getStatusColor = (status?: string | null) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatSessionDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    return format(parseISO(dateString), "MMM d, yyyy");
  }
  
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
                  <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                    {getInitials(client.client_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <h1 className="text-2xl">{client.client_name}</h1>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(client.status)}>
                      {client.status || 'Unknown'}
                    </Badge>
                    <Badge variant="outline">{client.sessionType || 'Coaching'}</Badge>
                  </div>
                </div>
              </div>
              <Button variant="outline" className="flex items-center gap-2">
                <Edit className="h-4 w-4" />
                Edit Client
              </Button>
            </div>
          </CardHeader>
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
            <CardTitle className="flex items-center justify-between">
              Session History
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Session
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(sessionHistory || []).map((session, index) => (
                <div key={`${session.session_id}-${index}`}>
                  <div className="flex items-start gap-4">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted">
                      {getSessionIcon(session.session_status)}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{session.session_type}</p>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatSessionDate(session.session_date)}
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground">{session.session_notes}</p>
                    </div>
                  </div>
                  {index < (sessionHistory?.length || 0) - 1 && (
                    <Separator className="my-4" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}