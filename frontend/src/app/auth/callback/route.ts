import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    await supabase.auth.exchangeCodeForSession(code)

    // Check if this user is a coach/team member or a client
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const [{ data: clientMatch }, { data: teamCheck }, { data: ownerCheck }] = await Promise.all([
        supabase
          .from('clients')
          .select('id')
          .eq('auth_user_id', user.id)
          .limit(1)
          .single(),
        supabase
          .from('team_access')
          .select('id')
          .or(`owner_id.eq.${user.id},member_id.eq.${user.id}`)
          .limit(1),
        supabase
          .from('clients')
          .select('id')
          .eq('user_id', user.id)
          .limit(1),
      ])

      const isCoachOrTeam = (teamCheck && teamCheck.length > 0) || (ownerCheck && ownerCheck.length > 0)

      const redirect = requestUrl.searchParams.get('redirect')

      if (!isCoachOrTeam && clientMatch) {
        const target = redirect || `/clients/${clientMatch.id}`
        return NextResponse.redirect(new URL(target, requestUrl.origin))
      }
    }
  }

  return NextResponse.redirect(requestUrl.origin)
}