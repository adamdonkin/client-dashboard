// in src/components/ClientListView.tsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Calendar, Mail, MessageSquare } from "lucide-react";
import { Client } from "./types";
import { formatRelativeDate, formatLastSessionDate } from "../utils/date-utils";

// Helper function to get initials from a name
const getInitials = (name?: string | null) => {
  if (!name) return '??';
  const names = name.split(' ');
  if (names.length > 1) {
    return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

// Helper function to format the next session date
const formatNextSession = (dateString?: string) => {
  if (!dateString) return "Not scheduled";
  const date = parseISO(dateString); // Convert string to Date object
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "EEE, MMM d");
};

// Helper function to format the last session date
const formatLastSession = (dateString?: string) => {
    if (!dateString) return "N/A";
    const date = parseISO(dateString); // Convert string to Date object
    return format(date, "MMM d, yyyy");
}

// Add this helper function at the top of your component file
const getSlackUsername = (slackUrl: string, clientName: string) => {
  if (!slackUrl) return null;
  // Extract the channel ID from the URL (last part after /archives/)
  const channelId = slackUrl.split('/archives/')[1];
  if (channelId) {
    // Use first name + last initial for display
    const nameParts = clientName.split(' ');
    const firstName = nameParts[0];
    const lastInitial = nameParts[1] ? nameParts[1][0] : '';
    return `${firstName}${lastInitial ? ' ' + lastInitial : ''}`;
  }
  return clientName.split(' ')[0]; // Fallback to first name
};

const getAvatarUrl = (email: string) => {
  // You could use Gravatar or other avatar services
  // For now, we'll stick with initials, but this is where you'd add avatar URLs
  return null; // Return null to use initials fallback
};

interface ClientListViewProps {
  clients: Client[];
  title: string;
  badgeColor?: string;
  onClientSelect?: (client: Client) => void;
}

export function ClientListView({ clients, title, badgeColor, onClientSelect }: ClientListViewProps) {
  if (clients.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h2>{title}</h2>
          <Badge variant="secondary" className={badgeColor}>
            0
          </Badge>
        </div>
        <p className="text-muted-foreground text-center py-8">
          No clients in this category
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2>{title}</h2>
        <Badge variant="secondary" className={badgeColor}>
          {clients.length}
        </Badge>
      </div>
      
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Slack</TableHead>
              <TableHead>Last Session</TableHead>
              <TableHead>Next Session</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client) => (
              <TableRow 
                key={client.id}
                className={onClientSelect ? "cursor-pointer hover:bg-muted/50" : ""}
                onClick={() => onClientSelect?.(client)}
              >
                <TableCell>
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={getAvatarUrl(client.client_email)} alt={client.client_name} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                        {getInitials(client.client_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="font-medium">{client.client_name}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Mail className="h-3 w-3 mr-2" />
                    {client.client_email}
                  </div>
                </TableCell>
                <TableCell>
                  {client.slack ? (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <MessageSquare className="h-3 w-3 mr-2" />
                      {client.slack}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {client.last_session_date
                    ? formatLastSessionDate(client.last_session_date)
                    : 'None'
                  }
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {client.next_session_date ? (
                      <span>{formatRelativeDate(client.next_session_date)}</span>
                    ) : (
                      <span className="text-muted-foreground">Not scheduled</span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}