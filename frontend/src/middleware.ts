import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isTeamMember } from '@/lib/clientAccess'

const PUBLIC_ROUTES = ['/auth/login', '/auth/callback', '/api/cron']
const CLIENT_ROUTES = ['/sessions/', '/no-access']
const TEAM_ONLY_ROUTES = ['/sessions/new']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    const loginUrl = new URL('/auth/login', req.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  const isClientRoute = CLIENT_ROUTES.some((route) => pathname.startsWith(route))
    && !TEAM_ONLY_ROUTES.some((route) => pathname.startsWith(route))
  if (!isClientRoute) {
    if (!(await isTeamMember(supabase, session.user.id))) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return NextResponse.redirect(new URL('/no-access', req.url))
    }
  }

  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
