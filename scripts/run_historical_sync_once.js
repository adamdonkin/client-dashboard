/**
 * One-time Historical Recovery Sync
 * 
 * This script runs the historical recovery sync once to pull the last 3 months
 * of cancelled events, then exits. Run this once to populate your database.
 * 
 * Usage: node scripts/run_historical_sync_once.js
 */

// Configuration - Uses environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const USER_ID = process.env.SUPABASE_USER_ID || '4587519f-dd12-4e18-be42-25854f6dfbe3';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY before running this script');
  process.exit(1);
}

async function runHistoricalSyncOnce() {
  console.log('🚀 Running One-time Historical Recovery Sync...');
  console.log(`📅 Fetching events from last 3 months for user: ${USER_ID}`);
  console.log('⏳ This may take a few minutes...\n');

  try {
    // Call the sync-google-calendar Edge Function with historical recovery
    const response = await fetch(`${SUPABASE_URL}/functions/v1/sync-google-calendar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        user_id: USER_ID,
        historicalRecovery: true,
        includeDeleted: true
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
    }

    const result = await response.json();
    
    console.log('✅ Historical Recovery Sync Complete!\n');
    console.log('📊 Results:');
    console.log(`   Message: ${result.message}`);
    console.log(`   Success: ${result.success}`);
    
    if (result.stats) {
      console.log('\n📈 Statistics:');
      console.log(`   Total Events Fetched: ${result.stats.totalFetched}`);
      console.log(`   Pages Processed: ${result.stats.pagesProcessed}`);
      console.log(`   Events Processed: ${result.stats.processed}`);
      console.log(`   Events Synced: ${result.stats.synced}`);
      console.log(`   Cancelled Events Tracked: ${result.stats.cancelled}`);
      console.log(`   Historical Events Recovered: ${result.stats.historical || 0}`);
      console.log(`   Errors: ${result.stats.errors}`);
      console.log(`   Client Count: ${result.stats.clientCount}`);
      console.log(`   Time Range: ${result.stats.timeRange.from} to ${result.stats.timeRange.to}`);
      console.log(`   Historical Recovery: ${result.stats.historicalRecovery}`);
    }

    console.log('\n🔍 Next Steps:');
    console.log('1. Check your calendar_events table for new cancelled events');
    console.log('2. Run: SELECT * FROM populate_sessions_from_calendar_events();');
    console.log('3. Test: SELECT get_reschedule_cancel_rate();');
    console.log('4. Use the debug queries to analyze the results');
    console.log('\n✅ Historical sync completed successfully!');

  } catch (error) {
    console.error('❌ Error running historical sync:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

// Run the script once and exit
runHistoricalSyncOnce(); 