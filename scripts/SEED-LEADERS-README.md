# Seed Leaders via Supabase SQL (Completed ✅)

**Status:** ✅ COMPLETED (2026-06-22)  
**Method:** Supabase SQL Editor (Direct SQL, no edge function needed)  
**Result:** 7 leaders × 19 outlets, 100% coverage

---

## ⏳ Seeding In Progress — Auth User Linking

**Status (2026-06-22):**
- ✅ outlet_staff records: 7 leaders created
- ✅ staff_outlets mappings: 19 outlet links, 100% coverage
- ⏳ auth.users: Creating 7 auth users via Supabase Dashboard UI

**Auth User Creation Progress:**
```
✅ 1/7 Chairul Rizky (ed8b6d15-abf5-49cc-9fa9-e6fc33c36edb)
⏳ 2/7 Tri Rizky (awaiting)
⏳ 3/7 Mulyadi (awaiting)
⏳ 4/7 Abu Bakar Bahsin (awaiting)
⏳ 5/7 Abdurrahman (awaiting)
⏳ 6/7 Reza (awaiting)
⏳ 7/7 Abyansah (awaiting)
```

**Process for each user:**
1. Click "Add user" in Supabase Dashboard → Authentication → Users
2. Email: `[name]@test.com`
3. Password: `test`
4. Auto confirm email: ON
5. **IMPORTANT:** Copy the generated User ID
6. Run SQL to delete staff_outlets, update outlet_staff.id, re-insert staff_outlets

---

## ✅ Seeding Completed (outlet_staff + staff_outlets)

**Actual Outlet Names (Database):**
- sukmajaya → `SUKA SHAWARMA DEPOK SUKMAJAYA`
- beji → `SUKA SHAWARMA BEJI`
- sawangan → `SUKA SHAWARMA SAWANGAN`
- cibinong → `MITRA SUKA SHAWARMA CIBINONG`
- kitchen → `SUKA SHAWARMA KITCHEN (PUSAT)`
- And 14 more...

**Leaders Created (7):**
1. **Chairul Rizky** (chairulrizky@test.com) → 4 outlets
2. **Tri Rizky** (tririzky@test.com) → 3 outlets
3. **Mulyadi** (mulyadi@test.com) → 6 outlets
4. **Abu Bakar Bahsin** (abubakarbahsin@test.com) → 1 outlet
5. **Abdurrahman** (abdurrahman@test.com) → 1 outlet
6. **Reza** (reza@test.com) → 1 outlet
7. **Abyansah** (abyansah@test.com) → 3 outlets

**Verification Results:**
```
| leader | outlets_managed | outlet_count |
|--------|-----------------|--------------|
| Abdurrahman | {EMPANG} | 1 |
| Abu Bakar Bahsin | {CIMANGGU} | 1 |
| Abyansah | {KITCHEN (PUSAT), PAJAJARAN, PALEDANG} | 3 |
| Chairul Rizky | {BEJI, DEPOK SUKMAJAYA, SAWANGAN, ...} | 4 |
| Mulyadi | {KALISARI, PEKAYON, TEBET, JATIWARINGIN, ...} | 6 |
| Reza | {DRAMAGA} | 1 |
| Tri Rizky | {CIBINONG, CISEENG, CIRENDEU} | 3 |
```

**Total: 19 outlet mappings ✅**

---

## SQL Template for Batch Update (Ready to use after auth users created)

**After creating all 7 auth users, collect IDs then run:**

