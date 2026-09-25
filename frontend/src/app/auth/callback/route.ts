import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { isTeamMember, linkClientByEmail } from '@/lib/clientAccess'

function safeRedirectPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null
  return value
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const redirect = safeRedirectPath(requestUrl.searchParams.get('redirect'))

  if (code) {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    await supabase.auth.exchangeCodeForSession(code)

    const { data: { user } } = await supabase.auth.getUser()
    if (user && !(await isTeamMember(supabase, user.id))) {
      await linkClientByEmail(user)
      return NextResponse.redirect(new URL(redirect || '/no-access', requestUrl.origin))
    }
  }

  return NextResponse.redirect(new URL(redirect || '/', requestUrl.origin))
}
