# Seed Leaders via Supabase SQL (Completed ✅)

**Status:** ✅ COMPLETED (2026-06-22)  
**Method:** Supabase SQL Editor (Direct SQL, no edge function needed)  
**Result:** 7 leaders × 19 outlets, 100% coverage

---

## ✅ Seeding Completed

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