```sql
-- DELETE all staff_outlets mappings (FK constraint)
DELETE FROM staff_outlets 
WHERE staff_id IN (SELECT id FROM outlet_staff WHERE role = 'leader');

-- UPDATE outlet_staff with auth user IDs
UPDATE outlet_staff SET id = '[AUTH_ID_1]' WHERE username = 'chairulrizky';
UPDATE outlet_staff SET id = '[AUTH_ID_2]' WHERE username = 'tririzky';
UPDATE outlet_staff SET id = '[AUTH_ID_3]' WHERE username = 'mulyadi';
UPDATE outlet_staff SET id = '[AUTH_ID_4]' WHERE username = 'abubakarbahsin';
UPDATE outlet_staff SET id = '[AUTH_ID_5]' WHERE username = 'abdurrahman';
UPDATE outlet_staff SET id = '[AUTH_ID_6]' WHERE username = 'reza';
UPDATE outlet_staff SET id = '[AUTH_ID_7]' WHERE username = 'abyansah';

-- RE-INSERT staff_outlets mappings with new auth IDs
INSERT INTO staff_outlets (staff_id, outlet_id)
SELECT '[AUTH_ID_1]'::uuid, id FROM outlets WHERE name IN ('SUKA SHAWARMA DEPOK SUKMAJAYA', 'SUKA SHAWARMA BEJI', 'SUKA SHAWARMA SAWANGAN', 'SUKA SHAWARMA PAJAJARAN')
UNION ALL
SELECT '[AUTH_ID_2]'::uuid, id FROM outlets WHERE name IN ('MITRA SUKA SHAWARMA CIBINONG', 'MITRA SUKA SHAWARMA CISEENG', 'SUKA SHAWARMA CIRENDEU')
UNION ALL
SELECT '[AUTH_ID_3]'::uuid, id FROM outlets WHERE name IN ('SUKA SHAWARMA JAGAKARSA', 'MITRA SUKA Shawarma Kalisari', 'MITRA SUKA SHAWARMA TEBET', 'SUKA SHAWARMA JATIWARINGIN', 'MITRA SUKA Shawarma Pekayon', 'SUKA SHAWARMA JATIASIH')
UNION ALL
SELECT '[AUTH_ID_4]'::uuid, id FROM outlets WHERE name = 'SUKA SHAWARMA CIMANGGU'
UNION ALL
SELECT '[AUTH_ID_5]'::uuid, id FROM outlets WHERE name = 'SUKA SHAWARMA EMPANG'
UNION ALL
SELECT '[AUTH_ID_6]'::uuid, id FROM outlets WHERE name = 'SUKA SHAWARMA DRAMAGA'
UNION ALL
SELECT '[AUTH_ID_7]'::uuid, id FROM outlets WHERE name IN ('SUKA SHAWARMA PAJAJARAN', 'SUKA SHAWARMA PALEDANG', 'SUKA SHAWARMA KITCHEN (PUSAT)')
ON CONFLICT DO NOTHING;

-- FINAL VERIFY
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
```

**Fill in [AUTH_ID_1] through [AUTH_ID_7] with user IDs from Supabase Dashboard**

---

## How It Was Done (For Reference)

### Method Used: Supabase SQL Editor (Simplest)

**Instead of edge function, we used:**
1. Supabase Dashboard → SQL Editor
2. Ran INSERT queries directly with correct outlet names
3. No AUTH_TOKEN needed ✅

### Original Method: Get Auth Token (Optional, Not Used)

Login ke aplikasi sebagai SPV atau Admin, kemudian:
1. Buka browser DevTools → Network tab
2. Refresh halaman
3. Cari request ke `/functions/v1/` dan lihat header `Authorization: Bearer <TOKEN>`
4. Copy token tersebut

**Atau via Supabase CLI:**
```bash
# Get your session token
supabase auth get-jwt
```

### Step 2: Set Environment Variables

```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_ANON_KEY="your-anon-key"  # Dari .env.local
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"  # Dari Supabase settings
export AUTH_TOKEN="your-spv-token"  # Dari Step 1
```

**Verify:**
```bash
echo $SUPABASE_URL
echo $AUTH_TOKEN
```

### Step 3: Run Seed Scripts

```bash
# 1. Create 7 leaders via edge function
bash scripts/seed-leaders.sh

# 2. Link leaders to outlets (staff_outlets mapping)
bash scripts/seed-staff-outlets.sh
```

**Expected output:**
```
🚀 Seeding 7 Leaders via Edge Function: https://your-project.supabase.co/functions/v1/create-staff

📝 Creating leader: Chairul Rizky (chairulrizky)
   ✅ Success! Staff ID: uuid-here

...

==========================================
✅ Created: 7 leaders
❌ Failed: 0 leaders
==========================================

🎉 All leaders created! Next step:
   bash scripts/seed-staff-outlets.sh
```

---

## Detailed Instructions

### Get Supabase Keys

**Anon Key & URL:**
1. Supabase Dashboard → Project Settings → API
2. Copy: `Project URL` + `anon public key`

**Service Role Key:**
1. Supabase Dashboard → Project Settings → API
2. Scroll to "Service Role key" section
3. Copy (⚠️ sensitive, keep secure)

**Auth Token (SPV/Admin):**
1. Login to absensi app as SPV: `https://absensi.sukashawarma.com`
2. Open DevTools → Console
3. Run:
```javascript
const { data } = await fetch('/api/auth/session').then(r => r.json());
console.log(data.session.access_token);
// Copy the token
```

Or use Supabase CLI:
```bash
supabase auth get-jwt
```

### Run Step-by-Step

