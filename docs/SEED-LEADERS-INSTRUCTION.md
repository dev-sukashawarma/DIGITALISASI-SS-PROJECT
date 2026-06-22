# Seed Leaders & Outlet Mapping — Suka Shawarma Absensi

**Date:** 2026-06-22  
**Scope:** Create 7 leaders + link to 19 outlets  
**Method:** Manual via Supabase Dashboard OR automated SQL

---

## Quick Reference — 7 Leaders

| # | Name | Username | Email | Outlets |
|---|------|----------|-------|---------|
| 1 | Chairul Rizky | chairulrizky | chairulrizky@test.com | sukmajaya, beji, sawangan, ratujaya (4) |
| 2 | Tri Rizky | tririzky | tririzky@test.com | cibinong, ciseeng, cirendeu (3) |
| 3 | Mulyadi | mulyadi | mulyadi@test.com | jagakarsa, kalisari, tebet, jatiwaringin, pekayon, jatiasih (6) |
| 4 | Abu Bakar Bahsin | abubakarbahsin | abubakarbahsin@test.com | cimanggu (1) |
| 5 | Abdurrahman | abdurrahman | abdurrahman@test.com | empang (1) |
| 6 | Reza | reza | reza@test.com | dramaga (1) |
| 7 | Abyansah | abyansah | abyansah@test.com | pajajaran, paledang, kitchen (3) |

**Password (all):** `test`

---

## Method 1: Manual via Supabase Dashboard (Easiest for Testing)

### Step 1: Create Users in Supabase Auth

1. Go to **Supabase Dashboard** → **Authentication** → **Users**
2. Click **"Add user"** → Create new user:
   ```
   Email: chairulrizky@test.com
   Password: test
   ✅ Auto confirm email: true
   ```
3. Repeat for all 7 leaders
4. Note each user's UUID (visible in Users list)

### Step 2: Insert into `outlet_staff` Table

Go to **Supabase Dashboard** → **SQL Editor** → Run:

```sql
-- Insert 7 leaders into outlet_staff
INSERT INTO outlet_staff (id, outlet_id, name, username, role, status)
VALUES
  ((SELECT id FROM auth.users WHERE email = 'chairulrizky@test.com'),
   (SELECT id FROM outlets WHERE LOWER(name) = 'sukmajaya'),
   'Chairul Rizky', 'chairulrizky', 'leader', 'active'),
  ((SELECT id FROM auth.users WHERE email = 'tririzky@test.com'),
   (SELECT id FROM outlets WHERE LOWER(name) = 'cibinong'),
   'Tri Rizky', 'tririzky', 'leader', 'active'),
  ((SELECT id FROM auth.users WHERE email = 'mulyadi@test.com'),
   (SELECT id FROM outlets WHERE LOWER(name) = 'jagakarsa'),
   'Mulyadi', 'mulyadi', 'leader', 'active'),
  ((SELECT id FROM auth.users WHERE email = 'abubakarbahsin@test.com'),
   (SELECT id FROM outlets WHERE LOWER(name) = 'cimanggu'),
   'Abu Bakar Bahsin', 'abubakarbahsin', 'leader', 'active'),
  ((SELECT id FROM auth.users WHERE email = 'abdurrahman@test.com'),
   (SELECT id FROM outlets WHERE LOWER(name) = 'empang'),
   'Abdurrahman', 'abdurrahman', 'leader', 'active'),
  ((SELECT id FROM auth.users WHERE email = 'reza@test.com'),
   (SELECT id FROM outlets WHERE LOWER(name) = 'dramaga'),
   'Reza', 'reza', 'leader', 'active'),
  ((SELECT id FROM auth.users WHERE email = 'abyansah@test.com'),
   (SELECT id FROM outlets WHERE LOWER(name) = 'pajajaran'),
   'Abyansah', 'abyansah', 'leader', 'active');
```

✅ **Note:** Each leader inserted with first outlet only (primary). Multi-outlet linking in Step 3.

### Step 3: Link Leaders to All Outlets (staff_outlets Mapping)

Run in **SQL Editor**:

```sql
-- Chairul Rizky (chairulrizky) → 4 outlets
INSERT INTO staff_outlets (staff_id, outlet_id)
SELECT 
  (SELECT id FROM outlet_staff WHERE username = 'chairulrizky'),
  id
FROM outlets
WHERE LOWER(name) IN ('sukmajaya', 'beji', 'sawangan', 'ratujaya');

-- Tri Rizky (tririzky) → 3 outlets
INSERT INTO staff_outlets (staff_id, outlet_id)
SELECT 
  (SELECT id FROM outlet_staff WHERE username = 'tririzky'),
  id
FROM outlets
WHERE LOWER(name) IN ('cibinong', 'ciseeng', 'cirendeu');

-- Mulyadi (mulyadi) → 6 outlets
INSERT INTO staff_outlets (staff_id, outlet_id)
SELECT 
  (SELECT id FROM outlet_staff WHERE username = 'mulyadi'),
  id
FROM outlets
WHERE LOWER(name) IN ('jagakarsa', 'kalisari', 'tebet', 'jatiwaringin', 'pekayon', 'jatiasih');

-- Abu Bakar Bahsin (abubakarbahsin) → 1 outlet
INSERT INTO staff_outlets (staff_id, outlet_id)
SELECT 
  (SELECT id FROM outlet_staff WHERE username = 'abubakarbahsin'),
  id
FROM outlets
WHERE LOWER(name) = 'cimanggu';

-- Abdurrahman (abdurrahman) → 1 outlet
INSERT INTO staff_outlets (staff_id, outlet_id)
SELECT 
  (SELECT id FROM outlet_staff WHERE username = 'abdurrahman'),
  id
FROM outlets
WHERE LOWER(name) = 'empang';

-- Reza (reza) → 1 outlet
INSERT INTO staff_outlets (staff_id, outlet_id)
SELECT 
  (SELECT id FROM outlet_staff WHERE username = 'reza'),
  id
FROM outlets
WHERE LOWER(name) = 'dramaga';

-- Abyansah (abyansah) → 3 outlets
INSERT INTO staff_outlets (staff_id, outlet_id)
SELECT 
  (SELECT id FROM outlet_staff WHERE username = 'abyansah'),
  id
FROM outlets
WHERE LOWER(name) IN ('pajajaran', 'paledang', 'kitchen');
```

