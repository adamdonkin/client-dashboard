'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Client, Session } from '@/lib/types'
import { getClient, updateClient, createSession, updateSession, deleteSession } from '@/lib/data'

export default function ClientDetail() {
  const params = useParams()
  const router = useRouter()
  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    status: 'active' as 'active' | 'inactive' | 'prospect',
    notes: '',
    needs_scheduling: false
  })

  useEffect(() => {
    if (params.id) {
      fetchClient(params.id as string)
    }
  }, [params.id])

  const fetchClient = async (id: string) => {
    try {
      setLoading(true)
      const data = await getClient(id)
      if (data) {
        setClient(data)
        setFormData({
          name: data.name,
          email: data.email,
          phone: data.phone || '',
          status: data.status,
          notes: data.notes || '',
          needs_scheduling: data.needs_scheduling
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!client) return
    
    try {
      const updatedClient = await updateClient(client.id, formData)
      setClient(updatedClient)
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update client')
    }
  }

  const handleCancel = () => {
    if (client) {
      setFormData({
        name: client.name,
        email: client.email,
        phone: client.phone || '',
        status: client.status,
        notes: client.notes || '',
        needs_scheduling: client.needs_scheduling
      })
    }
    setEditing(false)
  }

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-8"></div>
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-800 mb-2">Error</h2>
            <p className="text-red-600">{error}</p>
            <button
              onClick={() => router.back()}
              className="mt-4 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Client Not Found</h2>
            <button
              onClick={() => router.back()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <button
              onClick={() => router.back()}
              className="text-blue-600 hover:text-blue-800 mb-2 flex items-center"
            >
              ← Back to Dashboard
            </button>
            <h1 className="text-3xl font-bold text-gray-900">{client.name}</h1>
          </div>
          <div className="flex gap-2">
            {editing ? (
              <>
                <button
                  onClick={handleSave}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={handleCancel}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Edit
              </button>
            )}
          </div>
        </div>

        {/* Client Info */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Client Information</h2>
          
          {editing ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="prospect">Prospect</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.needs_scheduling}
                    onChange={(e) => setFormData({ ...formData, needs_scheduling: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">Needs Scheduling</span>
                </label>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-sm font-medium text-gray-500">Name</span>
                <p className="text-gray-900">{client.name}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Email</span>
                <p className="text-gray-900">{client.email}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Phone</span>
                <p className="text-gray-900">{client.phone || 'Not provided'}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Status</span>
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(client.status)}`}>
                  {client.status}
                </span>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Needs Scheduling</span>
                <p className="text-gray-900">{client.needs_scheduling ? 'Yes' : 'No'}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Last Session</span>
                <p className="text-gray-900">{client.last_session_date ? formatDate(client.last_session_date) : 'None'}</p>
              </div>
              {client.notes && (
                <div className="md:col-span-2">
                  <span className="text-sm font-medium text-gray-500">Notes</span>
                  <p className="text-gray-900">{client.notes}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sessions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Sessions</h2>
          
          {client.sessions && client.sessions.length > 0 ? (
            <div className="space-y-4">
              {client.sessions.map((session) => (
                <div key={session.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-900">
                        {formatDate(session.date)} at {session.time}
                      </p>
                      <p className="text-sm text-gray-600">{session.duration} minutes</p>
                      {session.notes && (
                        <p className="text-sm text-gray-600 mt-1">{session.notes}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No sessions recorded yet.</p>
          )}
        </div>
      </div>
    </div>
  )
} 