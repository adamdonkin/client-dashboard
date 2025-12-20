// in src/components/ClientListView.tsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Calendar } from "lucide-react";
import { Client } from "./types";
import { formatRelativeDate, formatLastSessionDate } from "../utils/date-utils";

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
    <Card>
      <CardHeader className="flex flex-row items-center space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Badge variant="secondary" className={`${badgeColor} ml-2`}>
          {clients.length}
        </Badge>
      </CardHeader>
      <CardContent className="pt-0">
          <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]">Client</TableHead>
              <TableHead className="w-[30%]">Last Session</TableHead>
              <TableHead className="w-[30%]">Next Session</TableHead>
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
                  <div className="font-medium">{client.client_name}</div>
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
      </CardContent>
    </Card>
  );
}