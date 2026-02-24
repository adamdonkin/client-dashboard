/**
 * Populate Sessions from Calendar Events
 * 
 * This script runs the populate_sessions_from_calendar_events function
 * to create session records from calendar events data.
 * 
 * Usage: node scripts/run_populate_sessions.js
 */

// Configuration - Uses environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY before running this script');
  process.exit(1);
}

async function runPopulateSessions() {
  console.log('🚀 Running Populate Sessions from Calendar Events...');
  console.log('⏳ This will create session records from calendar events...\n');

  try {
    // Call the populate_sessions_from_calendar_events function via RPC
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/populate_sessions_from_calendar_events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
    }

    const result = await response.json();
    
    console.log('✅ Populate Sessions Complete!\n');
    console.log('📊 Results:');
    console.log(JSON.stringify(result, null, 2));

    console.log('\n🔍 Next Steps:');
    console.log('1. Check your sessions table for new session records');
    console.log('2. Test: SELECT get_reschedule_cancel_rate();');
    console.log('3. Use the debug queries to analyze the results');
    console.log('\n✅ Sessions populated successfully!');

  } catch (error) {
    console.error('❌ Error running populate sessions:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

// Run the script once and exit
runPopulateSessions(); 