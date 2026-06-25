#!/usr/bin/env node
// Extract get_meetings results from conversation transcript and enrich Supabase meeting_notes
//
// Reads the JSONL conversation file, finds all Granola get_meetings tool results,
// parses meeting summaries/notes/participants from the XML, and PATCHes Supabase.
//
// Usage: node scripts/extract-and-enrich.js

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const TRANSCRIPT_FILE = path.join(
  process.env.HOME,
  '.claude/projects/-Users-adamdonkin-Projects-coaching-dashboard/5de2107f-6d00-4b62-9edc-510be043dd3b.jsonl'
);

function parseParticipants(raw) {
  if (!raw) return null;
  const results = [];
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

function parseMeetingsFromText(text) {
  const meetings = [];
  const meetingRegex = /<meeting id="([^"]+)"[^>]*>([\s\S]*?)<\/meeting>/g;
  let match;
  while ((match = meetingRegex.exec(text)) !== null) {
    const id = match[1];
    const body = match[2];
    const summaryMatch = body.match(/<summary>\n?([\s\S]*?)\n?<\/summary>/);
    const notesMatch = body.match(/<private_notes>\n?([\s\S]*?)\n?<\/private_notes>/);
    const participantsMatch = body.match(/<known_participants>\n?([\s\S]*?)\n?\s*<\/known_participants>/);
    meetings.push({
      meeting_id: id,
      summary: summaryMatch ? summaryMatch[1].trim() : null,
      private_notes: notesMatch ? notesMatch[1].trim() : null,
      participants_raw: participantsMatch ? participantsMatch[1].trim() : null
    });
  }
  return meetings;
}

function extractMeetingsFromTranscript() {
  const content = fs.readFileSync(TRANSCRIPT_FILE, 'utf8');
  const lines = content.split('\n').filter(l => l.trim());

  const allMeetings = new Map(); // deduplicate by meeting_id

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);

      // Look for tool results containing meetings_data
      const text = JSON.stringify(entry);
      if (!text.includes('meetings_data') && !text.includes('<meeting id=')) continue;

      // Extract all text content from the entry
      let combinedText = '';

      // Handle various nesting patterns in JSONL entries
      const extractText = (obj) => {
        if (typeof obj === 'string') {
          if (obj.includes('<meeting id=')) combinedText += obj + '\n';
          return;
        }
        if (Array.isArray(obj)) {
          obj.forEach(extractText);
          return;
        }
        if (obj && typeof obj === 'object') {
          for (const val of Object.values(obj)) {
            extractText(val);
          }
        }
      };

      extractText(entry);

      if (combinedText) {
        const meetings = parseMeetingsFromText(combinedText);
        for (const m of meetings) {
          if (m.meeting_id && (m.summary || m.private_notes)) {
            allMeetings.set(m.meeting_id, m);
          }
        }
      }
    } catch (e) {
      // Skip unparseable lines
    }
  }

  // Also check tool-result files
  const toolResultsDir = path.join(
    process.env.HOME,
    '.claude/projects/-Users-adamdonkin-Projects-coaching-dashboard/5de2107f-6d00-4b62-9edc-510be043dd3b/tool-results'
  );

  if (fs.existsSync(toolResultsDir)) {
    const files = fs.readdirSync(toolResultsDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const fileContent = fs.readFileSync(path.join(toolResultsDir, file), 'utf8');
        const arr = JSON.parse(fileContent);
        if (Array.isArray(arr)) {
          const text = arr.map(e => e.text || '').join('');
          const meetings = parseMeetingsFromText(text);
          for (const m of meetings) {
            if (m.meeting_id && (m.summary || m.private_notes)) {
              allMeetings.set(m.meeting_id, m);
            }
          }
        }
      } catch (e) {
        // Skip
      }
    }
  }

  return Array.from(allMeetings.values());
}

async function updateSupabase(meeting) {
  const update = {};
  if (meeting.summary) {
    update.summary = meeting.summary;
    update.word_count = meeting.summary.split(/\s+/).length;
  }
  if (meeting.private_notes) update.private_notes = meeting.private_notes;
  if (meeting.participants_raw) update.participants = parseParticipants(meeting.participants_raw);

  if (Object.keys(update).length === 0) return false;

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/meeting_notes?granola_meeting_id=eq.${meeting.meeting_id}`,
    {
      method: 'PATCH',
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(update)
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PATCH ${meeting.meeting_id}: ${res.status} ${err}`);
  }
  return true;
}

async function main() {
  console.log('Extracting meetings from conversation transcript...');
  const meetings = extractMeetingsFromTranscript();
  console.log(`Found ${meetings.length} meetings with summaries/notes`);

  if (meetings.length === 0) {
    console.log('No meetings found. Check transcript file path.');
    process.exit(1);
  }

  let updated = 0, failed = 0, skipped = 0;

  for (const m of meetings) {
    try {
      const result = await updateSupabase(m);
      if (result) {
        updated++;
        if (updated % 10 === 0) process.stdout.write('.');
      } else {
        skipped++;
      }
    } catch (e) {
      failed++;
      console.error(`\n  Error: ${e.message}`);
    }
  }

  console.log(`\n\nDone: ${meetings.length} found, ${updated} updated, ${skipped} skipped, ${failed} failed`);
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
