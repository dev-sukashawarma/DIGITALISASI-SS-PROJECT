#!/bin/bash

# Seed Leaders via Edge Function
# Usage: bash scripts/seed-leaders.sh [SUPABASE_URL] [ANON_KEY] [AUTH_TOKEN]
#
# Or set env vars:
#   export SUPABASE_URL="https://your-project.supabase.co"
#   export SUPABASE_ANON_KEY="your-anon-key"
#   export AUTH_TOKEN="your-spv-token"
# Then: bash scripts/seed-leaders.sh

set -e

SUPABASE_URL="${SUPABASE_URL:-https://your-project.supabase.co}"
ANON_KEY="${SUPABASE_ANON_KEY:-your-anon-key}"
AUTH_TOKEN="${AUTH_TOKEN:-your-token}"

if [ "$SUPABASE_URL" = "https://your-project.supabase.co" ]; then
  echo "❌ Error: Set SUPABASE_URL env var"
  exit 1
fi

if [ "$AUTH_TOKEN" = "your-token" ]; then
  echo "❌ Error: Set AUTH_TOKEN env var (SPV or Admin token)"
  exit 1
fi

FUNCTION_URL="$SUPABASE_URL/functions/v1/create-staff"

echo "🚀 Seeding 7 Leaders via Edge Function: $FUNCTION_URL"
echo ""

# Array of leaders: name:username:email
leaders=(
  "Chairul Rizky:chairulrizky:chairulrizky@test.com"
  "Tri Rizky:tririzky:tririzky@test.com"
  "Mulyadi:mulyadi:mulyadi@test.com"
  "Abu Bakar Bahsin:abubakarbahsin:abubakarbahsin@test.com"
  "Abdurrahman:abdurrahman:abdurrahman@test.com"
  "Reza:reza:reza@test.com"
  "Abyansah:abyansah:abyansah@test.com"
)

created_count=0
failed_count=0

for leader in "${leaders[@]}"; do
  name="${leader%%:*}"
  username="${leader#*:}"
  username="${username%%:*}"
  email="${leader##*:}"

  echo "📝 Creating leader: $name ($username)"

  response=$(curl -s -X POST "$FUNCTION_URL" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"name\": \"$name\",
      \"username\": \"$username\",
      \"email\": \"$email\",
      \"password\": \"test\",
      \"role\": \"leader\"
    }")

  if echo "$response" | grep -q '"ok":true'; then
    staff_id=$(echo "$response" | grep -o '"staff_id":"[^"]*' | sed 's/"staff_id":"//')
    echo "   ✅ Success! Staff ID: $staff_id"
    ((created_count++))
  else
    error_msg=$(echo "$response" | grep -o '"error":"[^"]*' | sed 's/"error":"//' | sed 's/"$//')
    echo "   ❌ Failed: $error_msg"
    ((failed_count++))
  fi
  echo ""
done

echo "=========================================="
echo "✅ Created: $created_count leaders"
echo "❌ Failed: $failed_count leaders"
echo "=========================================="

if [ $failed_count -eq 0 ]; then
  echo ""
  echo "🎉 All leaders created! Next step:"
  echo "   bash scripts/seed-staff-outlets.sh"
  exit 0
else
  echo ""
  echo "⚠️  Some leaders failed. Check errors above."
  exit 1
fi
