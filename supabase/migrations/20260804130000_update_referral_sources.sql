-- Update referral source enum and add referred_by column

-- Add new enum values
ALTER TYPE referral_source ADD VALUE IF NOT EXISTS 'Matt Mochary';
ALTER TYPE referral_source ADD VALUE IF NOT EXISTS 'Mochary Coaching';
ALTER TYPE referral_source ADD VALUE IF NOT EXISTS 'Adam Donkin';
COMMIT;

-- Rename existing 'Mochary Method' to 'Matt Mochary'
UPDATE public.clients
SET referral_source = 'Matt Mochary'
WHERE referral_source = 'Mochary Method';

-- Add referred_by column for tracking specific referrer
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS referred_by text;

COMMENT ON COLUMN public.clients.referred_by IS 'Name of the specific person who referred the client (relevant when referral_source is Adam Donkin)';

NOTIFY pgrst, 'reload schema';
