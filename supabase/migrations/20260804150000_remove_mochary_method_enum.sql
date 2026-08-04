-- Ensure all clients are migrated off 'Mochary Method'
UPDATE public.clients
SET referral_source = 'Matt Mochary'
WHERE referral_source = 'Mochary Method';

-- Drop the default before changing the type
ALTER TABLE public.clients ALTER COLUMN referral_source DROP DEFAULT;

-- Recreate enum without 'Mochary Method'
ALTER TYPE referral_source RENAME TO referral_source_old;

CREATE TYPE referral_source AS ENUM ('Matt Mochary', 'Mochary Coaching', 'Adam Donkin');

ALTER TABLE public.clients
  ALTER COLUMN referral_source TYPE referral_source
  USING referral_source::text::referral_source;

DROP TYPE referral_source_old;

NOTIFY pgrst, 'reload schema';
