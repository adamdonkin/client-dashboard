#!/usr/bin/env node

/**
 * Historical Recovery Sync Script
 * 
 * This script runs the enhanced sync-google-calendar Edge Function
 * with historicalRecovery=true to pull the last 3 months of cancelled events.
 * 
 * Usage: node scripts/run_historical_sync.js
 */

const fetch = require('node-fetch');

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'your-anon-key';
const USER_ID = process.env.USER_ID || '4587519f-dd12-4e18-be42-25854f6dfbe3'; // Default user ID

async function runHistoricalSync() {
  console.log('🚀 Starting Historical Recovery Sync...');
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
      throw new Error(`HTTP error! status: ${response.status}`);
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

    // Provide next steps
    console.log('\n🔍 Next Steps:');
    console.log('1. Check your calendar_events table for new cancelled events');
    console.log('2. Run the populate_sessions_from_calendar_events() function');
    console.log('3. Test the get_reschedule_cancel_rate() function');
    console.log('4. Use the debug queries to analyze the results');

  } catch (error) {
    console.error('❌ Error running historical sync:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  runHistoricalSync();
}

module.exports = { runHistoricalSync }; 