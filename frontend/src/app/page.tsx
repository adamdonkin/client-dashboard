import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import CoachingDashboard from "@/components/CoachingDashboard"
import { redirect } from 'next/navigation'
import { Client } from '@/components/types'

const transformClientData = (dbClients: any[] | null): Client[] => {
  if (!dbClients) {
    return [];
  }
  return dbClients.map(client => ({
    ...client,
    id: client.client_id || client.id,
    status: client.is_active ? 'active' : 'inactive',
  }));
}

export default async function Home() {
  const cookieStore = cookies()
  const supabase = createServerComponentClient({ cookies: () => cookieStore })

  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    redirect('/auth/login');
  }

  const [
    needsSchedulingData,
    thisWeekData,
    futureData,
    dashboardStatsData,
    sessionsThisWeek,
    avgSessionsPerWeek,
    avgSessionsPerMonth,
    rescheduleRate,
    revenueStats
  ] = await Promise.all([
    supabase.rpc('get_clients_needs_scheduling'),
    supabase.rpc('get_clients_this_week_fixed'),
    supabase.rpc('get_clients_future'),
    supabase.rpc('get_scheduling_dashboard'),
    supabase.rpc('get_sessions_this_week'),
    supabase.rpc('get_avg_sessions_per_week'),
    supabase.rpc('get_avg_sessions_per_month'),
    supabase.rpc('get_reschedule_cancel_rate'),
    supabase.rpc('get_revenue_stats')
  ])

  const error = 
    needsSchedulingData.error ||
    thisWeekData.error ||
    futureData.error ||
    dashboardStatsData.error ||
    sessionsThisWeek.error ||
    avgSessionsPerWeek.error ||
    avgSessionsPerMonth.error ||
    rescheduleRate.error ||
    revenueStats.error;

  if (needsSchedulingData.error) console.error('get_clients_needs_scheduling error:', needsSchedulingData.error)
  if (thisWeekData.error) console.error('get_clients_this_week error:', thisWeekData.error)  
  if (futureData.error) console.error('get_clients_future error:', futureData.error)
  if (dashboardStatsData.error) console.error('get_scheduling_dashboard error:', dashboardStatsData.error)
  if (sessionsThisWeek.error) console.error('get_sessions_this_week error:', sessionsThisWeek.error)
  if (avgSessionsPerWeek.error) console.error('get_avg_sessions_per_week error:', avgSessionsPerWeek.error)
  if (avgSessionsPerMonth.error) console.error('get_avg_sessions_per_month error:', avgSessionsPerMonth.error)
  if (rescheduleRate.error) console.error('get_reschedule_cancel_rate error:', rescheduleRate.error)
  if (revenueStats.error) console.error('get_revenue_stats error:', revenueStats.error)

  // Also log what data we're getting
  console.log('thisWeekData.data:', thisWeekData.data)
  console.log('futureData.data:', futureData.data)

  if (error) {
    console.error('Error fetching dashboard data:', error)
  }

  const totalClients = dashboardStatsData.data?.[0]?.total_clients || 0

  const statsData = {
    sessionsThisWeek: sessionsThisWeek.data || 0,
    avgSessionsPerWeek: avgSessionsPerWeek.data || 0,
    avgSessionsPerMonth: avgSessionsPerMonth.data || 0,
    rescheduleRate: rescheduleRate.data || 0,
    revenueStats: (revenueStats.data && revenueStats.data[0]) || {
      total_monthly_revenue: "0",
      annual_projection: "0", 
      active_paying_clients: 0,
      average_client_fee: "0"
    }
  }

  return (
    <main>
      <CoachingDashboard
        needsScheduling={transformClientData(needsSchedulingData.data || [])}
        thisWeek={transformClientData(thisWeekData.data || [])}
        future={transformClientData(futureData.data || [])}
        totalClients={totalClients}
        statsData={statsData}
        error={error?.message || null}
      />
    </main>
  )
}