```bash
# Terminal 1: Set env vars
export SUPABASE_URL="https://..."
export SUPABASE_ANON_KEY="eyJh..."
export SUPABASE_SERVICE_ROLE_KEY="eyJh..."
export AUTH_TOKEN="eyJh..."

# Verify all set
env | grep SUPABASE
echo "Token: $AUTH_TOKEN"

# Terminal 2: Run seed script 1
cd /d/MIT/CLAUDE\ CODE\ PROJECT/SS\ DIGITAL\ PROJECT
bash scripts/seed-leaders.sh

# Watch output for success/errors
# If all ✅, proceed to step 2

# Terminal 2: Run seed script 2
bash scripts/seed-staff-outlets.sh

# Should see verification table with 7 leaders + outlet counts
```

### Troubleshooting

**Error: "Missing auth header"**
- AUTH_TOKEN is wrong or expired
- Solution: Get fresh token from login

**Error: "Unauthorized: Your role cannot create leader staff"**
- You're logged in as Leader (can only create crew/kasir)
- Solution: Use SPV or Admin token

**Error: "Not found" in staff_outlets script**
- Leaders not created yet
- Solution: Check output from step 1, verify ✅ for all

**Error: Connection refused**
- SUPABASE_URL is wrong
- Solution: Verify URL format: `https://xxxx.supabase.co` (no trailing slash)

---

## Verification

After seeding, verify in Supabase Dashboard:

### Check outlet_staff (7 Leaders)

**SQL Editor:**
```sql
SELECT id, name, username, role, outlet_id, status
FROM outlet_staff
WHERE role = 'leader'
ORDER BY name;
```

Expected: 7 rows with role='leader'

### Check staff_outlets Mapping (19 Links)

```sql
SELECT
  COUNT(*) as total_mappings,
  COUNT(DISTINCT staff_id) as unique_leaders,
  COUNT(DISTINCT outlet_id) as unique_outlets
FROM staff_outlets
WHERE staff_id IN (SELECT id FROM outlet_staff WHERE role = 'leader');
```

Expected:
```
total_mappings | unique_leaders | unique_outlets
19             | 7              | 19
```

### Verify Leader Access (RLS)

```sql
-- Login as Chairul Rizky, run:
SELECT o1.name as leader, ARRAY_AGG(o2.name) as outlets
FROM outlet_staff o1
LEFT JOIN staff_outlets so ON so.staff_id = o1.id
LEFT JOIN outlets o2 ON o2.id = so.outlet_id
WHERE o1.id = auth.uid()
GROUP BY o1.id, o1.name;

-- Should show: Chairul Rizky | {beji,ratujaya,sawangan,sukmajaya}
```

---

## Testing

### 1. Login as Leader

**URL:** `https://absensi.sukashawarma.com/login`
- Email: `chairulrizky@test.com`
- Password: `test`

Expected: Redirect to `/dashboard`

### 2. Check Staff Management (Manajemen Kru)

- Click "Manajemen Kru" → Sidebar menu
- Expected: See list of crew from Chairul's 4 outlets only
- Try to see crew from "empang" (Abdurrahman's outlet)
- Expected: ❌ Not visible (RLS enforces outlet scope)

### 3. Check Enrollment (Daftarkan Wajah)

- Click "Daftarkan Wajah" → Sidebar menu
- Expected: Dropdown shows crew from Chairul's 4 outlets only
- Try to enroll crew from other outlet
- Expected: ❌ Cannot select (RLS enforces scope)

### 4. Change Password

- Click "Profil" → "Ubah Password"
- New password: change from "test" to something else
- Expected: ✅ Success

---

## Rollback (If Needed)

Delete all 7 leaders:

```sql
-- Delete staff_outlets mappings
DELETE FROM staff_outlets
WHERE staff_id IN (
  SELECT id FROM outlet_staff
  WHERE username IN (
    'chairulrizky', 'tririzky', 'mulyadi', 'abubakarbahsin',
    'abdurrahman', 'reza', 'abyansah'
  )
);

-- Delete outlet_staff records
DELETE FROM outlet_staff
WHERE username IN (
  'chairulrizky', 'tririzky', 'mulyadi', 'abubakarbahsin',
  'abdurrahman', 'reza', 'abyansah'
);

-- Delete auth.users (via Supabase Dashboard or admin panel)
-- OR via SQL (if function exists):
SELECT auth.delete_user(id) FROM auth.users
WHERE email IN (
  'chairulrizky@test.com', 'tririzky@test.com', 'mulyadi@test.com',
  'abubakarbahsin@test.com', 'abdurrahman@test.com', 'reza@test.com', 'abyansah@test.com'
);
```

---

## Files

- `scripts/seed-leaders.sh` — Create 7 leaders via edge function
- `scripts/seed-staff-outlets.sh` — Insert staff_outlets mapping
- `supabase/functions/create-staff/index.ts` — Updated to support leader role (SPV only)

---

**Owner:** Dev Suka Shawarma  
**Related:** `docs/SEED-LEADERS-INSTRUCTION.md`, `ROLE-JOBDESK.md`
