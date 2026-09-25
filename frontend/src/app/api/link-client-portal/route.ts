import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

// Portal links grant read access to a client's notes, so only the client's
// owner or an editor on the owner's team may change them.
async function canManageClient(serviceSupabase: SupabaseClient, userId: string, clientId: string) {
  const { data: client } = await serviceSupabase
    .from('clients')
    .select('user_id')
    .eq('id', clientId)
    .single()

  if (!client) return false
  if (client.user_id === userId) return true

  const { data: teamRow } = await serviceSupabase
    .from('team_access')
    .select('id')
    .eq('owner_id', client.user_id)
    .eq('member_id', userId)
    .eq('role', 'editor')
    .limit(1)

  return (teamRow?.length ?? 0) > 0
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { clientId, email } = await request.json()

  if (!clientId || !email) {
    return NextResponse.json({ error: 'Missing clientId or email' }, { status: 400 })
  }

  // Use service role to look up auth user by email
  const serviceSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  if (!(await canManageClient(serviceSupabase, user.id, clientId))) {
    console.error(`link-client-portal: user ${user.id} not permitted to link client ${clientId}`)
    return NextResponse.json({ error: 'You do not have permission to manage portal access for this client' }, { status: 403 })
  }

  // Find auth user by email
  const { data: { users }, error: listError } = await serviceSupabase.auth.admin.listUsers()
  if (listError) {
    return NextResponse.json({ error: 'Failed to list users' }, { status: 500 })
  }

  const authUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase())

  if (!authUser) {
    return NextResponse.json({ error: `No account found for ${email}. They need to sign in first.` }, { status: 404 })
  }

  // Link the client record
  const { error: updateError } = await serviceSupabase
    .from('clients')
    .update({ auth_user_id: authUser.id })
    .eq('id', clientId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, linkedUserId: authUser.id })
}

export async function DELETE(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { clientId } = await request.json()

  const serviceSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  if (!(await canManageClient(serviceSupabase, user.id, clientId))) {
    console.error(`link-client-portal: user ${user.id} not permitted to unlink client ${clientId}`)
    return NextResponse.json({ error: 'You do not have permission to manage portal access for this client' }, { status: 403 })
  }

  const { error } = await serviceSupabase
    .from('clients')
    .update({ auth_user_id: null })
    .eq('id', clientId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
