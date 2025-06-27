export interface Client {
  client_id: string;
  client_name: string | null;
  client_email: string | null;
  company: string | null;
  slack?: string;
  last_session_date?: string;
  next_session_date?: string;
  notes?: string | null;
  sessionType?: string;
  status?: 'active' | 'pending' | 'inactive';
} 