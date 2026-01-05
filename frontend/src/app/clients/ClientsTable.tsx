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

interface ClientRow {
  id: string;
  name: string;
  email: string;
  company_name: string | null;
  location: string | null;
  role: string | null;
  monthly_fee: number | null;
  referral_source?: string | null;
}

type SortField = 'company_name' | 'name' | 'role' | 'location' | 'monthly_fee';
type SortDirection = 'asc' | 'desc';

interface ClientsTableProps {
  clients: ClientRow[];
}

export function ClientsTable({ clients }: ClientsTableProps) {
  const router = useRouter()
  const [sortField, setSortField] = useState<SortField>('company_name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const sortedClients = [...clients].sort((a, b) => {
    let aVal = a[sortField]
    let bVal = b[sortField]

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

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead 
      className="cursor-pointer hover:bg-accent transition-colors select-none"
      onClick={() => handleSort(field)}
    >
      {children}
    </TableHead>
  )

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortableHeader field="company_name">Company</SortableHeader>
          <SortableHeader field="name">Name</SortableHeader>
          <SortableHeader field="role">Role</SortableHeader>
          <SortableHeader field="monthly_fee">Rate</SortableHeader>
          <SortableHeader field="location">Location</SortableHeader>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedClients.map((client) => (
          <TableRow 
            key={client.id} 
            className="cursor-pointer hover:bg-accent transition-colors"
            onClick={() => router.push(`/?client=${client.id}`)}
          >
            <TableCell className={sortField === 'company_name' ? 'font-medium text-foreground' : 'text-muted-foreground'}>
              {client.company_name || '—'}
            </TableCell>
            <TableCell className={sortField === 'name' ? 'font-medium text-foreground' : 'text-muted-foreground'}>
              {client.name}
            </TableCell>
            <TableCell className={sortField === 'role' ? 'font-medium text-foreground' : 'text-muted-foreground'}>
              {client.role || '—'}
            </TableCell>
            <TableCell className={sortField === 'monthly_fee' ? 'font-medium text-foreground' : 'text-muted-foreground'}>
              {client.monthly_fee ? `$${client.monthly_fee.toLocaleString()}` : '—'}
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
  )
}

