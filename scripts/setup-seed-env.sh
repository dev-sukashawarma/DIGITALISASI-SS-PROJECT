#!/bin/bash

# Setup env vars untuk seed scripts
# Auto-load dari apps/absensi/.env.local
# Hanya perlu input AUTH_TOKEN

set -e

PROJECT_ROOT="/d/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT"
ENV_FILE="$PROJECT_ROOT/apps/absensi/.env.local"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Error: $ENV_FILE not found"
  exit 1
fi

echo "📝 Loading Supabase credentials from .env.local..."
echo ""

# Extract dari .env.local
SUPABASE_URL=$(grep "NEXT_PUBLIC_SUPABASE_URL" "$ENV_FILE" | cut -d'=' -f2-)
ANON_KEY=$(grep "NEXT_PUBLIC_SUPABASE_ANON_KEY" "$ENV_FILE" | cut -d'=' -f2-)
SERVICE_ROLE=$(grep "SUPABASE_SERVICE_ROLE_KEY" "$ENV_FILE" | cut -d'=' -f2-)

# Export
export SUPABASE_URL="$SUPABASE_URL"
export SUPABASE_ANON_KEY="$ANON_KEY"
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE"

echo "✅ SUPABASE_URL loaded"
echo "✅ SUPABASE_ANON_KEY loaded"
echo "✅ SUPABASE_SERVICE_ROLE_KEY loaded"
echo ""

# AUTH_TOKEN dari user input
echo "⚠️  Need AUTH_TOKEN (SPV or Admin token)"
echo ""
echo "How to get AUTH_TOKEN:"
echo "  1. Login to absensi app as SPV/Admin"
echo "  2. Open DevTools (F12) → Network tab"
echo "  3. Look for any request with 'Authorization: Bearer' header"
echo "  4. Copy the token after 'Bearer '"
echo ""
echo "OR use CLI:"
echo "  supabase auth get-jwt"
echo ""

# Prompt untuk token
if [ -z "$AUTH_TOKEN" ]; then
  read -p "Paste AUTH_TOKEN here: " AUTH_TOKEN
fi

if [ -z "$AUTH_TOKEN" ]; then
  echo "❌ Error: AUTH_TOKEN cannot be empty"
  exit 1
fi

export AUTH_TOKEN="$AUTH_TOKEN"

echo ""
echo "=========================================="
echo "✅ All environment variables set!"
echo "=========================================="
echo ""
echo "Environment:"
echo "  SUPABASE_URL: $SUPABASE_URL"
echo "  SUPABASE_ANON_KEY: ${ANON_KEY:0:20}..."
echo "  SUPABASE_SERVICE_ROLE_KEY: ${SERVICE_ROLE:0:20}..."
echo "  AUTH_TOKEN: ${AUTH_TOKEN:0:20}..."
echo ""
echo "Next steps:"
echo "  1. bash scripts/seed-leaders.sh"
echo "  2. bash scripts/seed-staff-outlets.sh"
echo ""
echo "💡 Keep this terminal open for seeding!"
