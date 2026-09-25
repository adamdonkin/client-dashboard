'use client'

import { useAuth } from '@/components/auth/AuthProvider'

export default function NoAccessPage() {
  const { user, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="max-w-sm text-center space-y-4">
        <h1 className="text-[15px] font-medium text-foreground">Nothing to see here</h1>
        <p className="text-[13px] text-muted-foreground">
          Open the session link your coach sent you to view your notes.
        </p>
        {user?.email && (
          <p className="text-[13px] text-muted-foreground">
            Signed in as {user.email}.{' '}
            <button onClick={signOut} className="text-foreground hover:underline cursor-pointer">
              Use a different account
            </button>
          </p>
        )}
      </div>
    </div>
  )
}
