-- Add rich-text description storage alongside existing plain-text description
ALTER TABLE client_actions ADD COLUMN IF NOT EXISTS description_content jsonb;
