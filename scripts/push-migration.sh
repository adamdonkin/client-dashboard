#!/bin/bash
# Script to push migrations to Supabase
# Usage: ./scripts/push-migration.sh

set -e

echo "🚀 Pushing migrations to Supabase..."
cd "$(dirname "$0")/.."

# Push migrations to remote database
supabase db push

echo "✅ Migrations applied successfully!"
echo ""
echo "📝 Don't forget to:"
echo "  1. Commit and push your migration files to git"
echo "  2. Refresh your dashboard to see the changes"

