import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
serve(async (req)=>{
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const googleClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    // Get user_id from request
    const { user_id } = await req.json();
    if (!user_id) {
      throw new Error('user_id is required');
    }
    // Get current tokens
    const { data: tokenData, error: tokenError } = await supabase.from('user_tokens').select('*').eq('user_id', user_id).single();
    if (tokenError || !tokenData) {
      throw new Error('No tokens found for user');
    }
    // Check if token needs refresh (expires within 5 minutes)
    const expiresAt = new Date(tokenData.expires_at);
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
    if (expiresAt > fiveMinutesFromNow) {
      return new Response(JSON.stringify({
        message: 'Token still valid',
        expires_at: tokenData.expires_at
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      });
    }
    // Refresh the token
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
      const errorData = await refreshResponse.text();
      throw new Error(`Failed to refresh token: ${errorData}`);
    }
    const newTokenData = await refreshResponse.json();
    // Calculate new expiration time
    const newExpiresAt = new Date(now.getTime() + newTokenData.expires_in * 1000);
    // Update tokens in database
    const { error: updateError } = await supabase.from('user_tokens').update({
      access_token: newTokenData.access_token,
      expires_at: newExpiresAt.toISOString(),
      updated_at: new Date().toISOString()
    }).eq('user_id', user_id);
    if (updateError) {
      throw new Error(`Failed to update tokens: ${updateError.message}`);
    }
    // Log successful refresh
    console.log(`Successfully refreshed token for user ${user_id}`);
    return new Response(JSON.stringify({
      success: true,
      message: 'Token refreshed successfully',
      expires_at: newExpiresAt.toISOString()
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error('Error:', error);
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
