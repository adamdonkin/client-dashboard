'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useAuth } from '@/components/auth/AuthProvider'

export default function DebugPage() {
  const [status, setStatus] = useState('Testing...')
  const [data, setData] = useState<any>(null)
  const [debugInfo, setDebugInfo] = useState<any>({})
  const { user, loading } = useAuth()

  useEffect(() => {
    async function testConnection() {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        
        console.log('Supabase URL:', supabaseUrl)
        console.log('Supabase Key:', supabaseKey ? 'Present' : 'Missing')
        console.log('User:', user)
        console.log('User ID:', user?.id)
        
        const supabase = createClient(supabaseUrl, supabaseKey)
        
        // Test authentication first
        const { data: { session } } = await supabase.auth.getSession()
        console.log('Session:', session)
        
        if (!session) {
          setStatus('No authenticated session found')
          return
        }

        // Test basic data access
        console.log('Testing basic data access...')
        
        // Check if there are any clients
        const { data: clients, error: clientsError } = await supabase
          .from('clients')
          .select('*')
          .limit(5)
        
        console.log('Clients:', clients, 'Error:', clientsError)
        
        // Check if there are any calendar events
        const { data: calendarEvents, error: calendarError } = await supabase
          .from('calendar_events')
          .select('*')
          .limit(5)
        
        console.log('Calendar Events:', calendarEvents, 'Error:', calendarError)
        
        // Check if there are any sessions
        const { data: sessions, error: sessionsError } = await supabase
          .from('sessions')
          .select('*')
          .limit(5)
        
        console.log('Sessions:', sessions, 'Error:', sessionsError)
        
        // Test the business metrics functions
        console.log('Testing business metrics functions...')
        
        const [
          { data: sessionsThisWeek, error: error1 },
          { data: avgPerWeek, error: error2 },
          { data: avgPerMonth, error: error3 },
          { data: rescheduleRate, error: error4 }
        ] = await Promise.all([
          supabase.rpc('get_sessions_this_week'),
          supabase.rpc('get_avg_sessions_per_week'),
          supabase.rpc('get_avg_sessions_per_month'),
          supabase.rpc('get_reschedule_cancel_rate')
        ])
        
        const results = {
          sessionsThisWeek,
          avgPerWeek,
          avgPerMonth,
          rescheduleRate,
          errors: [error1, error2, error3, error4]
        }
        
        console.log('Function results:', results)
        
        setDebugInfo({
          clients: { data: clients, error: clientsError },
          calendarEvents: { data: calendarEvents, error: calendarError },
          sessions: { data: sessions, error: sessionsError },
          functionResults: results
        })
        
        if (error1 || error2 || error3 || error4) {
          setStatus(`Error: ${error1?.message || error2?.message || error3?.message || error4?.message}`)
          console.error('Supabase errors:', [error1, error2, error3, error4])
        } else {
          setStatus('Success!')
          setData(results)
          console.log('Supabase data:', results)
        }
      } catch (err) {
        setStatus(`Exception: ${err}`)
        console.error('Exception:', err)
      }
    }
    
    if (!loading) {
      testConnection()
    }
  }, [user, loading])

  if (loading) {
    return <div className="p-8">Loading...</div>
  }

  return (
    <div className="p-8">
      <h1>Business Metrics Functions Test</h1>
      <p><strong>User:</strong> {user?.email || 'Not authenticated'}</p>
      <p><strong>User ID:</strong> {user?.id || 'N/A'}</p>
      <p><strong>Status:</strong> {status}</p>
      
      <h2>Debug Information:</h2>
      <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
      
      {data && (
        <div>
          <h2>Function Results:</h2>
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}