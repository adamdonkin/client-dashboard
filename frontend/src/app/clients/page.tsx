import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Users, ArrowLeft } from 'lucide-react'
import { ClientsTable } from './ClientsTable'

interface ClientRow {
  id: string;
  name: string;
  email: string;
  company_name: string | null;
  location: string | null;
  role: string | null;
  monthly_fee: number | null;
}

export default async function ClientsPage() {
  const cookieStore = await cookies()
  const supabase = createServerComponentClient({ cookies: () => cookieStore })

  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    redirect('/auth/login');
  }

  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, name, email, company_name, location, role, monthly_fee')
    .or('is_active.is.null,is_active.eq.true')
    .order('company_name', { ascending: true, nullsFirst: false })

  if (error) {
    console.error('Error fetching clients:', error)
  }

  const clientList: ClientRow[] = clients || []

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
            clientList.length >= 22 ? 'text-danger' : 
            clientList.length >= 20 ? 'text-warning' : 
            'text-success'
          }`}>
            <Users className="h-5 w-5" />
            <span className="text-2xl font-bold">{clientList.length}</span>
          </div>
        </div>
      </div>

      {/* Client List */}
      <Card>
        <CardContent className="pt-6">
          {clientList.length > 0 ? (
            <ClientsTable clients={clientList} />
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

