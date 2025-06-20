import Link from 'next/link'
import { Client } from '@/lib/types'

interface ClientCardProps {
  client: Client
}

export default function ClientCard({ client }: ClientCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'inactive':
        return 'bg-gray-100 text-gray-800'
      case 'prospect':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const sessionCount = client.sessions?.length || 0

  return (
    <Link href={`/clients/${client.id}`}>
      <div className="bg-white shadow rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">{client.name}</h3>
            <p className="text-sm text-gray-600 mb-2">{client.email}</p>
            {client.phone && (
              <p className="text-sm text-gray-600 mb-3">{client.phone}</p>
            )}
            
            <div className="flex items-center gap-2 mb-3">
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(client.status)}`}>
                {client.status}
              </span>
              {client.needs_scheduling && (
                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                  Needs Scheduling
                </span>
              )}
            </div>

            <div className="text-sm text-gray-600">
              <p>{sessionCount} session{sessionCount !== 1 ? 's' : ''}</p>
              {client.last_session_date && (
                <p>Last: {formatDate(client.last_session_date)}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
} 