export interface Client {
  id: string
  name: string
  email: string
  slack?: string
  lastSession?: string | Date
  nextSession?: string | Date
  status?: 'active' | 'inactive' | 'pending'
  sessionType?: string
} 