import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.log('[cron] Auth failed. CRON_SECRET set:', !!process.env.CRON_SECRET)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  console.log('[cron] Starting. supabaseUrl:', supabaseUrl, 'serviceKey set:', !!serviceKey)
  const supabase = createClient(supabaseUrl, serviceKey)

  try {
    const now = new Date()
    const pacific = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
    const todayDate = pacific.toISOString().slice(0, 10)

    const dayStart = new Date(`${todayDate}T00:00:00-07:00`).toISOString()
    const dayEnd = new Date(`${todayDate}T23:59:59-07:00`).toISOString()
    console.log('[cron] Date range:', { todayDate, dayStart, dayEnd, nowUTC: now.toISOString() })

    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers({ perPage: 1 })
    const userId = users?.[0]?.id
    console.log('[cron] User lookup:', { userId, usersError: usersError?.message, userCount: users?.length })
    if (!userId) {
      const msg = `No user found. Error: ${usersError?.message || 'none'}`
      console.log('[cron]', msg)
      return NextResponse.json({ success: false, message: msg })
    }

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
      return NextResponse.json({ success: true, message: 'No sessions today', generated: 0 })
    }

    const eventIds = events.map(e => e.id)
    const { data: existingPreReads } = await supabase
      .from('pre_reads')
      .select('calendar_event_id, status')
      .in('calendar_event_id', eventIds)

    console.log('[cron] Existing pre-reads:', existingPreReads?.map(pr => ({
      event: events.find(e => e.id === pr.calendar_event_id)?.title,
      status: pr.status,
    })))

    const readySet = new Set((existingPreReads || []).filter(pr => pr.status === 'ready').map(pr => pr.calendar_event_id))
    const needsGeneration = events.filter(e => !readySet.has(e.id))

    console.log('[cron] Need generation:', needsGeneration.length, 'titles:', needsGeneration.map(e => e.title))

    if (needsGeneration.length === 0) {
      return NextResponse.json({ success: true, message: 'All pre-reads already ready', generated: 0 })
    }

    let generated = 0
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    console.log('[cron] Anon key set:', !!anonKey)

    for (const event of needsGeneration) {
      console.log('[cron] Generating pre-read for:', event.title, event.id)
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
          generated++
          console.log('[cron] Success:', event.title)
        } else {
          const errText = await res.text()
          console.error('[cron] Failed:', event.title, 'status:', res.status, 'body:', errText)
        }
      } catch (fetchErr) {
        console.error('[cron] Fetch error for', event.title, ':', fetchErr)
      }
    }

    const result = { success: true, generated, total: needsGeneration.length }
    console.log('[cron] Done:', result)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[cron] Top-level error:', error)
    return NextResponse.json({ success: false, message: `${error}` }, { status: 500 })
  }
}
