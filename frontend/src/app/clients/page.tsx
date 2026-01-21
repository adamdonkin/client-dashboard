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

// Capacity: 9 blocks per week (each block = 90 min, 4 blocks/day)
const TOTAL_BLOCKS_PER_WEEK = 9;

// Helper: Convert cadence to blocks per week
const getCadenceBlocksPerWeek = (cadence: string | null): number => {
  if (!cadence) return 0.5; // Default to biweekly
  const lower = cadence.toLowerCase();
  if (lower.includes('weekly') && !lower.includes('bi')) return 1.0;
  if (lower.includes('biweekly') || lower.includes('bi-weekly')) return 0.5;
  if (lower.includes('three weeks')) return 0.33;
  if (lower.includes('monthly')) return 0.25;
  return 0.5; // Default
};

// Helper: Format currency
const formatCurrency = (amount: number): string => {
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1)}k`;
  }
  return `$${amount.toLocaleString()}`;
};

// Helper: Format blocks (no decimal if whole number)
const formatBlocks = (blocks: number): string => {
  return blocks % 1 === 0 ? blocks.toString() : blocks.toFixed(1);
};

export default function ClientsPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const [clients, setClients] = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [revenueFilter, setRevenueFilter] = useState<RevenueFilterType>('mochary-method')
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
  
  // Helper to filter by revenue source
  const applyRevenueFilter = (clientList: ClientRow[]) => {
    if (revenueFilter === 'mochary-method') {
      return clientList.filter(c => c.referral_source === 'Mochary Method');
    }
    return clientList;
  };

  // Get clients by status (before revenue filter)
  const clientsByStatus = {
    active: clients.filter(c => getEffectiveStatus(c) === 'active'),
    pending: clients.filter(c => getEffectiveStatus(c) === 'pending'),
    waiting: clients.filter(c => getEffectiveStatus(c) === 'waiting'),
    inactive: clients.filter(c => getEffectiveStatus(c) === 'inactive'),
    all: clients.filter(c => ['active', 'pending'].includes(getEffectiveStatus(c))),
  };

  // Calculate stats for each tab (with revenue filter applied)
  const calculateTabStats = (clientList: ClientRow[]) => {
    const filtered = applyRevenueFilter(clientList);
    const count = filtered.length;
    const revenue = filtered.reduce((sum, c) => sum + (c.monthly_fee || 0), 0);
    const blocks = filtered.reduce((sum, c) => sum + getCadenceBlocksPerWeek(c.cadence), 0);
    return { count, revenue, blocks };
  };

  const tabStats = {
    active: calculateTabStats(clientsByStatus.active),
    pending: calculateTabStats(clientsByStatus.pending),
    waiting: calculateTabStats(clientsByStatus.waiting),
    inactive: { count: clientsByStatus.inactive.length, revenue: 0, blocks: 0 },
    all: calculateTabStats(clientsByStatus.all),
  };

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
          {statusFilter !== 'inactive' ? (
            <div className="flex items-baseline gap-6">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-foreground">{formatCurrency(tabStats[statusFilter].revenue)}</span>
                <span className="text-sm text-muted-foreground">/mo</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className={`text-2xl font-bold ${
                  tabStats[statusFilter].blocks > TOTAL_BLOCKS_PER_WEEK ? 'text-danger' :
                  tabStats[statusFilter].blocks >= TOTAL_BLOCKS_PER_WEEK - 1 ? 'text-warning' :
                  'text-success'
                }`}>
                  {formatBlocks(tabStats[statusFilter].blocks)}
                </span>
                <span className="text-sm text-muted-foreground">/ {TOTAL_BLOCKS_PER_WEEK} blocks</span>
              </div>
              <div className={`flex items-baseline gap-2 ${
                filteredClients.length >= 20 ? 'text-danger' : 
                filteredClients.length >= 18 ? 'text-warning' : 
                'text-success'
              }`}>
                <Users className="h-5 w-5" />
                <span className="text-2xl font-bold">{filteredClients.length}</span>
              </div>
            </div>
          ) : (
            <div className={`flex items-baseline gap-2 text-muted-foreground`}>
              <Users className="h-5 w-5" />
              <span className="text-2xl font-bold">{filteredClients.length}</span>
            </div>
          )}
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
          Current ({tabStats.all.count})
        </button>
        <button
          onClick={() => setStatusFilter('active')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            statusFilter === 'active'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Active ({tabStats.active.count})
        </button>
        <button
          onClick={() => setStatusFilter('pending')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            statusFilter === 'pending'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Pending ({tabStats.pending.count})
        </button>
        <button
          onClick={() => setStatusFilter('waiting')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            statusFilter === 'waiting'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Waitlist ({tabStats.waiting.count})
        </button>
        <button
          onClick={() => setStatusFilter('inactive')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            statusFilter === 'inactive'
              ? 'border-gray-500 text-gray-600 dark:text-gray-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Inactive ({tabStats.inactive.count})
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

