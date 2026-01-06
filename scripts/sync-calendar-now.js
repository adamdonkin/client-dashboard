#!/usr/bin/env node
/**
 * Script to manually trigger a calendar sync
 * This will fetch the latest events from Google Calendar and update the database
 */

const https = require('https');

// Load environment variables from frontend/.env.local
const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '../frontend/.env.local');

if (!fs.existsSync(envPath)) {
  console.error('❌ Error: frontend/.env.local not found');
  process.exit(1);
}

const envFile = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1]] = match[2];
  }
});

const SUPABASE_URL = envVars.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Error: Missing Supabase credentials in .env.local');
  process.exit(1);
}

console.log('🔄 Triggering calendar sync...');
console.log('📅 This will update cancelled events from Google Calendar');
console.log('');

// Make request to your sync API endpoint
const url = new URL('/api/sync-calendar', 'http://localhost:3000');

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000, // 60 second timeout
};

const req = https.request(url, options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      if (result.success) {
        console.log('✅ Sync completed successfully!');
        console.log('');
        console.log('📊 Stats:');
        console.log(`  - Events synced: ${result.stats?.synced || 0}`);
        console.log(`  - Cancelled events: ${result.stats?.cancelled || 0}`);
        console.log(`  - Total processed: ${result.stats?.processed || 0}`);
        console.log('');
        console.log('🎉 Your dashboard should now show the correct upcoming sessions');
      } else {
        console.error('❌ Sync failed:', result.error || 'Unknown error');
        process.exit(1);
      }
    } catch (e) {
      console.error('❌ Error parsing response:', e.message);
      console.error('Response:', data);
      process.exit(1);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Request failed:', e.message);
  console.error('');
  console.error('💡 Make sure:');
  console.error('  1. Your local dev server is running (npm run dev)');
  console.error('  2. You are logged in to the dashboard');
  console.error('  3. Your Google Calendar is connected');
  process.exit(1);
});

req.on('timeout', () => {
  console.error('❌ Request timed out after 60 seconds');
  req.destroy();
  process.exit(1);
});

req.end();





