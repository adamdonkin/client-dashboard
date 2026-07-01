export type ClientStatus = 'active' | 'pending' | 'waiting' | 'inactive';

export interface Client {
  id: string
  client_name: string
  client_email: string
  slack?: string
  role?: string
  last_session_date?: string | Date
  next_session_date?: string | Date
  last_session_event_id?: string
  next_session_event_id?: string
  granola_notes_folder?: string
  defacto_meeting?: string
  company_name?: string
  is_active?: boolean
  status?: ClientStatus
  sessionType?: string
  ea_email?: string;
  ea_name?: string;
  ea_slack?: string;
  location?: string;
  notes?: string;
  monthly_fee?: number;
  phone?: string;
  cadence?: string;
  session_duration?: string;
  referral_source?: string;
} 