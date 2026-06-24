import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { TimezoneContent } from '@/components/TimezoneContent'

export default async function TimezonesPage() {
  const cookieStore = await cookies()
  const supabase = createServerComponentClient({ cookies: () => cookieStore })

  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    redirect('/auth/login');
  }

  const [clientsByRegion, clientReferralSources] = await Promise.all([
    supabase.rpc('get_clients_by_region'),
    supabase.from('clients').select('id, referral_source').eq('user_id', session.user.id)
  ])

  if (clientsByRegion.error) console.error('get_clients_by_region error:', clientsByRegion.error)

  const referralMap: Record<string, string> = {};
  if (clientReferralSources.data) {
    for (const c of clientReferralSources.data) {
      if (c.referral_source) referralMap[c.id] = c.referral_source;
    }
  }

  const clients = (clientsByRegion.data || []).map((c: any) => ({
    ...c,
    referral_source: referralMap[c.client_id],
  }));

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link 
          href="/" 
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-foreground">Client Timezone Distribution</h1>
        <p className="text-muted-foreground mt-1">
          Analyze your client distribution to manage morning slot availability
        </p>
      </div>

      <TimezoneContent clients={clients} />
    </div>
  )
}
