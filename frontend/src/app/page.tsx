import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { CoachingDashboard } from "@/components/CoachingDashboard"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"
import { redirect } from 'next/navigation'

// Transform your database data to match ClientListView props
const transformClientData = (dbClients: any[]) => {
  return dbClients.map(client => ({
    id: client.client_id,
    name: client.client_name,
    email: client.client_email,
    slack: client.slack,
    lastSession: client.last_session_date,
    nextSession: client.next_session_date
  }))
}

export default async function Home() {
  const cookieStore = await cookies()
  const supabase = createServerComponentClient({ cookies: () => cookieStore })

  // Check if user is authenticated
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    // This will be handled by ProtectedRoute, but good to check server-side too
    return <ProtectedRoute><div /></ProtectedRoute>
  }

  // Fetch all data using the auth-enabled functions
  const [
    needsSchedulingData,
    thisWeekData,
    futureData,
    dashboardStatsData,
    // Add the stats function calls
    sessionsThisWeek,
    avgSessionsPerWeek,
    avgSessionsPerMonth,
    rescheduleRate
  ] = await Promise.all([
    supabase.rpc('get_clients_needs_scheduling'),
    supabase.rpc('get_clients_this_week'),
    supabase.rpc('get_clients_future'),
    supabase.rpc('get_scheduling_dashboard'),
    // Stats function calls
    supabase.rpc('get_sessions_this_week'),
    supabase.rpc('get_avg_sessions_per_week'),
    supabase.rpc('get_avg_sessions_per_month'),
    supabase.rpc('get_reschedule_cancel_rate')
  ])

  // Check for errors
  if (needsSchedulingData.error) console.error('Error fetching needs scheduling:', needsSchedulingData.error)
  if (thisWeekData.error) console.error('Error fetching this week:', thisWeekData.error)
  if (futureData.error) console.error('Error fetching future:', futureData.error)
  if (dashboardStatsData.error) console.error('Error fetching dashboard stats:', dashboardStatsData.error)
  
  // Log stats errors if any
  if (sessionsThisWeek.error) console.error('Error fetching sessions this week:', sessionsThisWeek.error)
  if (avgSessionsPerWeek.error) console.error('Error fetching avg sessions per week:', avgSessionsPerWeek.error)
  if (avgSessionsPerMonth.error) console.error('Error fetching avg sessions per month:', avgSessionsPerMonth.error)
  if (rescheduleRate.error) console.error('Error fetching reschedule rate:', rescheduleRate.error)

  const totalClients = dashboardStatsData.data?.[0]?.total_clients || 0

  // Create stats object to pass to dashboard
  const statsData = {
    sessionsThisWeek: sessionsThisWeek.data || 0,
    avgSessionsPerWeek: avgSessionsPerWeek.data || 0,
    avgSessionsPerMonth: avgSessionsPerMonth.data || 0,
    rescheduleRate: rescheduleRate.data || 0
  }

  return (
    <ProtectedRoute>
      <main>
        <CoachingDashboard
          needsScheduling={transformClientData(needsSchedulingData.data || [])}
          thisWeek={transformClientData(thisWeekData.data || [])}
          future={transformClientData(futureData.data || [])}
          totalClients={totalClients}
          statsData={statsData}
        />
      </main>
    </ProtectedRoute>
  )
}