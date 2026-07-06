'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import ClientDetail from '@/components/ClientDetail'
import { Client, ClientStatus } from '@/components/types'

interface ClientDetailPageProps {
  params: Promise<{ id: string }>
}

export default function ClientDetailPage({ params }: ClientDetailPageProps) {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchClient = async () => {
      // Await the params promise (Next.js 15+)
      const { id } = await params
      
      // Check auth
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth/login')
        return
      }

      // Fetch client
      const { data, error: fetchError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .single()

      if (fetchError || !data) {
        console.error('Error fetching client:', fetchError)
        setError('Client not found')
        setLoading(false)
        return
      }

      // Transform to Client type
      const clientData: Client = {
        id: data.id,
        client_name: data.name,
        client_email: data.email,
        company_name: data.company_name,
        role: data.role,
        slack: data.slack,
        granola_notes_folder: data.granola_notes_folder,
        defacto_meeting: data.defacto_meeting,
        is_active: data.is_active,
        status: (data.status || (data.is_active === false ? 'inactive' : 'active')) as ClientStatus,
        monthly_fee: data.monthly_fee,
        notes: data.notes,
        phone: data.phone,
        location: data.location,
        ea_name: data.ea_name,
        ea_email: data.ea_email,
        ea_slack: data.ea_slack,
        cadence: data.cadence,
        session_duration: data.session_duration,
      }

      setClient(clientData)
      setLoading(false)
    }

    fetchClient()
  }, [params, router, supabase])

  const handleClientUpdate = (updatedClient: Client) => {
    setClient(updatedClient)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-24 mb-6"></div>
            <div className="flex items-center space-x-4 mb-6">
              <div className="w-16 h-16 bg-muted rounded-full"></div>
              <div className="space-y-2">
                <div className="h-6 bg-muted rounded w-32"></div>
                <div className="h-4 bg-muted rounded w-24"></div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="h-32 bg-muted rounded"></div>
              <div className="h-32 bg-muted rounded"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !client) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto text-center py-12">
          <h1 className="text-2xl font-bold mb-4">Client Not Found</h1>
          <p className="text-muted-foreground mb-6">{error || 'The requested client could not be found.'}</p>
          <button
            onClick={() => router.push('/clients')}
            className="text-primary hover:underline"
          >
            View Clients
          </button>
        </div>
      </div>
    )
  }

  return (
    <ClientDetail
      client={client}
      onBack={() => router.push('/clients')}
      onClientUpdate={handleClientUpdate}
    />
  )
}
