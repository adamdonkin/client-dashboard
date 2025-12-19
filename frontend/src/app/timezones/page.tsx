import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Globe, Sun, ArrowLeft } from 'lucide-react'

interface TimezoneRegion {
  region: string;
  client_count: number;
  percentage: number;
}

interface MorningPressure {
  morning_clients: number;
  total_clients_with_location: number;
  morning_pressure_pct: number;
}

export default async function TimezonesPage() {
  const cookieStore = await cookies()
  const supabase = createServerComponentClient({ cookies: () => cookieStore })

  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    redirect('/auth/login');
  }

  const [timezoneDistribution, morningPressure] = await Promise.all([
    supabase.rpc('get_client_timezone_distribution'),
    supabase.rpc('get_morning_pressure_stats')
  ])

  if (timezoneDistribution.error) console.error('get_client_timezone_distribution error:', timezoneDistribution.error)
  if (morningPressure.error) console.error('get_morning_pressure_stats error:', morningPressure.error)

  const regions: TimezoneRegion[] = timezoneDistribution.data || []
  const pressure: MorningPressure = (morningPressure.data && morningPressure.data[0]) || {
    morning_clients: 0,
    total_clients_with_location: 0,
    morning_pressure_pct: 0
  }

  // Calculate region color based on morning pressure
  const getRegionColor = (region: string) => {
    switch (region) {
      case 'West Coast':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'Mountain':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200'
      case 'Central':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'East Coast':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'Europe':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'Asia Pacific':
        return 'bg-purple-100 text-purple-800 border-purple-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getTimeOffset = (region: string) => {
    switch (region) {
      case 'West Coast':
        return 'Same timezone as you'
      case 'Mountain':
        return '+1 hour'
      case 'Central':
        return '+2 hours'
      case 'East Coast':
        return '+3 hours'
      case 'Europe':
        return '+8-9 hours'
      case 'Asia Pacific':
        return '+15-18 hours'
      default:
        return 'Unknown'
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link 
          href="/" 
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Client Timezone Distribution</h1>
        <p className="text-gray-600 mt-1">
          Analyze your client distribution to manage morning slot availability
        </p>
      </div>

      {/* Morning Pressure Summary */}
      <Card className="mb-8">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-semibold">Morning Slot Pressure</CardTitle>
          <Sun className="h-5 w-5 text-orange-500" />
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold">{pressure.morning_pressure_pct}%</span>
            <span className="text-gray-600">of clients need morning PT slots</span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {pressure.morning_clients} of {pressure.total_clients_with_location} clients with locations are in East Coast or Europe timezones
          </p>
          {pressure.morning_pressure_pct > 50 && (
            <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800">
              ⚠️ High morning pressure - consider prioritizing West Coast or flexible-schedule clients for new engagements
            </div>
          )}
        </CardContent>
      </Card>

      {/* Region Breakdown */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg font-semibold">Client Regions</CardTitle>
          <Globe className="h-5 w-5 text-blue-500" />
        </CardHeader>
        <CardContent>
          {regions.length > 0 ? (
            <div className="space-y-3">
              {regions.map((region) => (
                <div 
                  key={region.region} 
                  className={`flex items-center justify-between p-4 rounded-lg border ${getRegionColor(region.region)}`}
                >
                  <div>
                    <div className="font-medium">{region.region}</div>
                    <div className="text-sm opacity-75">{getTimeOffset(region.region)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">{region.client_count}</div>
                    <div className="text-sm opacity-75">{region.percentage}%</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Globe className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No client locations set yet</p>
              <p className="text-sm mt-1">Add locations to clients in Supabase to see distribution</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Color Legend</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-green-500"></div>
            <span>Flexible (same TZ)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-yellow-500"></div>
            <span>Slight pressure</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-orange-500"></div>
            <span>Morning pressure</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-red-500"></div>
            <span>High morning pressure</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-purple-500"></div>
            <span>Evening slots</span>
          </div>
        </div>
      </div>
    </div>
  )
}

