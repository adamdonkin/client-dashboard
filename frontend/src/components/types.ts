export interface Client {
  id: string
  client_name: string
  client_email: string
  slack?: string
  role?: string
  last_session_date?: string | Date
  next_session_date?: string | Date
  granola_notes_folder?: string
  defacto_meeting?: string
  company_name?: string
  is_active?: boolean
  status?: 'active' | 'inactive' | 'pending'
  sessionType?: string
  ea_email?: string;
  ea_name?: string;
} 