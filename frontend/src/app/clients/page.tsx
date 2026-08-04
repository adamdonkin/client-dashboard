'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Users, Plus } from 'lucide-react'
import { ClientsTable } from './ClientsTable'
import { RevenueFilter, type RevenueFilterType } from '@/components/RevenueFilter'

type ClientStatus = 'active' | 'pending' | 'waiting' | 'inactive' | 'staff';

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

type StatusFilter = 'active' | 'pending' | 'waiting' | 'inactive' | 'staff' | 'all';

const statusLabels: Record<string, string> = {
  active: 'Active',
  pending: 'Pending',
  waiting: 'Waitlist',
  inactive: 'Inactive',
  staff: 'Staff',
};

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

interface NewClientForm {
  name: string;
  email: string;
  company_name: string;
  role: string;
  location: string;
  monthly_fee: string;
  cadence: string;
  session_duration: string;
  status: ClientStatus;
  referral_source: string;
  referred_by: string;
}

const initialFormState: NewClientForm = {
  name: '',
  email: '',
  company_name: '',
  role: '',
  location: '',
  monthly_fee: '',
  cadence: 'Biweekly',
  session_duration: '90 min',
  status: 'pending',
  referral_source: 'Matt Mochary',
  referred_by: '',
};

export default function ClientsPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const [clients, setClients] = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [revenueFilter, setRevenueFilter] = useState<RevenueFilterType>('mochary-method')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  
  // Add client dialog state
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [newClient, setNewClient] = useState<NewClientForm>(initialFormState)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  
  // Enum options from database
  const [cadenceOptions, setCadenceOptions] = useState<string[]>([])
  const [durationOptions, setDurationOptions] = useState<string[]>([])
  const [referralOptions, setReferralOptions] = useState<string[]>([])
  const [statusOptions, setStatusOptions] = useState<string[]>([])

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth/login')
      } else {
        fetchClients()
        fetchEnumOptions()
      }
    }
    checkAuth()
  }, [])
  
  // Fetch enum values from database
  const fetchEnumOptions = async () => {
    // Fetch cadence enum values
    const { data: cadenceData, error: cadenceError } = await supabase
      .rpc('get_enum_values', { enum_name: 'cadence' });
    if (cadenceError) {
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
    
    // Fetch referral_source enum values
    const { data: referralData, error: referralError } = await supabase
      .rpc('get_enum_values', { enum_name: 'referral_source' });
    if (referralError) {
      // Fallback to querying distinct values from clients table
      const { data: fallbackReferral } = await supabase
        .from('clients')
        .select('referral_source')
        .not('referral_source', 'is', null);
      if (fallbackReferral) {
        const uniqueReferrals = [...new Set(fallbackReferral.map(r => r.referral_source).filter(Boolean))];
        setReferralOptions(uniqueReferrals as string[]);
      }
    } else if (referralData) {
      setReferralOptions(referralData.map((row: { value: string }) => row.value));
    }

    // Fetch client_status enum values
    const { data: statusData, error: statusError } = await supabase
      .rpc('get_enum_values', { enum_name: 'client_status' });
    if (statusError) {
      setStatusOptions(['active', 'pending', 'waiting', 'inactive', 'staff']);
    } else if (statusData) {
      setStatusOptions(statusData.map((row: { value: string }) => row.value));
    }
  }

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
  
  const handleAddClient = async () => {
    // Validate required fields
    if (!newClient.name.trim()) {
      setSaveError('Name is required')
      return
    }
    if (!newClient.email.trim()) {
      setSaveError('Email is required')
      return
    }
    
    setIsSaving(true)
    setSaveError(null)
    
    try {
      // Get the current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setSaveError('Not authenticated')
        setIsSaving(false)
        return
      }
      
      const clientData = {
        user_id: user.id,
        name: newClient.name.trim(),
        email: newClient.email.trim(),
        company_name: newClient.company_name.trim() || null,
        role: newClient.role.trim() || null,
        location: newClient.location.trim() || null,
        monthly_fee: newClient.monthly_fee ? parseFloat(newClient.monthly_fee) : null,
        cadence: newClient.cadence || null,
        session_duration: newClient.session_duration || null,
        status: newClient.status,
        is_active: newClient.status === 'active' || newClient.status === 'pending' || newClient.status === 'staff',
        referral_source: newClient.referral_source || null,
        referred_by: (newClient.referral_source === 'Adam Donkin' && newClient.referred_by.trim()) ? newClient.referred_by.trim() : null,
      }
      
      const { data, error } = await supabase
        .from('clients')
        .insert(clientData)
        .select()
        .single()
      
      if (error) {
        console.error('Error adding client:', error)
        setSaveError(error.message)
      } else {
        // Reset form and close dialog
        setNewClient(initialFormState)
        setIsAddDialogOpen(false)
        // Refresh clients list
        fetchClients()
        // Navigate to the new client's detail page
        if (data?.id) {
          router.push(`/clients/${data.id}`)
        }
      }
    } catch (err) {
      console.error('Error adding client:', err)
      setSaveError('An unexpected error occurred')
    } finally {
      setIsSaving(false)
    }
  }
  
  const handleFormChange = (field: keyof NewClientForm, value: string) => {
    setNewClient(prev => ({ ...prev, [field]: value }))
    setSaveError(null) // Clear error when user starts typing
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
    
    // Revenue filter (Mochary = everyone except Jessie Barry)
    if (revenueFilter === 'mochary-method' && client.name === 'Jessie Barry') {
      return false;
    }
    
    return true;
  })
  
  // Helper to filter by revenue source (excludes Jessie Barry)
  const applyRevenueFilter = (clientList: ClientRow[]) => {
    if (revenueFilter === 'mochary-method') {
      return clientList.filter(c => c.name !== 'Jessie Barry');
    }
    return clientList;
  };

  // Get clients by status (before revenue filter)
  const clientsByStatus = {
    active: clients.filter(c => getEffectiveStatus(c) === 'active'),
    pending: clients.filter(c => getEffectiveStatus(c) === 'pending'),
    waiting: clients.filter(c => getEffectiveStatus(c) === 'waiting'),
    inactive: clients.filter(c => getEffectiveStatus(c) === 'inactive'),
    staff: clients.filter(c => getEffectiveStatus(c) === 'staff'),
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
    staff: { count: clientsByStatus.staff.length, revenue: 0, blocks: 0 },
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
      case 'staff': return 'Staff';
      case 'all': return 'Current Clients'; // Active + Pending
      default: return 'Active Clients';
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-end mb-4">
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1">
                <Plus className="h-4 w-4" />
                Add Client
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Add New Client</DialogTitle>
                <DialogDescription>
                  Enter the details for the new client. Name and email are required.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                {saveError && (
                  <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                    {saveError}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">Name *</label>
                    <input
                      type="text"
                      value={newClient.name}
                      onChange={(e) => handleFormChange('name', e.target.value)}
                      className="w-full mt-1 px-3 py-2 text-sm border rounded-md bg-background"
                      placeholder="John Smith"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Email *</label>
                    <input
                      type="email"
                      value={newClient.email}
                      onChange={(e) => handleFormChange('email', e.target.value)}
                      className="w-full mt-1 px-3 py-2 text-sm border rounded-md bg-background"
                      placeholder="john@company.com"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Company</label>
                    <input
                      type="text"
                      value={newClient.company_name}
                      onChange={(e) => handleFormChange('company_name', e.target.value)}
                      className="w-full mt-1 px-3 py-2 text-sm border rounded-md bg-background"
                      placeholder="Acme Inc."
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Role</label>
                    <input
                      type="text"
                      value={newClient.role}
                      onChange={(e) => handleFormChange('role', e.target.value)}
                      className="w-full mt-1 px-3 py-2 text-sm border rounded-md bg-background"
                      placeholder="CEO"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Location</label>
                    <input
                      type="text"
                      value={newClient.location}
                      onChange={(e) => handleFormChange('location', e.target.value)}
                      className="w-full mt-1 px-3 py-2 text-sm border rounded-md bg-background"
                      placeholder="San Francisco"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Monthly Fee</label>
                    <input
                      type="number"
                      value={newClient.monthly_fee}
                      onChange={(e) => handleFormChange('monthly_fee', e.target.value)}
                      className="w-full mt-1 px-3 py-2 text-sm border rounded-md bg-background"
                      placeholder="5000"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Cadence</label>
                    <select
                      value={newClient.cadence}
                      onChange={(e) => handleFormChange('cadence', e.target.value)}
                      className="w-full mt-1 px-3 py-2 text-sm border rounded-md bg-background"
                    >
                      <option value="">Select...</option>
                      {cadenceOptions.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Duration</label>
                    <select
                      value={newClient.session_duration}
                      onChange={(e) => handleFormChange('session_duration', e.target.value)}
                      className="w-full mt-1 px-3 py-2 text-sm border rounded-md bg-background"
                    >
                      <option value="">Select...</option>
                      {durationOptions.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Status</label>
                    <select
                      value={newClient.status}
                      onChange={(e) => handleFormChange('status', e.target.value as ClientStatus)}
                      className="w-full mt-1 px-3 py-2 text-sm border rounded-md bg-background"
                    >
                      {(statusOptions.length > 0 ? statusOptions : ['active', 'pending', 'waiting', 'inactive', 'staff']).map(opt => (
                        <option key={opt} value={opt}>{statusLabels[opt] || opt}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Referral Source</label>
                    <select
                      value={newClient.referral_source}
                      onChange={(e) => handleFormChange('referral_source', e.target.value)}
                      className="w-full mt-1 px-3 py-2 text-sm border rounded-md bg-background"
                    >
                      <option value="">Select...</option>
                      {referralOptions.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                  {newClient.referral_source === 'Adam Donkin' && (
                    <div>
                      <label className="text-sm font-medium">Referred By</label>
                      <input
                        type="text"
                        value={newClient.referred_by}
                        onChange={(e) => handleFormChange('referred_by', e.target.value)}
                        className="w-full mt-1 px-3 py-2 text-sm border rounded-md bg-background"
                        placeholder="Name of referrer"
                      />
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setNewClient(initialFormState)
                    setSaveError(null)
                    setIsAddDialogOpen(false)
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleAddClient}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Add Client'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">{getPageTitle()}</h1>
          {statusFilter !== 'inactive' && statusFilter !== 'staff' ? (
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
        <button
          onClick={() => setStatusFilter('staff')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            statusFilter === 'staff'
              ? 'border-purple-500 text-purple-600 dark:text-purple-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Staff ({tabStats.staff.count})
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

