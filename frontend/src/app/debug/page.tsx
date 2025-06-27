'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

export default function DebugPage() {
  const [status, setStatus] = useState('Testing...')
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    async function testConnection() {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        
        console.log('Supabase URL:', supabaseUrl)
        console.log('Supabase Key:', supabaseKey ? 'Present' : 'Missing')
        
        const supabase = createClient(supabaseUrl, supabaseKey)
        
        // Test the function call
        const { data, error } = await supabase.rpc('get_clients_needs_scheduling', {
          p_user_id: '4587519f-dd12-4e18-be42-25854f6dfbe3'
        })
        
        if (error) {
          setStatus(`Error: ${error.message}`)
          console.error('Supabase error:', error)
        } else {
          setStatus('Success!')
          setData(data)
          console.log('Supabase data:', data)
        }
      } catch (err) {
        setStatus(`Exception: ${err}`)
        console.error('Exception:', err)
      }
    }
    
    testConnection()
  }, [])

  return (
    <div className="p-8">
      <h1>Supabase Connection Test</h1>
      <p><strong>Status:</strong> {status}</p>
      {data && (
        <div>
          <h2>Data:</h2>
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}