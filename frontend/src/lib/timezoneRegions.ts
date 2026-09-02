// Region names are produced by the `get_clients_by_region` RPC, which maps the free-text
// `clients.location` city onto a fixed set of regions. The mapping itself stays in SQL so
// there is one definition of it; only the display metadata for those regions lives here,
// shared so the Timezones page and the client header cannot drift apart.

export const REGION_ORDER = ['West Coast', 'Mountain', 'Central', 'East Coast', 'Europe', 'Asia Pacific']

export const MORNING_PRESSURE_REGIONS = new Set(['East Coast', 'Europe'])

export function getRegionColor(region: string) {
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
      return 'bg-muted text-muted-foreground border-border'
  }
}

// Offsets are relative to Adam's own timezone, Pacific.
export function getTimeOffset(region: string) {
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
