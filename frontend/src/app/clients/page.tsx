'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Users, ArrowLeft } from 'lucide-react'
import { ClientsTable } from './ClientsTable'
import { RevenueFilter, type RevenueFilterType } from '@/components/RevenueFilter'

interface ClientRow {
  id: string;
  name: string;
  email: string;
  company_name: string | null;
  location: string | null;
  role: string | null;
  monthly_fee: number | null;
  referral_source: string | null;
}

export default function ClientsPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const [clients, setClients] = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [revenueFilter, setRevenueFilter] = useState<RevenueFilterType>('all')

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
      .select('id, name, email, company_name, location, role, monthly_fee, referral_source')
      .or('is_active.is.null,is_active.eq.true')
      .order('company_name', { ascending: true, nullsFirst: false })

    if (error) {
      console.error('Error fetching clients:', error)
    } else {
      setClients(data || [])
    }
    setLoading(false)
  }

  // Filter clients based on revenue filter
  const filteredClients = revenueFilter === 'mochary-method'
    ? clients.filter(client => client.referral_source === 'Mochary Method')
    : clients

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="text-center py-8 text-muted-foreground">
          Loading...
        </div>
      </div>
    )
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
          <h1 className="text-2xl font-bold text-foreground">Active Clients</h1>
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

