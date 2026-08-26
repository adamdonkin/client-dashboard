import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 300

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.log('[cron] Auth failed. CRON_SECRET set:', !!process.env.CRON_SECRET)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  console.log('[cron] Starting. supabaseUrl:', supabaseUrl, 'serviceKey set:', !!serviceKey, 'anonKey set:', !!anonKey)
  const supabase = createClient(supabaseUrl, serviceKey)

  try {
    // --- Step 0: Resolve the coach (owner) user ---
    // Query calendar_events for the actual owner instead of auth.admin.listUsers,
    // which may return a team member (e.g. Trishia) first.
    const { data: ownerRow } = await supabase
      .from('clients')
      .select('user_id')
      .limit(1)
      .single()
    const userId = ownerRow?.user_id
    console.log('[cron] Owner user:', userId)
    if (!userId) {
      return NextResponse.json({ success: false, message: 'No owner user found in clients table' })
    }

    // --- Step 1: Sync Google Calendar ---
    console.log('[cron] Step 1: Syncing calendar...')
    try {
      const syncRes = await fetch(
        `${supabaseUrl}/functions/v1/sync-google-calendar`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${anonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ user_id: userId }),
        }
      )
      if (syncRes.ok) {
        const syncResult = await syncRes.json()
        console.log('[cron] Calendar sync complete:', syncResult.message || syncResult)
      } else {
        const errText = await syncRes.text()
        console.error('[cron] Calendar sync failed:', syncRes.status, errText)
      }
    } catch (syncErr) {
      console.error('[cron] Calendar sync error:', syncErr)
    }

    // --- Step 2: Generate pre-reads ---
    console.log('[cron] Step 2: Generating pre-reads...')
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric', month: '2-digit', day: '2-digit',
    })
    const todayDate = formatter.format(now)

    // Compute Pacific midnight in UTC by finding the offset
    const pacificMidnight = new Date(`${todayDate}T00:00:00`)
    const utcFormatted = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }))
    const pacificFormatted = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
    const offsetMs = utcFormatted.getTime() - pacificFormatted.getTime()
    const dayStart = new Date(pacificMidnight.getTime() + offsetMs).toISOString()
    const dayEnd = new Date(pacificMidnight.getTime() + offsetMs + 24 * 60 * 60 * 1000 - 1000).toISOString()
    console.log('[cron] Date range:', { todayDate, dayStart, dayEnd })

    const { data: events, error: eventsError } = await supabase
      .from('calendar_events')
      .select('id, title, client_id')
      .gte('start_time', dayStart)
      .lte('start_time', dayEnd)
      .not('client_id', 'is', null)
      .eq('user_id', userId)

    console.log('[cron] Events found:', events?.length || 0, 'error:', eventsError?.message || 'none',
      'titles:', events?.map(e => e.title))

    if (!events || events.length === 0) {
      return NextResponse.json({ success: true, calendarSynced: true, message: 'No sessions today', generated: 0 })
    }

    const eventIds = events.map(e => e.id)
    const { data: existingPreReads } = await supabase
      .from('pre_reads')
      .select('calendar_event_id, status')
      .in('calendar_event_id', eventIds)

    const readySet = new Set((existingPreReads || []).filter(pr => pr.status === 'ready').map(pr => pr.calendar_event_id))
    const needsGeneration = events.filter(e => !readySet.has(e.id))

    console.log('[cron] Need generation:', needsGeneration.length, 'of', events.length)

    if (needsGeneration.length === 0) {
      return NextResponse.json({ success: true, calendarSynced: true, message: 'All pre-reads already ready', generated: 0 })
    }

    const generateOne = async (event: { id: string; title: string }) => {
      console.log('[cron] Generating pre-read for:', event.title)
      try {
        const res = await fetch(
          `${supabaseUrl}/functions/v1/generate-pre-reads`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${anonKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              user_id: userId,
              date: todayDate,
              calendar_event_id: event.id,
            }),
          }
        )

        if (res.ok) {
          console.log('[cron] Success:', event.title)
          return { title: event.title, success: true }
        }
        const errText = await res.text()
        console.error('[cron] Failed:', event.title, 'status:', res.status, 'body:', errText)
        return { title: event.title, success: false }
      } catch (err) {
        console.error('[cron] Error:', event.title, err)
        return { title: event.title, success: false }
      }
    }

    // Each invocation independently pages through the whole Granola note list, so starting
    // every session at once put enough load on Granola to get rate-limited, which used to
    // cost the session write-up silently. A small pool keeps the run parallel but under the
    // limit; two sessions at a time still finishes well inside the 300s budget.
    const CONCURRENCY = 2
    const queue = [...needsGeneration]
    const results: { title: string; success: boolean }[] = []

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
        for (let event = queue.shift(); event; event = queue.shift()) {
          results.push(await generateOne(event))
        }
      })
    )

    const generated = results.filter(r => r.success).length
    const result = { success: true, calendarSynced: true, generated, total: needsGeneration.length }
    console.log('[cron] Done:', result)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[cron] Top-level error:', error)
    return NextResponse.json({ success: false, message: `${error}` }, { status: 500 })
  }
}
