import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { CoachingDashboard } from "@/components/CoachingDashboard"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"
import { redirect } from 'next/navigation'

export default async function Home() {
  const cookieStore = await cookies()
  const supabase = createServerComponentClient({ cookies: () => cookieStore })
  
  // Check if user is authenticated
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    // This will be handled by ProtectedRoute, but good to check server-side too
    return <ProtectedRoute><div /></ProtectedRoute>
  }

  // Fetch data using the new auth-enabled functions (no user_id parameter needed)
  const [
    needsSchedulingData,
    thisWeekData,
    futureData,
    dashboardStatsData
  ] = await Promise.all([
    supabase.rpc('get_clients_needs_scheduling'),
    supabase.rpc('get_clients_this_week'),
    supabase.rpc('get_clients_future'),
    supabase.rpc('get_scheduling_dashboard')
  ])

  // Check for errors
  if (needsSchedulingData.error) console.error('Error fetching needs scheduling:', needsSchedulingData.error)
  if (thisWeekData.error) console.error('Error fetching this week:', thisWeekData.error)
  if (futureData.error) console.error('Error fetching future:', futureData.error)
  if (dashboardStatsData.error) console.error('Error fetching stats:', dashboardStatsData.error)

  const totalClients = dashboardStatsData.data?.[0]?.total_clients || 0

  return (
    <ProtectedRoute>
      <main>
        <CoachingDashboard
          needsScheduling={needsSchedulingData.data || []}
          thisWeek={thisWeekData.data || []}
          future={futureData.data || []}
          totalClients={totalClients}
        />
      </main>
    </ProtectedRoute>
  )
}