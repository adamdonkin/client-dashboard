// in src/components/ClientListView.tsx
import { Client } from "@/types";
import { format, isToday, isTomorrow, parseISO } from 'date-fns';

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

interface ClientListViewProps {
  title: string;
  clients: Client[];
  badgeColor: string;
  onClientSelect: (client: Client) => void;
}

export function ClientListView({ title, clients, badgeColor, onClientSelect }: ClientListViewProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${badgeColor}`}>
          {clients.length}
        </span>
      </div>
      <div className="border rounded-lg overflow-hidden bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Slack</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Session</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Next Session</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {clients.map((client) => (
              <tr key={client.client_id} onClick={() => onClientSelect(client)} className="hover:bg-gray-50 cursor-pointer">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10">
                      <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-600">
                        {getInitials(client.client_name)}
                      </div>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">{client.client_name}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{client.client_email}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{client.slack || 'N/A'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatLastSession(client.last_session_date)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{formatNextSession(client.next_session_date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}