import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { PrepContent } from '@/components/prep/PrepContent'

export default async function PrepPage() {
  const cookieStore = await cookies()
  const supabase = createServerComponentClient({ cookies: () => cookieStore })

  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect('/auth/login')
  }

  return (
    <div className="p-6 max-w-[900px] mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Session Prep</h1>
        <p className="text-muted-foreground mt-1">
          AI-generated pre-reads for your coaching sessions
        </p>
      </div>
      <PrepContent />
    </div>
  )
}
