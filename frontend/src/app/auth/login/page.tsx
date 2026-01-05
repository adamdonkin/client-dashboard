'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'

export default function LoginPage() {
  const supabase = createClientComponentClient()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="w-full max-w-md p-8 bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-2xl border border-slate-700">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white mb-2">Coaching Dashboard</h1>
          <p className="text-slate-400">Sign in to manage your clients</p>
        </div>
        <Auth
          supabaseClient={supabase}
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: '#6366f1',
                  brandAccent: '#4f46e5',
                  inputBackground: 'rgba(30, 41, 59, 0.8)',
                  inputText: 'white',
                  inputPlaceholder: '#94a3b8',
                  inputBorder: '#475569',
                  inputBorderFocus: '#6366f1',
                  inputBorderHover: '#64748b',
                }
              }
            },
            className: {
              container: 'w-full',
              button: 'w-full px-4 py-3 rounded-lg font-medium transition-colors',
              input: 'w-full px-4 py-3 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
              label: 'text-slate-300 text-sm font-medium mb-2 block',
            }
          }}
          providers={['google']}
          redirectTo={`${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback`}
        />
      </div>
    </div>
  )
}