✅ **Result:** 7 leaders now linked to 19 outlets (100% coverage via `staff_outlets` mapping)

### Step 4: Verify

Run in **SQL Editor**:

```sql
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

Expected output:
```
| leader | outlets_managed | outlet_count |
|--------|-----------------|--------------|
| Abyansah | {kitchen,pajedang,pajajaran} | 3 |
| Abu Bakar Bahsin | {cimanggu} | 1 |
| Abdurrahman | {empang} | 1 |
| Chairul Rizky | {beji,ratujaya,sawangan,sukmajaya} | 4 |
| Mulyadi | {jagakarsa,jatiasih,jatiwaringin,kalisari,pekayon,tebet} | 6 |
| Reza | {dramaga} | 1 |
| Tri Rizky | {cibinong,ciseeng,cirendeu} | 3 |
```

---

## Method 2: Automated via Edge Function (Recommended for Production)

### Option A: Use `create-staff` Edge Function

If `create-staff` edge function supports `role: 'leader'`:

```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/create-staff \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Chairul Rizky",
    "email": "chairulrizky@test.com",
    "password": "test",
    "role": "leader",
    "username": "chairulrizky"
  }'
```

Repeat for all 7 leaders. Then run Step 3 (staff_outlets mapping) manually.

### Option B: Create Batch Seed Function

Create edge function `seed-leaders` (TypeScript):

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const leaders = [
  { name: 'Chairul Rizky', username: 'chairulrizky', email: 'chairulrizky@test.com', outlets: ['sukmajaya', 'beji', 'sawangan', 'ratujaya'] },
  // ... rest of leaders
];

for (const leader of leaders) {
  // Create auth user
  const { data: auth } = await supabase.auth.admin.createUser({
    email: leader.email,
    password: 'test',
    email_confirm: true,
  });
  
  if (!auth?.user) throw new Error(`Failed to create user ${leader.email}`);
  
  // Insert into outlet_staff
  const { data: staff } = await supabase
    .from('outlet_staff')
    .insert({
      id: auth.user.id,
      name: leader.name,
      username: leader.username,
      role: 'leader',
      status: 'active',
      outlet_id: (await supabase.from('outlets').select('id').eq('name', leader.outlets[0].toLowerCase()).single()).data.id,
    })
    .select()
    .single();
  
  // Link all outlets via staff_outlets
  const outlets = await supabase.from('outlets').select('id').in('name', leader.outlets.map(o => o.toLowerCase()));
  
  await supabase
    .from('staff_outlets')
    .insert(
      outlets.data!.map(o => ({
        staff_id: staff.id,
        outlet_id: o.id,
      }))
    );
}
```

Deploy via `supabase functions deploy seed-leaders`, then call.

---

## Method 3: Programmatic via CLI / Script

```bash
# Save as seed-leaders.sh
#!/bin/bash

SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
ANON_KEY="YOUR_ANON_KEY"

declare -a leaders=(
  "Chairul Rizky:chairulrizky"
  "Tri Rizky:tririzky"
  # ... etc
)

for leader in "${leaders[@]}"; do
  name="${leader%:*}"
  username="${leader#*:}"
  email="${username}@test.com"
  
  curl -X POST $SUPABASE_URL/functions/v1/create-staff \
    -H "Authorization: Bearer $ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$name\",\"email\":\"$email\",\"password\":\"test\",\"role\":\"leader\",\"username\":\"$username\"}"
done
```

Run: `bash seed-leaders.sh`

---

## Testing After Seeding

1. **Login as leader:**
   - URL: `absensi.sukashawarma.com/login`
   - Email: `chairulrizky@test.com`
   - Password: `test`
   - ✅ Should see `/dashboard/manajemen-kru` (staff management)

2. **Check enrollment access:**
   - Navigate to `/dashboard/enroll`
   - ✅ Should see dropdown with crew from their outlets only (RLS enforced)

3. **Verify RLS scoping:**
   - As Chairul Rizky, try access crew from "empang" (Abdurrahman's outlet)
   - ❌ Should NOT see crew from other outlets

---

## Cleanup (if needed)

Remove all leaders:

```sql
-- Delete from staff_outlets
DELETE FROM staff_outlets 
WHERE staff_id IN (SELECT id FROM outlet_staff WHERE role = 'leader');

-- Delete from outlet_staff
DELETE FROM outlet_staff 
WHERE role = 'leader';

-- Delete from auth.users
DELETE FROM auth.users 
WHERE email IN (
  'chairulrizky@test.com', 'tririzky@test.com', 'mulyadi@test.com',
  'abubakarbahsin@test.com', 'abdurrahman@test.com', 'reza@test.com', 'abyansah@test.com'
);
```

---

**Owner:** Dev Suka Shawarma  
**Related:** `ROLE-JOBDESK.md`, `ENROLLMENT-PROCESS.md`, `CLAUDE.md`
