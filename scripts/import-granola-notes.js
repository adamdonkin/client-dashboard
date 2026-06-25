#!/usr/bin/env node
// Import Granola meeting notes into Supabase meeting_notes table
//
// Usage:
//   node scripts/import-granola-notes.js
//
// Reads: scripts/matched-meetings.json (required - meeting metadata + client mapping)
// Reads: scripts/meeting-details/*.json (optional - summaries, private notes, participants)
//
// Safe to re-run: uses upsert on granola_meeting_id unique constraint
// DO NOT commit this file with the service role key

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const USER_ID = process.env.SUPABASE_USER_ID;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !USER_ID) {
  console.error('Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_USER_ID');
  process.exit(1);
}

function parseParticipants(raw) {
  if (!raw) return null;
  const results = [];
  // Format: "Name (note creator) from Company <email>, Name from Company <email>"
  const regex = /([^<,]+?)(?:\s*\(note creator\))?\s*(?:from\s+(.+?))?\s*<([^>]+)>/g;
  let match;
  while ((match = regex.exec(raw)) !== null) {
    results.push({
      name: match[1].trim(),
      company: match[2] ? match[2].trim() : null,
      email: match[3].trim()
    });
  }
  return results.length > 0 ? results : null;
}

async function supabaseFetch(method, endpoint, body) {
  const headers = {
    'apikey': SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': method === 'POST'
      ? 'resolution=merge-duplicates,return=minimal'
      : 'return=minimal'
  };
  const res = await fetch(`${SUPABASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${method} ${endpoint}: ${res.status} ${err}`);
  }
  return res;
}

async function main() {
  // 1. Load matched meetings (metadata + client mapping)
  const raw = fs.readFileSync(path.join(__dirname, 'matched-meetings.json'), 'utf8');
  const jsonStart = raw.indexOf('[');
  if (jsonStart === -1) throw new Error('No JSON array found in matched-meetings.json');
  const meetings = JSON.parse(raw.slice(jsonStart));
  console.log(`Loaded ${meetings.length} matched meetings`);

  // 2. Load optional details from meeting-details/ directory
  const details = {};
  const detailsDir = path.join(__dirname, 'meeting-details');
  if (fs.existsSync(detailsDir)) {
    const files = fs.readdirSync(detailsDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const batch = JSON.parse(fs.readFileSync(path.join(detailsDir, file), 'utf8'));
      for (const m of batch) {
        details[m.meeting_id] = m;
      }
    }
    console.log(`Loaded details for ${Object.keys(details).length} meetings`);
  } else {
    console.log('No meeting-details/ directory — inserting metadata only');
  }

  // 3. Phase 1: Upsert basic records (metadata only, won't overwrite existing summaries)
  console.log('\nPhase 1: Upserting basic records...');
  const records = meetings.map(m => ({
    user_id: USER_ID,
    granola_meeting_id: m.meeting_id,
    title: m.title,
    meeting_date: m.meeting_date,
    client_id: m.client_id,
    client_email: m.client_email,
    match_method: 'email',
    source: 'granola'
  }));

  const BATCH_SIZE = 25;
  let insertOk = 0;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    try {
      await supabaseFetch('POST', '/rest/v1/meeting_notes?on_conflict=granola_meeting_id', batch);
      insertOk += batch.length;
      process.stdout.write('.');
    } catch (e) {
      console.error(`\nBatch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, e.message);
    }
  }
  console.log(`\n${insertOk}/${records.length} records upserted`);

  // 4. Phase 2: Enrich records with summaries, private notes, participants
  const detailIds = Object.keys(details);
  if (detailIds.length > 0) {
    console.log(`\nPhase 2: Enriching ${detailIds.length} records with details...`);
    let enrichOk = 0, enrichFail = 0;

    for (const meetingId of detailIds) {
      const d = details[meetingId];
      const update = {};

      if (d.summary) {
        update.summary = d.summary;
        update.word_count = d.summary.split(/\s+/).length;
      }
      if (d.private_notes) update.private_notes = d.private_notes;
      if (d.participants_raw) update.participants = parseParticipants(d.participants_raw);

      if (Object.keys(update).length === 0) continue;

      try {
        await supabaseFetch('PATCH', `/rest/v1/meeting_notes?granola_meeting_id=eq.${meetingId}`, update);
        enrichOk++;
        if (enrichOk % 10 === 0) process.stdout.write('.');
      } catch (e) {
        enrichFail++;
        console.error(`\nFailed ${meetingId}:`, e.message);
      }
    }
    console.log(`\nEnriched: ${enrichOk} OK, ${enrichFail} failed`);
  }

  // 5. Summary
  const withDetails = detailIds.length;
  const metadataOnly = meetings.length - withDetails;
  console.log('\n--- Summary ---');
  console.log(`Total records:    ${meetings.length}`);
  console.log(`With summaries:   ${withDetails}`);
  console.log(`Metadata only:    ${metadataOnly}`);
  if (metadataOnly > 0) {
    console.log('Add more files to scripts/meeting-details/ and re-run to enrich remaining records');
  }
}

main().catch(e => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
