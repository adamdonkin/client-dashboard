-- Enable Row Level Security and create auth policies
-- This secures the database so users can only see their own data

-- Enable RLS on all tables
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_sync_status ENABLE ROW LEVEL SECURITY;

-- Create policies for clients table
CREATE POLICY "Users can only access their own clients" ON clients
  FOR ALL USING (auth.uid() = user_id);

-- Create policies for calendar_events table  
CREATE POLICY "Users can only access their own calendar events" ON calendar_events
  FOR ALL USING (auth.uid() = user_id);

-- Create policies for sessions table
CREATE POLICY "Users can only access their own sessions" ON sessions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM clients 
      WHERE clients.id = sessions.client_id 
      AND clients.user_id = auth.uid()
    )
  );

-- Create policies for user_tokens table
CREATE POLICY "Users can only access their own tokens" ON user_tokens
  FOR ALL USING (auth.uid() = user_id);

-- Create policies for client_sync_status table
CREATE POLICY "Users can only access their own sync status" ON client_sync_status
  FOR ALL USING (auth.uid() = user_id); 