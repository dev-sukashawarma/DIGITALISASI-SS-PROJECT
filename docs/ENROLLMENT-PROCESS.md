# Face Enrollment Process — Suka Shawarma Absensi M1

**Status:** Implemented (Session 2026-06-22)  
**Tech Stack:** @vladmandic/human v3.3.6 (face detection/embedding), Supabase (storage + database), Next.js (UI/UX)  
**Last Updated:** 2026-06-22

---

## Overview

**Goal:** Register crew wajah ke sistem absensi untuk identifikasi real-time 1:N (one-to-many) di kiosk.

**Flow:** SPV/Leader manage akun → Crew (or admin) enroll wajah (3 sudut) → Descriptor tersimpan → Crew siap absen di kiosk

---

## Tahap 1: Buat Akun Crew (Manajemen Kru)

**URL:** `/dashboard/manajemen-kru`  
**Role:** SPV, Leader (outlet binaan)  
**Access Control:** Role-based nav + page-level guard

### Form Input
```
[Input 1] Nama Lengkap      → string (required)
[Input 2] Username Login    → string lowercase + alphanumeric only (required)
[Input 3] Password Sementara → string (default: "sukashawarma123")
[Select]  Role              → dropdown: crew | kasir | spv | leader
          (Note: currently all created as "crew", role editable via Edit later)
```

### Backend: Edge Function `create-staff`
Called via: POST `{SUPABASE_URL}/functions/v1/create-staff`

**Headers:**
```
Authorization: Bearer {session.access_token}
Content-Type: application/json
```

**Payload:**
```json
{
  "name": "Budi Santoso",
  "email": "budisantoso@sukashawarma.com",  // auto-generated via generateStaffEmail()
  "password": "sukashawarma123",
  "role": "crew",
  "username": "budisantoso"
}
```

**Response (success):**
```json
{
  "staff_id": "uuid-here",
  "email": "budisantoso@sukashawarma.com",
  "username": "budisantoso"
}
```

### Database Changes
**Table: `outlet_staff`**
- ✅ Insert new row with:
  - `id` = UUID (PK, FK auth.users)
  - `outlet_id` = SPV/Leader's outlet context
  - `name` = "Budi Santoso"
  - `username` = "budisantoso"
  - `role` = "crew" (can edit later)
  - `status` = "active"
  - `face_descriptor` = NULL (waiting for enrollment)
  - `ref_photo_url` = NULL
  - `enrolled_at` = NULL
  - `consent_at` = NULL
  - `consent_by` = NULL

**Table: `auth.users`**
- ✅ Create user with email + password (Supabase Auth)

---

## Tahap 2: Daftarkan Wajah (Enrollment)

**URL:** `/dashboard/enroll`  
**Role:** SPV, Leader (dapat enroll diri sendiri atau orang lain)  
**Access Control:** Role-based nav + **page-level guard** `if (!["spv", "leader"].includes(role)) redirect("/dashboard/kru")`

### Phase 1: Pilih Crew & Consent
```
[Dropdown] Pilih Staff → list outlet_staff where enrolled_at IS NULL or editable
           Tampil: "Name (✅ Sudah Enroll)" or "Name"

[Checkbox] Persetujuan UU PDP (required)
           Teks: "Staff yang bersangkutan hadir di tempat dan dengan sadar 
                  menyetujui perekaman serta pemrosesan data biometrik wajahnya 
                  untuk keperluan absensi kerja internal Suka Shawarma."

[Button]   "Mulai Perekaman Wajah" (disabled until all above filled)
```

### Phase 2: Auto-Capture 3 Angles

**UI Guidance:**
1. **Center Phase** → "Tatap Lurus ke Kamera" 
   - Detect gesture: "facing center" OR "head up" OR "head down"
   - Auto-capture when detected → progress indicator (1/3 ✅)
   - Auto advance to Left phase (800ms delay for UX)

2. **Left Phase** → "Tolehkan Kepala ke Kiri"
   - Detect gesture: "facing left"
   - Auto-capture → progress (2/3 ✅)
   - Auto advance to Right phase

3. **Right Phase** → "Tolehkan Kepala ke Kanan"
   - Detect gesture: "facing right"
   - Auto-capture → progress (3/3 ✅)
   - Auto transition to Save phase

**Technical Flow:**
```typescript
// Per-frame loop in component
1. Await human.detect(video) → res.face[0].embedding (float32[128])
2. Extract gesture from res.gesture[].gesture
3. Check if current phase gesture matches
4. If match: capture embedding, add to shots[] array
5. Auto-advance phase + 800ms jeda
6. After 3 captures → saveAuto(shots)
```

### Phase 3: Save to Database & Storage

**Descriptor Processing:**
```typescript
const descriptor = averageDescriptors([shot1, shot2, shot3]);
// Result: float32[128] averaged vector
```

**Storage Upload:**
```typescript
// Path: face-refs/{outlet_id}/{staff_id}.jpg
const blob = await fetch(dataUrl).blob();
await supabase.storage
  .from("face-refs")
  .upload(`${outlet_id}/${staff_id}.jpg`, blob, {
    upsert: true,
    contentType: "image/jpeg"
  });
```

**Database Update:**
```typescript
await supabase
  .from("outlet_staff")
  .update({
    face_descriptor: descriptor,        // float32[128]
    ref_photo_url: `${outlet_id}/${staff_id}.jpg`,
    consent_at: new Date().toISOString(),
    consent_by: outletStaff.id,         // SPV/Leader who enrolled
    enrolled_at: new Date().toISOString()
  })
  .eq("id", targetId);
```

