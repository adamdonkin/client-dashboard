import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { user_id, date, calendar_event_id } = await request.json()

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-pre-reads`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id, date, calendar_event_id }),
      }
    )

    if (!response.ok) {
      const text = await response.text()
      console.error('Edge function error:', text)
      return NextResponse.json(
        { success: false, message: `Generation failed: ${response.status}` },
        { status: 500 }
      )
    }

    const result = await response.json()
    return NextResponse.json(result)
  } catch (error) {
    console.error('Generate pre-reads API error:', error)
    return NextResponse.json(
      { success: false, message: `Failed: ${error}` },
      { status: 500 }
    )
  }
}
