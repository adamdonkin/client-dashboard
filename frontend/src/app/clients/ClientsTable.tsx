'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type ClientStatus = 'active' | 'lead' | 'waiting' | 'inactive' | 'staff';

interface ClientRow {
  id: string;
  name: string;
  email: string;
  company_name: string | null;
  location: string | null;
  role: string | null;
  monthly_fee: number | null;
  referral_source?: string | null;
  status?: ClientStatus | null;
  is_active?: boolean | null;
  cadence?: string | null;
  session_duration?: string | null;
  hourly_rate?: number | null;
  recent_hours?: number;
  recent_sessions?: number;
}

type SortField = 'company_name' | 'name' | 'role' | 'location' | 'monthly_fee' | 'hourly_rate' | 'cadence' | 'session_duration';
type SortDirection = 'asc' | 'desc';

interface ClientsTableProps {
  clients: ClientRow[];
}

export function ClientsTable({ clients }: ClientsTableProps) {
  const router = useRouter()
  const [sortField, setSortField] = useState<SortField>('company_name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  // Get effective status (for backward compatibility with is_active)
  const getEffectiveStatus = (client: ClientRow): ClientStatus => {
    if (client.status) return client.status;
    if (client.is_active === false) return 'inactive';
    return 'active';
  }


  // Format duration: "90 min" → "90m", or just number → "60m"
  const formatDuration = (duration: string | null | undefined): string => {
    if (!duration) return '—';
    // Extract number from string like "90 min" or just "90"
    const match = duration.match(/(\d+)/);
    if (match) return `${match[1]}m`;
    return duration;
  }

  // Status badge component
  const StatusBadge = ({ status }: { status: ClientStatus }) => {
    if (status === 'active') return null; // Don't show badge for active
    
    const styles = {
      lead: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
      waiting: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      inactive: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
      staff: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    };
    
    const labels = {
      lead: 'Lead',
      waiting: 'Waitlist',
      inactive: 'Inactive',
      staff: 'Staff',
    };
    
    return (
      <span className={`ml-2 px-1.5 py-0.5 text-xs rounded ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const sortedClients = [...clients].sort((a, b) => {
    const aVal = a[sortField] ?? null
    const bVal = b[sortField] ?? null

    // Handle nulls - push to end
    if (aVal === null && bVal === null) return 0
    if (aVal === null) return 1
    if (bVal === null) return -1

    // Compare values
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
    }

    // String comparison
    const aStr = String(aVal).toLowerCase()
    const bStr = String(bVal).toLowerCase()
    if (sortDirection === 'asc') {
      return aStr.localeCompare(bStr)
    } else {
      return bStr.localeCompare(aStr)
    }
  })

  const formatHourly = (rate: number | null | undefined) =>
    rate ? `$${Math.round(rate).toLocaleString()}` : '—'

  const hourlyTitle = (client: ClientRow) =>
    client.recent_sessions
      ? `${client.recent_hours?.toFixed(1)} hrs across ${client.recent_sessions} ${client.recent_sessions === 1 ? 'session' : 'sessions'}, last 3 months`
      : 'No completed sessions in the last 3 months'

  const SortableHeader = ({ field, children, className }: { field: SortField; children: React.ReactNode; className?: string }) => (
    <TableHead 
      className={`cursor-pointer hover:bg-accent transition-colors select-none ${className ?? ''}`}
      onClick={() => handleSort(field)}
    >
      {children}
    </TableHead>
  )

  return (
    <>
    <ul className="sm:hidden divide-y divide-border -my-2">
      {sortedClients.map((client) => (
        <li key={client.id}>
          <button
            onClick={() => router.push(`/clients/${client.id}`)}
            className="w-full flex items-center justify-between gap-3 py-2.5 text-left"
          >
            <div className="min-w-0">
              <div className="flex items-center text-sm font-medium text-foreground">
                <span className="truncate">{client.name}</span>
                <StatusBadge status={getEffectiveStatus(client)} />
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {[client.company_name, client.role].filter(Boolean).join(' · ') || '—'}
              </div>
            </div>
            <div className="shrink-0 text-right text-xs text-muted-foreground">
              {client.monthly_fee ? <div className="text-sm text-foreground">${client.monthly_fee.toLocaleString()}</div> : null}
              {client.hourly_rate ? <div>{formatHourly(client.hourly_rate)}/hr</div> : client.cadence && <div>{client.cadence}</div>}
            </div>
          </button>
        </li>
      ))}
    </ul>
    <Table className="max-sm:hidden">
      <TableHeader>
        <TableRow>
          <SortableHeader field="company_name">Company</SortableHeader>
          <SortableHeader field="name">Name</SortableHeader>
          <SortableHeader field="role" className="w-[140px]">Role</SortableHeader>
          <SortableHeader field="monthly_fee">Rate</SortableHeader>
          <SortableHeader field="hourly_rate">Hourly</SortableHeader>
          <SortableHeader field="cadence">Cadence</SortableHeader>
          <SortableHeader field="session_duration">Duration</SortableHeader>
          <SortableHeader field="location">Location</SortableHeader>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedClients.map((client) => (
          <TableRow 
            key={client.id} 
            className="cursor-pointer hover:bg-accent transition-colors"
            onClick={() => router.push(`/clients/${client.id}`)}
          >
            <TableCell className={sortField === 'company_name' ? 'font-medium text-foreground' : 'text-muted-foreground'}>
              {client.company_name || '—'}
            </TableCell>
            <TableCell className={sortField === 'name' ? 'font-medium text-foreground' : 'text-muted-foreground'}>
              <span className="inline-flex items-center gap-2">
                {client.name}
                <StatusBadge status={getEffectiveStatus(client)} />
              </span>
            </TableCell>
            <TableCell className={sortField === 'role' ? 'font-medium text-foreground' : 'text-muted-foreground'}>
              <span className="block max-w-[140px] truncate" title={client.role || undefined}>{client.role || '—'}</span>
            </TableCell>
            <TableCell className={sortField === 'monthly_fee' ? 'font-medium text-foreground' : 'text-muted-foreground'}>
              {client.monthly_fee ? `$${client.monthly_fee.toLocaleString()}` : '—'}
            </TableCell>
            <TableCell className={sortField === 'hourly_rate' ? 'font-medium text-foreground' : 'text-muted-foreground'}>
              <span title={hourlyTitle(client)}>{formatHourly(client.hourly_rate)}</span>
            </TableCell>
            <TableCell className={sortField === 'cadence' ? 'font-medium text-foreground' : 'text-muted-foreground'}>
              {client.cadence || '—'}
            </TableCell>
            <TableCell className={sortField === 'session_duration' ? 'font-medium text-foreground' : 'text-muted-foreground'}>
              {formatDuration(client.session_duration)}
            </TableCell>
            <TableCell className={sortField === 'location' ? 'font-medium text-foreground' : 'text-muted-foreground'}>
              {client.location ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {client.location}
                </span>
              ) : '—'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    </>
  )
}

