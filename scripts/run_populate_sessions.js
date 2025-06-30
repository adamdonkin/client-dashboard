/**
 * Populate Sessions from Calendar Events
 * 
 * This script runs the populate_sessions_from_calendar_events function
 * to create session records from calendar events data.
 * 
 * Usage: node scripts/run_populate_sessions.js
 */

// Configuration - Updated for Coaching Dashboard project
const SUPABASE_URL = 'https://bhiwuvjltwvdkhcnwkkt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJoaXd1dmpsdHd2ZGtoY253a2t0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAyNzQ4ODAsImV4cCI6MjA2NTg1MDg4MH0.GpzLOZTvdsWp2eGVKzS3QrS68gF5IQDKOV1iAV-6m8A';

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