import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { user_id, includeDeleted = false, historicalRecovery = false } = await req.json();
    if (!user_id) {
      throw new Error('user_id is required');
    }
    console.log(`Starting sync for user: ${user_id}, includeDeleted: ${includeDeleted}, historicalRecovery: ${historicalRecovery}`);
    // Get user's current token
    const { data: tokenData, error: tokenError } = await supabase.from('user_tokens').select('*').eq('user_id', user_id).single();
    if (tokenError || !tokenData) {
      throw new Error('No tokens found for user');
    }
    // Check if token needs refresh (expires within 10 minutes)
    const expiresAt = new Date(tokenData.expires_at);
    const now = new Date();
    const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000);
    let currentToken = tokenData.access_token;
    if (expiresAt <= tenMinutesFromNow) {
      console.log('Token expires soon, refreshing...');
      // Refresh token directly
      const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID');
      const googleClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: googleClientId,
          client_secret: googleClientSecret,
          refresh_token: tokenData.refresh_token,
          grant_type: 'refresh_token'
        })
      });
      if (!refreshResponse.ok) {
        throw new Error('Failed to refresh token');
      }
      const newTokenData = await refreshResponse.json();
      const newExpiresAt = new Date(now.getTime() + newTokenData.expires_in * 1000);
      // Update database
      await supabase.from('user_tokens').update({
        access_token: newTokenData.access_token,
        expires_at: newExpiresAt.toISOString(),
        updated_at: now.toISOString()
      }).eq('user_id', user_id);
      currentToken = newTokenData.access_token;
      console.log(`Token refreshed, expires at: ${newExpiresAt.toISOString()}`);
    } else {
      console.log(`Token still valid until: ${expiresAt.toISOString()}`);
    }
    // Get client emails
    const { data: clientEmails } = await supabase.rpc('get_client_emails', {
      p_user_id: user_id
    });
    if (!clientEmails || clientEmails.length === 0) {
      return new Response(JSON.stringify({
        message: 'No clients found to sync'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    console.log(`Syncing events for ${clientEmails.length} clients`);
    
    // Set time range based on parameters
    let timeMin, timeMax;
    if (historicalRecovery) {
      // For historical recovery: 3 months back, 60 days forward
      timeMin = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); // 3 months back
      timeMax = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // 60 days forward
      console.log(`Historical recovery mode: fetching events from ${timeMin.toISOString()} to ${timeMax.toISOString()}`);
    } else {
      // Standard sync: 14 days back, 60 days forward
      timeMin = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      timeMax = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
      console.log(`Standard sync mode: fetching events from ${timeMin.toISOString()} to ${timeMax.toISOString()}`);
    }
    
    // Fetch ALL events from Google Calendar with pagination
    const allEvents = [];
    let pageToken = null;
    let pageCount = 0;
    do {
      pageCount++;
      console.log(`Fetching page ${pageCount}...`);
      const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
      url.searchParams.append('timeMin', timeMin.toISOString());
      url.searchParams.append('timeMax', timeMax.toISOString());
      url.searchParams.append('singleEvents', 'true');
      url.searchParams.append('orderBy', 'startTime');
      url.searchParams.append('maxResults', '250');
      
      // Always include showDeleted for cancelled event tracking
      url.searchParams.append('showDeleted', 'true');
      
      if (pageToken) url.searchParams.append('pageToken', pageToken);
      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${currentToken}`
        }
      });
      if (!response.ok) {
        throw new Error(`Google API error: ${response.status}`);
      }
      const calendarData = await response.json();
      const pageEvents = calendarData.items || [];
      allEvents.push(...pageEvents);
      pageToken = calendarData.nextPageToken;
      console.log(`Page ${pageCount}: ${pageEvents.length} events, hasNext: ${!!pageToken}`);
      // Safety limit - increase for historical recovery
      const maxPages = historicalRecovery ? 20 : 10;
      if (pageCount >= maxPages) {
        console.log(`Reached safety page limit (${maxPages})`);
        break;
      }
    }while (pageToken)
    console.log(`Fetched ${allEvents.length} total events from Google`);
    
    // Filter events for clients
    const clientEmailsSet = new Set(clientEmails.map((e)=>e.toLowerCase()));
    const filteredEvents = allEvents.filter((event)=>{
      // Always include cancelled events for tracking
      if (event.status === 'cancelled') return true;
      
      // For historical recovery, include all events that might have been client events
      if (historicalRecovery) {
        // Include events with any attendees (to catch historical client events)
        if (!event.attendees || event.attendees.length === 0) return false;
        // Skip group sessions
        if (event.attendees.some((a)=>a.email?.toLowerCase() === 'matt@mocharymethod.com')) {
          return false;
        }
        // Include if any attendee is a current client
        return event.attendees.some((a)=>clientEmailsSet.has(a.email?.toLowerCase()));
      }
      
      // Standard filtering for regular sync
      // Skip if no attendees
      if (!event.attendees || event.attendees.length === 0) return false;
      // Skip if matt@mocharymethod.com is an attendee (group sessions)
      if (event.attendees.some((a)=>a.email?.toLowerCase() === 'matt@mocharymethod.com')) {
        return false;
      }
      // Include only if at least one client is an attendee
      return event.attendees.some((a)=>clientEmailsSet.has(a.email?.toLowerCase()));
    });
    console.log(`Processing ${filteredEvents.length} client events`);
    
    // Process events
    let synced = 0;
    let cancelled = 0;
    let historical = 0;
    let errors = 0;
    for (const event of filteredEvents){
      try {
        // Find which client this event is for
        const clientEmail = event.attendees?.find((a)=>clientEmailsSet.has(a.email?.toLowerCase()))?.email;
        if (!clientEmail) continue;
        // Get client ID
        const { data: client } = await supabase.from('clients').select('id').eq('user_id', user_id).ilike('email', clientEmail).single();
        if (!client) {
          console.log(`No client found for email: ${clientEmail}`);
          continue;
        }
        // Prepare event data
        const eventData = {
          user_id,
          client_id: client.id,
          calendar_event_id: event.id,
          title: event.summary || 'No title',
          start_time: event.start.dateTime || event.start.date,
          end_time: event.end.dateTime || event.end.date,
          attendees: event.attendees,
          updated_at: new Date().toISOString()
        };
        
        // Handle cancelled events - keep them but mark them
        if (event.status === 'cancelled') {
          // Check if this event already exists in our database
          const { data: existingEvent } = await supabase
            .from('calendar_events')
            .select('id, title, status')
            .eq('calendar_event_id', event.id)
            .eq('user_id', user_id)
            .single();
          
          if (existingEvent) {
            // Update existing event to mark it as cancelled
            const cancelledEventData = {
              ...eventData,
              title: existingEvent.title + ' [CANCELLED]',
              status: 'cancelled',
              updated_at: new Date().toISOString()
            };
            
            const { error: updateError } = await supabase
              .from('calendar_events')
              .update(cancelledEventData)
              .eq('id', existingEvent.id);
              
            if (!updateError) {
              cancelled++;
              console.log(`Marked event as cancelled: ${event.id} - ${existingEvent.title}`);
            } else {
              console.error(`Error marking event as cancelled ${event.id}:`, updateError);
              errors++;
            }
          } else {
            // Insert new cancelled event (in case it was cancelled before we synced it)
            const cancelledEventData = {
              ...eventData,
              title: eventData.title + ' [CANCELLED]',
              status: 'cancelled'
            };
            
            const { error: insertError } = await supabase
              .from('calendar_events')
              .insert(cancelledEventData);
              
            if (!insertError) {
              cancelled++;
              if (historicalRecovery) {
                historical++;
                console.log(`Recovered historical cancelled event: ${event.id} - ${eventData.title}`);
              } else {
                console.log(`Inserted cancelled event: ${event.id} - ${eventData.title}`);
              }
            } else {
              console.error(`Error inserting cancelled event ${event.id}:`, insertError);
              errors++;
            }
          }
          continue;
        }
        
        // Handle regular events
        const { error: upsertError } = await supabase.from('calendar_events').upsert(eventData, {
          onConflict: 'user_id,calendar_event_id'
        });
        if (upsertError) {
          console.error(`Error syncing event ${event.id}:`, upsertError);
          errors++;
        } else {
          synced++;
          // Log successful future events
          if (new Date(eventData.start_time) > new Date()) {
            console.log(`Synced future event: ${event.summary} on ${eventData.start_time}`);
          }
        }
      } catch (error) {
        console.error(`Error processing event ${event.id}:`, error);
        errors++;
      }
    }
    const result = {
      success: true,
      message: `Sync complete: ${synced} events synced, ${cancelled} cancelled events tracked${historicalRecovery ? `, ${historical} historical events recovered` : ''}, ${errors} errors`,
      stats: {
        totalFetched: allEvents.length,
        pagesProcessed: pageCount,
        processed: filteredEvents.length,
        synced,
        cancelled,
        historical,
        errors,
        timeRange: {
          from: timeMin.toISOString(),
          to: timeMax.toISOString()
        },
        clientCount: clientEmails.length,
        includeDeleted,
        historicalRecovery
      }
    };
    console.log('Sync complete:', result);
    return new Response(JSON.stringify(result), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error('Sync error:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});
