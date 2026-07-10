import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const supabase = createClient(supabaseUrl, serviceKey)

  try {
    const now = new Date()
    const pacific = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
    const todayDate = pacific.toISOString().slice(0, 10)

    const dayStart = new Date(`${todayDate}T00:00:00-07:00`).toISOString()
    const dayEnd = new Date(`${todayDate}T23:59:59-07:00`).toISOString()

    // Get the user (single-user app)
    const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1 })
    const userId = users?.[0]?.id
    if (!userId) {
      return NextResponse.json({ success: false, message: 'No user found' })
    }

    // Fetch today's sessions with clients
    const { data: events } = await supabase
      .from('calendar_events')
      .select('id, title, client_id')
      .gte('start_time', dayStart)
      .lte('start_time', dayEnd)
      .not('client_id', 'is', null)
      .eq('user_id', userId)

    if (!events || events.length === 0) {
      return NextResponse.json({ success: true, message: 'No sessions today', generated: 0 })
    }

    // Check which ones already have pre-reads
    const eventIds = events.map(e => e.id)
    const { data: existingPreReads } = await supabase
      .from('pre_reads')
      .select('calendar_event_id')
      .in('calendar_event_id', eventIds)
      .eq('status', 'ready')

    const readySet = new Set((existingPreReads || []).map(pr => pr.calendar_event_id))
    const needsGeneration = events.filter(e => !readySet.has(e.id))

    if (needsGeneration.length === 0) {
      return NextResponse.json({ success: true, message: 'All pre-reads already ready', generated: 0 })
    }

    // Generate pre-reads sequentially
    let generated = 0
    for (const event of needsGeneration) {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-pre-reads`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
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
      } else {
        console.error(`Failed to generate pre-read for ${event.title}:`, await res.text())
      }
    }

    return NextResponse.json({ success: true, generated, total: needsGeneration.length })
  } catch (error) {
    console.error('Cron generate-pre-reads error:', error)
    return NextResponse.json({ success: false, message: `${error}` }, { status: 500 })
  }
}
