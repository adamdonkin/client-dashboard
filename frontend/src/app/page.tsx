import { supabase } from "@/lib/supabaseClient";
import { CoachingDashboard } from "@/components/CoachingDashboard";

export default async function Home() {
  // We will fetch all data in parallel for speed
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
  ]);

  // --- Add these lines for debugging ---
  console.log("--- DEBUGGING DATA ---");
  console.log("Needs Scheduling:", JSON.stringify(needsSchedulingData, null, 2));
  console.log("This Week:", JSON.stringify(thisWeekData, null, 2));
  console.log("Future:", JSON.stringify(futureData, null, 2));
  console.log("Dashboard Stats:", JSON.stringify(dashboardStatsData, null, 2));
  console.log("----------------------");
  // ------------------------------------

  // Check for errors, though we'll just log them for now
  if (needsSchedulingData.error) console.error('Error fetching needs scheduling:', needsSchedulingData.error);
  if (thisWeekData.error) console.error('Error fetching this week:', thisWeekData.error);
  if (futureData.error) console.error('Error fetching future:', futureData.error);
  if (dashboardStatsData.error) console.error('Error fetching stats:', dashboardStatsData.error);
  
  // The RPC call for stats returns an array with one object, so we get the first item.
  const totalClients = dashboardStatsData.data?.[0]?.total_clients || 0;

  return (
    <main>
      <CoachingDashboard 
        needsScheduling={needsSchedulingData.data || []}
        thisWeek={thisWeekData.data || []}
        future={futureData.data || []}
        totalClients={totalClients}
      />
    </main>
  );
}