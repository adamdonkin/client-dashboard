-- Migration: Add Granola.ai notes folder field to clients table
-- File: supabase/migrations/20250630010000_add_granola_notes_folder.sql

-- Add granola_notes_folder field to clients table
ALTER TABLE public.clients 
ADD COLUMN granola_notes_folder TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.clients.granola_notes_folder IS 'URL or identifier for client''s Granola.ai notes folder';

-- Optional: Add an index if you plan to search by this field frequently
-- CREATE INDEX idx_clients_granola_notes_folder ON public.clients(granola_notes_folder);

-- Update the updated_at timestamp when this field is modified
-- (This assumes you have an updated_at trigger already set up)

-- Verify the column was added successfully
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'clients' AND column_name = 'granola_notes_folder'; 