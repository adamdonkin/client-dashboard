# Database Migrations Guide

This guide explains how to work with database migrations in this project.

## Prerequisites

- Supabase CLI installed (`brew install supabase/tap/supabase`)
- Project linked to remote Supabase instance
- Database password (if needed)

## Creating a New Migration

1. Create a new SQL file in `supabase/migrations/` with the naming pattern:
   ```
   YYYYMMDDHHMMSS_description.sql
   ```
   Example: `20251228120000_add_user_preferences.sql`

2. Write your SQL migration in the file:
   ```sql
   -- Migration: Add user preferences table
   
   CREATE TABLE user_preferences (
     id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
     user_id uuid REFERENCES auth.users(id) NOT NULL,
     theme text DEFAULT 'light',
     created_at timestamptz DEFAULT now()
   );
   ```

## Pushing Migrations to Production

### Option 1: Using the helper script (recommended)
```bash
./scripts/push-migration.sh
```

### Option 2: Using Supabase CLI directly
```bash
supabase db push
```

This will:
- Connect to your remote Supabase database
- Show you which migrations will be applied
- Ask for confirmation (press Y)
- Apply the migrations

## Common Issues

### "cannot change return type of existing function"

If you're modifying an existing function, you need to drop it first:

```sql
DROP FUNCTION IF EXISTS my_function();

CREATE OR REPLACE FUNCTION my_function()
...
```

### "failed to connect to postgres"

Make sure you're linked to the remote project:
```bash
supabase link --project-ref YOUR_PROJECT_REF
```

### Docker daemon not running

If you see Docker errors, that's okay! We're using `supabase db push` which connects directly to the remote database and doesn't need Docker.

## Best Practices

1. **Always test locally first** (if you have local Supabase running)
2. **Use descriptive migration names** that explain what changed
3. **Include DROP IF EXISTS** when modifying existing functions
4. **Add comments** to explain complex migrations
5. **Commit migrations to git** after successful push
6. **Keep migrations small and focused** - one logical change per migration

## Workflow Summary

```bash
# 1. Create migration file
touch supabase/migrations/$(date +%Y%m%d%H%M%S)_my_change.sql

# 2. Edit the file with your SQL

# 3. Push to production
./scripts/push-migration.sh

# 4. Commit to git
git add supabase/migrations/
git commit -m "Add migration: my_change"
git push
```

## Syncing Calendar After Migration

If your migration affects how calendar events are queried, you may need to sync:

```bash
# Make sure your dev server is running first
npm run dev

# Then in another terminal:
node scripts/sync-calendar-now.js
```

This will fetch the latest events from Google Calendar and update your database.







