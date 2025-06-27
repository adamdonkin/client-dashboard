import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { user_id } = await request.json()
    
    // Call your Supabase Edge Function
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/sync-google-calendar`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ user_id })
      }
    )
    
    if (!response.ok) {
      throw new Error(`Supabase function error: ${response.status}`)
    }
    
    const result = await response.json()
    return NextResponse.json(result)
    
  } catch (error) {
    console.error('Sync API error:', error)
    return NextResponse.json(
      { success: false, message: `Sync failed: ${error}` },
      { status: 500 }
    )
  }
} 