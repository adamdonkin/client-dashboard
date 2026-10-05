import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { ATTACHMENT_BUCKET } from '@/lib/attachments'

const SIGNED_URL_SECONDS = 60 * 60

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const objectPath = path.map(decodeURIComponent).join('/')

  const cookieStore = await cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: allowed, error: accessError } = await supabase.rpc('can_view_attachment', { p_path: objectPath })
  if (accessError) {
    console.error('can_view_attachment failed:', accessError)
    return NextResponse.json({ error: 'Could not check access to this image' }, { status: 500 })
  }
  if (!allowed) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const serviceSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data, error } = await serviceSupabase.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrl(objectPath, SIGNED_URL_SECONDS)
  if (error || !data) {
    console.error('Failed to sign attachment URL:', objectPath, error)
    return NextResponse.json({ error: 'Image not found' }, { status: 404 })
  }

  // Cached for less than the signed URL lives, so a cached redirect never
  // points at an expired link.
  return NextResponse.redirect(data.signedUrl, {
    headers: { 'Cache-Control': 'private, max-age=1800' },
  })
}
