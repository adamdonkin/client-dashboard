#!/usr/bin/env node
// Parse Granola MCP XML responses and enrich Supabase meeting_notes with summaries/notes
//
// Reads XML-like meeting data from:
//   - .json tool-result files: [{type: "text", text: "<meetings_data>...</meetings_data>"}]
//   - .txt raw XML files: <meetings_data>...</meetings_data>
//
// Usage:
//   node scripts/parse-and-enrich.js <file1> <file2> ...
//   node scripts/parse-and-enrich.js scripts/raw-responses/*.txt /path/to/tool-results/*.json

const fs = require('fs');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

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

function parseMeetingsFromXML(text) {
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

function parseFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');

  if (filePath.endsWith('.json')) {
    try {
      const arr = JSON.parse(content);
      // Tool-result format: [{type: "text", text: "..."}]
      if (Array.isArray(arr)) {
        const text = arr.map(e => e.text || '').join('');
        return parseMeetingsFromXML(text);
      }
      return [];
    } catch (e) {
      console.error(`  Failed to parse JSON ${filePath}:`, e.message);
      return [];
    }
  } else {
    // Raw XML text
    return parseMeetingsFromXML(content);
  }
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
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error('Usage: node parse-and-enrich.js <file1> <file2> ...');
    process.exit(1);
  }

  let totalParsed = 0;
  let totalUpdated = 0;
  let totalFailed = 0;

  for (const file of files) {
    if (!fs.existsSync(file)) {
      console.error(`File not found: ${file}`);
      continue;
    }

    const meetings = parseFile(file);
    console.log(`${file}: ${meetings.length} meetings parsed`);
    totalParsed += meetings.length;

    for (const m of meetings) {
      try {
        const updated = await updateSupabase(m);
        if (updated) {
          totalUpdated++;
          process.stdout.write('.');
        }
      } catch (e) {
        totalFailed++;
        console.error(`\n  Error: ${e.message}`);
      }
    }
    if (meetings.length > 0) console.log('');
  }

  console.log(`\nDone: ${totalParsed} parsed, ${totalUpdated} updated, ${totalFailed} failed`);
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
