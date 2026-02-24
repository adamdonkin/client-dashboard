-- Fix overly permissive RLS policies
-- These policies allow any user to read all data, bypassing user-specific restrictions

-- Drop the policy that allows anyone to read all clients
DROP POLICY IF EXISTS "Enable read access for all users" ON clients;

-- Drop the policy that allows any authenticated user to read all sessions
DROP POLICY IF EXISTS "Allow read access to authenticated users" ON sessions;

-- Verify the remaining policies are correct:
-- clients: "Users can only access their own clients" - USING (auth.uid() = user_id)
-- clients: "Users can view their own clients" - FOR SELECT USING (auth.uid() = user_id)
-- clients: "Users can create their own clients" - FOR INSERT WITH CHECK (auth.uid() = user_id)
-- clients: "Users can update their own clients" - FOR UPDATE USING (auth.uid() = user_id)
-- clients: "Users can delete their own clients" - FOR DELETE USING (auth.uid() = user_id)
-- sessions: "Users can only access their own sessions" - EXISTS subquery checking client ownership