**Success Screen:**
```
✅ Perekaman Selesai!
   Wajah {crew.name} berhasil didaftarkan secara akurat ke dalam sistem.
   
   [Button: "Daftarkan Staff Lain"]
```

---

## Tahap 3: Crew Ready to Clock

After `enrolled_at` is set:
- Crew can login to dashboard
- Access kiosk mode (`/kiosk/[outlet_id]`)
- Face recognition works: matching face descriptor against `outlet_staff.face_descriptor` where `outlet_id = kiosk_outlet_id`

---

## Data Model & Storage

### Table: `outlet_staff` (new/updated columns)

| Column | Type | Notes |
|--------|------|-------|
| `face_descriptor` | float32[] (JSON) | 128-dim embedding, NULL until enrolled |
| `ref_photo_url` | text | Path in `face-refs` bucket, nullable |
| `enrolled_at` | timestamp | Null until first enrollment complete |
| `consent_at` | timestamp | When consent checkbox signed |
| `consent_by` | uuid (FK) | Staff ID who registered (for audit) |

### Storage Bucket: `face-refs`

**Access:** Public read via RLS, scoped to `outlet_staff.outlet_id` for ref photo download  
**Path structure:** `{outlet_id}/{staff_id}.jpg`  
**Format:** JPEG (from HTML5 canvas capture)  
**Purpose:** Audit trail + manual verification if match quality questioned

---

## Face Recognition Matching (used in Kiosk)

**Similarity Function:**
```typescript
// from match.ts
export function faceSimilarity(a: Descriptor, b: Descriptor): number {
  return match.similarity(a, b);  // cosine similarity via @vladmandic/human
}

// Cosine: dot(a,b) / (norm(a) * norm(b))
// Range: 0 to 1 (1 = identical)
```

**Threshold:** `DEFAULT_MATCH_THRESHOLD = 0.25` (lowered from 0.55 based on field testing)

**Matching Logic:**
```typescript
const found = identifyStaff(liveEmbedding, candidates, threshold);
if (found.id === "unknown") {
  // No match above threshold
  setError(`Wajah tidak dikenal (Best score: ${found.bestSimilarity.toFixed(4)})`);
} else {
  // Match found
  proceed_with_clock(found.id);
}
```

---

## Access Control & Security

### Page-Level Guard (Defense in Depth)
```typescript
// /dashboard/enroll/page.tsx
useEffect(() => {
  if (outletStaff && !["spv", "leader"].includes(outletStaff.role)) {
    router.replace("/dashboard/kru");
  }
}, [outletStaff, router]);
```

**Why:** Layout handles nav + redirect, but page itself also validates. If middleware down or redirect fails, page still protects.

### Data Scope (RLS)
- **SPV:** Can enroll wajah lintas semua 19 outlet (view definer bypass)
- **Leader:** Can enroll wajah hanya outlet binaan via `staff_outlets` mapping (RLS enforcement)

### Privacy (UU PDP)
- ✅ Consent checkbox + audit trail (`consent_at`, `consent_by`)
- ✅ Biometric data encrypted in transit + at rest
- ✅ Ref photo accessible only via RLS-scoped storage URL
- ❌ **Not yet:** Version control on policy text (only timestamp saved currently)

---

## Backlog / Improvements

### High Priority
1. **Password management:**
   - [ ] Replace hardcoded "sukashawarma123" with random per-crew
   - [ ] Force password change on first login
   - [ ] Email notification of login credentials

2. **Role selection at creation:**
   - [ ] Add role dropdown in `create-staff` form (not just default to "crew")

3. **Onboarding guidance:**
   - [ ] Dashboard alert: "Face enrollment BELUM selesai" if `enrolled_at` is null
   - [ ] Quick link to `/dashboard/enroll`

### Medium Priority
4. **Re-enrollment workflow:**
   - [ ] Crew can "reset enrollment" to try again if quality poor
   - [ ] SPV approval gate (future) for re-enrollment updates
   - [ ] Quality metrics: blur detection, lighting check before save

5. **Privacy audit trail:**
   - [ ] Store hash/version of privacy policy consent (not just timestamp)
   - [ ] Digital signature/ID proof (future)

6. **Email verification:**
   - [ ] Optional email confirm on account create
   - [ ] Enables password reset flow

### Lower Priority
7. **Cross-outlet transfer:**
   - [ ] Policy: Can crew re-use enrollment if transferred to another outlet?
   - [ ] Or require re-enrollment for each outlet?

---

## Troubleshooting

### "Camera not starting"
- Check browser permissions (Settings → Camera)
- Try different browser (Chrome/Firefox recommended)
- Check lighting condition

### "Wajah tidak dikenal" on clock-in
- Enrollment quality issue: retry enrollment with better lighting
- Angle mismatch: ensure kiosk angle ~ same as enrollment
- Reset enrollment + re-do if persistent

### "Descriptor mismatch" errors
- Verify `face_descriptor` not null in database: `SELECT id, enrolled_at, face_descriptor FROM outlet_staff WHERE id = ?`
- Check if averaging algorithm correct (should be element-wise mean of 3 vectors)

---

**Owner:** Dev Suka Shawarma  
**Related:** `ROLE-JOBDESK.md`, `SECURITY-CHECKLIST.md`, `CLAUDE.md` (apps/absensi section)
