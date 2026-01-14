'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Users, ArrowLeft } from 'lucide-react'
import { ClientsTable } from './ClientsTable'
import { RevenueFilter, type RevenueFilterType } from '@/components/RevenueFilter'

type ClientStatus = 'active' | 'pending' | 'waiting' | 'inactive';

interface ClientRow {
  id: string;
  name: string;
  email: string;
  company_name: string | null;
  location: string | null;
  role: string | null;
  monthly_fee: number | null;
  referral_source: string | null;
  status: ClientStatus | null;
  is_active: boolean | null;
  cadence: string | null;
  session_duration: string | null;
}

type StatusFilter = 'active' | 'pending' | 'waiting' | 'inactive' | 'all';

export default function ClientsPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const [clients, setClients] = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [revenueFilter, setRevenueFilter] = useState<RevenueFilterType>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth/login')
      } else {
        fetchClients()
      }
    }
    checkAuth()
  }, [])

  const fetchClients = async () => {
    setLoading(true)
    
    const { data, error } = await supabase
      .from('clients')
      .select('id, name, email, company_name, location, role, monthly_fee, referral_source, status, is_active, cadence, session_duration')
      .order('company_name', { ascending: true, nullsFirst: false })

    if (error) {
      console.error('Error fetching clients:', error)
    } else {
      setClients(data || [])
    }
    setLoading(false)
  }

  // Get effective status (for backward compatibility with is_active)
  const getEffectiveStatus = (client: ClientRow): ClientStatus => {
    if (client.status) return client.status;
    // Fall back to is_active for legacy data
    if (client.is_active === false) return 'inactive';
    return 'active';
  }

  // Filter clients based on status and revenue filter
  const filteredClients = clients.filter(client => {
    const effectiveStatus = getEffectiveStatus(client);
    
    // Status filter
    if (statusFilter === 'all') {
      // "All" shows active + pending only (not waiting, not inactive)
      if (effectiveStatus !== 'active' && effectiveStatus !== 'pending') {
        return false;
      }
    } else if (effectiveStatus !== statusFilter) {
      return false;
    }
    
    // Revenue filter (Mochary Method)
    if (revenueFilter === 'mochary-method' && client.referral_source !== 'Mochary Method') {
      return false;
    }
    
    return true;
  })
  
  // Count by status for the tabs
  const statusCounts = {
    active: clients.filter(c => getEffectiveStatus(c) === 'active').length,
    pending: clients.filter(c => getEffectiveStatus(c) === 'pending').length,
    waiting: clients.filter(c => getEffectiveStatus(c) === 'waiting').length,
    inactive: clients.filter(c => getEffectiveStatus(c) === 'inactive').length,
    all: clients.filter(c => ['active', 'pending'].includes(getEffectiveStatus(c))).length,
  }

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="text-center py-8 text-muted-foreground">
          Loading...
        </div>
      </div>
    )
  }

  // Get the title based on status filter
  const getPageTitle = () => {
    switch (statusFilter) {
      case 'pending': return 'Pending Clients';
      case 'waiting': return 'Waitlist';
      case 'inactive': return 'Inactive Clients';
      case 'all': return 'Current Clients'; // Active + Pending
      default: return 'Active Clients';
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link 
          href="/" 
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Dashboard
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">{getPageTitle()}</h1>
          <div className={`flex items-center gap-2 font-medium ${
            filteredClients.length >= 20 ? 'text-danger' : 
            filteredClients.length >= 18 ? 'text-warning' : 
            'text-success'
          }`}>
            <Users className="h-5 w-5" />
            <span className="text-2xl font-bold">{filteredClients.length}</span>
          </div>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1 mb-4 border-b">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            statusFilter === 'all'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Current ({statusCounts.all})
        </button>
        <button
          onClick={() => setStatusFilter('active')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            statusFilter === 'active'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Active ({statusCounts.active})
        </button>
        <button
          onClick={() => setStatusFilter('pending')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            statusFilter === 'pending'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Pending ({statusCounts.pending})
        </button>
        <button
          onClick={() => setStatusFilter('waiting')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            statusFilter === 'waiting'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Waitlist ({statusCounts.waiting})
        </button>
        <button
          onClick={() => setStatusFilter('inactive')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            statusFilter === 'inactive'
              ? 'border-gray-500 text-gray-600 dark:text-gray-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Inactive ({statusCounts.inactive})
        </button>
      </div>

      {/* Revenue Filter */}
      <RevenueFilter value={revenueFilter} onChange={setRevenueFilter} />

      {/* Client List */}
      <Card>
        <CardContent className="pt-6">
          {filteredClients.length > 0 ? (
            <ClientsTable clients={filteredClients} />
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No active clients found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

