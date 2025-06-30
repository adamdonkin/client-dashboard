export interface Client {
  id: string;
  user_id: string;
  client_name: string;
  client_email: string;
  phone?: string;
  company_name?: string;
  role?: string;
  slack?: string;
  granola_notes_folder?: string;
  notes?: string;
  session_count: number;
  is_active?: boolean;
  created_at: string;
  updated_at: string;
  last_session_date?: string;
  days_since_last_session?: number;
  next_session_date?: string;
  priority_level?: string;
}

export interface ClientDetailData {
  id: string;
  client_name: string;
  client_email: string;
  phone?: string;
  company_name?: string;
  role?: string;
  slack?: string;
  granola_notes_folder?: string;
  notes?: string;
  is_active?: boolean;
  last_session_date?: string;
  next_session_date?: string;
} 