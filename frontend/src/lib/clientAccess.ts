import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient, User } from '@supabase/supabase-js'

// Coach and staff accounts are the ones in team_access (as owner or member).
// Everyone else who signs in is treated as a client and can only open
// session notes that have been shared with them.
export async function isTeamMember(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from('team_access')
    .select('id')
    .or(`owner_id.eq.${userId},member_id.eq.${userId}`)
    .limit(1)
  return (data?.length ?? 0) > 0
}

// Links a signed-in client to the coach's client record whose email matches
// their Google account. Only Google identities are trusted, because Google
// verifies email ownership; password sign-ups are not verified.
export async function linkClientByEmail(user: User): Promise<string | null> {
  const googleIdentity = user.identities?.find(i => i.provider === 'google')
  const email = user.email?.trim().toLowerCase()
  if (!googleIdentity || !email) return null

  const serviceSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: alreadyLinked } = await serviceSupabase
    .from('clients')
    .select('id')
    .eq('auth_user_id', user.id)
    .limit(1)
  if (alreadyLinked && alreadyLinked.length > 0) return alreadyLinked[0].id

  const { data: owners, error: ownersError } = await serviceSupabase
    .from('team_access')
    .select('owner_id')
  if (ownersError) {
    console.error('linkClientByEmail: failed to load coach accounts', ownersError)
    return null
  }
  const ownerIds = [...new Set((owners ?? []).map(o => o.owner_id))]
  if (ownerIds.length === 0) return null

  const escapedEmail = email.replace(/[\\%_]/g, c => `\\${c}`)
  const { data: matches, error: matchError } = await serviceSupabase
    .from('clients')
    .select('id')
    .ilike('email', escapedEmail)
    .in('user_id', ownerIds)
    .is('auth_user_id', null)
  if (matchError) {
    console.error('linkClientByEmail: client lookup failed', matchError)
    return null
  }
  if (!matches || matches.length !== 1) {
    if (matches && matches.length > 1) {
      console.error(`linkClientByEmail: ${matches.length} client records share ${email}; not linking`)
    }
    return null
  }

  const { error: updateError } = await serviceSupabase
    .from('clients')
    .update({ auth_user_id: user.id })
    .eq('id', matches[0].id)
    .is('auth_user_id', null)
  if (updateError) {
    console.error('linkClientByEmail: failed to link client', updateError)
    return null
  }

  return matches[0].id
}
