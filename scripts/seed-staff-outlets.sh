#!/bin/bash

# Seed staff_outlets Mapping (Leaders ↔ Outlets)
# Usage: bash scripts/seed-staff-outlets.sh
#
# Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY env vars

set -e

SUPABASE_URL="${SUPABASE_URL:?Error: SUPABASE_URL not set}"
SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:?Error: SUPABASE_SERVICE_ROLE_KEY not set}"

echo "🚀 Seeding staff_outlets mapping (Leaders ↔ Outlets)..."
echo ""

# SQL queries to insert staff_outlets mappings
read -r -d '' SQL_QUERY << 'EOF' || true
-- Chairul Rizky → 4 outlets
INSERT INTO staff_outlets (staff_id, outlet_id)
SELECT
  (SELECT id FROM outlet_staff WHERE username = 'chairulrizky' LIMIT 1),
  id
FROM outlets
WHERE LOWER(name) IN ('sukmajaya', 'beji', 'sawangan', 'ratujaya')
ON CONFLICT DO NOTHING;

-- Tri Rizky → 3 outlets
INSERT INTO staff_outlets (staff_id, outlet_id)
SELECT
  (SELECT id FROM outlet_staff WHERE username = 'tririzky' LIMIT 1),
  id
FROM outlets
WHERE LOWER(name) IN ('cibinong', 'ciseeng', 'cirendeu')
ON CONFLICT DO NOTHING;

-- Mulyadi → 6 outlets
INSERT INTO staff_outlets (staff_id, outlet_id)
SELECT
  (SELECT id FROM outlet_staff WHERE username = 'mulyadi' LIMIT 1),
  id
FROM outlets
WHERE LOWER(name) IN ('jagakarsa', 'kalisari', 'tebet', 'jatiwaringin', 'pekayon', 'jatiasih')
ON CONFLICT DO NOTHING;

-- Abu Bakar Bahsin → 1 outlet
INSERT INTO staff_outlets (staff_id, outlet_id)
SELECT
  (SELECT id FROM outlet_staff WHERE username = 'abubakarbahsin' LIMIT 1),
  id
FROM outlets
WHERE LOWER(name) = 'cimanggu'
ON CONFLICT DO NOTHING;

-- Abdurrahman → 1 outlet
INSERT INTO staff_outlets (staff_id, outlet_id)
SELECT
  (SELECT id FROM outlet_staff WHERE username = 'abdurrahman' LIMIT 1),
  id
FROM outlets
WHERE LOWER(name) = 'empang'
ON CONFLICT DO NOTHING;

-- Reza → 1 outlet
INSERT INTO staff_outlets (staff_id, outlet_id)
SELECT
  (SELECT id FROM outlet_staff WHERE username = 'reza' LIMIT 1),
  id
FROM outlets
WHERE LOWER(name) = 'dramaga'
ON CONFLICT DO NOTHING;

-- Abyansah → 3 outlets
INSERT INTO staff_outlets (staff_id, outlet_id)
SELECT
  (SELECT id FROM outlet_staff WHERE username = 'abyansah' LIMIT 1),
  id
FROM outlets
WHERE LOWER(name) IN ('pajajaran', 'paledang', 'kitchen')
ON CONFLICT DO NOTHING;

-- Verify
SELECT
  o1.name as leader,
  ARRAY_AGG(DISTINCT o2.name ORDER BY o2.name) as outlets_managed,
  COUNT(DISTINCT o2.id) as outlet_count
FROM outlet_staff o1
LEFT JOIN staff_outlets so ON so.staff_id = o1.id
LEFT JOIN outlets o2 ON o2.id = so.outlet_id
WHERE o1.role = 'leader'
GROUP BY o1.id, o1.name
ORDER BY o1.name;
EOF

# Execute via Supabase SQL endpoint
echo "📝 Executing SQL via Supabase API..."
echo ""

response=$(curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/exec_sql" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"sql\": $(echo "$SQL_QUERY" | jq -Rs .)}")

if echo "$response" | grep -q "error\|Error"; then
  echo "❌ Error executing SQL:"
  echo "$response" | jq . 2>/dev/null || echo "$response"
  exit 1
fi

echo "✅ staff_outlets mapping inserted successfully!"
echo ""
echo "📊 Verification:"
echo "$response" | jq . 2>/dev/null || echo "$response"
echo ""
echo "=========================================="
echo "🎉 Seeding complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. ✅ Leaders created via edge function"
echo "2. ✅ staff_outlets mapping inserted"
echo "3. 🔐 Test login: chairulrizky@test.com / test"
echo "4. 🔐 Access: /dashboard/manajemen-kru (should see crew from bound outlets)"
