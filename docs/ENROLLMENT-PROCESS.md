# Face Enrollment Process — Suka Shawarma Absensi M1

**Status:** Implemented (Session 2026-06-22 Unified Flow)  
**Tech Stack:** @vladmandic/human v3.3.6 (face detection/embedding), Supabase (storage + database), Next.js (UI/UX)  
**Last Updated:** 2026-06-22

---

## Overview

**Goal:** Register crew wajah ke sistem absensi untuk identifikasi real-time 1:N (one-to-many) di kiosk.

**Flow:** Admin HR manage akun (via Admin Dashboard) → SPV/Leader enroll wajah (via Absensi App) → Descriptor tersimpan → Crew siap absen di kiosk

---

## Tahap 1: Buat Akun Crew (Manajemen Data Kru)

**URL:** `apps/admin-dashboard -> /dashboard/staff`  
**Role:** Admin HR, Owner  
**Access Control:** Admin Dashboard  

> **Perubahan Penting (2026-06-22):** Pembuatan akun kru, edit role, dan penghapusan kru **tidak lagi dilakukan oleh Leader** melalui aplikasi absensi. Semua manajemen data master (CRUD) disentralisasi di Admin Dashboard oleh tim HR.

### Proses HR
1. Admin HR membuat akun crew baru.
2. Mengisi Nama, Username, Password, Role, dan Outlet Penempatan.
3. Data tersimpan di tabel `outlet_staff` dengan status `enrolled_at = NULL` (menandakan belum rekam wajah).

---

## Tahap 2: Daftarkan Wajah (Enrollment Crew)

**URL:** `apps/absensi -> /dashboard/enroll`  
**Role:** SPV, Leader (dapat enroll kru di outlet yang diawasinya)  
**Access Control:** Role-based nav + **page-level guard**

### Phase 1: Pilih Outlet & Crew (Mobile-first List)
```
[Outlet Switcher] Muncul jika Leader/SPV mengawasi >1 outlet (via staff_outlets).
                  Otomatis default ke outlet tempat login.

[Card List]       Menampilkan daftar kru dari outlet terpilih yang **belum enrolled wajah**
                  (enrolled_at IS NULL AND status = 'active').
                  Format: Card berisi inisial, nama, dan role.

[Tap Card]        Memilih kru dan beralih ke layar Consent.
```

### Phase 2: Persetujuan (Consent)
```
[Info Kru]        Menampilkan nama dan role kru yang dipilih.
[Checkbox]        Persetujuan UU PDP (required)
                  Teks: "Saya, [Nama Kru], menyetujui perekaman serta pemrosesan data 
                         biometrik wajah saya secara digital untuk keperluan operasional 
                         internal Suka Shawarma."
[Button]          "Mulai Perekaman Kamera" (disabled until checkbox checked)
```

### Phase 3: Auto-Capture 3 Angles

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

### Phase 4: Save & Lanjut (Selesai)

**Descriptor Processing & Storage:**
```typescript
const descriptor = averageDescriptors([shot1, shot2, shot3]); // float32[128]

// Path: face-refs/{outlet_id}/{staff_id}.jpg
const blob = await fetch(dataUrl).blob();
await supabase.storage.from("face-refs").upload(`${outlet_id}/${staff_id}.jpg`, blob, ...);
```

**Database Update:**
```typescript
await supabase
  .from("outlet_staff")
  .update({
    face_descriptor: descriptor,
    ref_photo_url: `${outlet_id}/${staff_id}.jpg`,
    consent_at: new Date().toISOString(),
    consent_by: outletStaff.id,         // SPV/Leader who enrolled
    enrolled_at: new Date().toISOString()
  })
  .eq("id", targetId);
```

**Success Screen:**
```
✅ Enrollment Selesai!
   Wajah {crew.name} berhasil didaftarkan.
   
   [Button: "Lanjut Enroll Crew Berikutnya"] -> Otomatis memilih kru berikutnya di antrean
   [Button: "Kembali ke Daftar"]
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
- **SPV:** Can enroll wajah lintas semua outlet
- **Leader:** Can enroll wajah hanya outlet binaan via `staff_outlets` mapping + OutletSwitcher

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

### Medium Priority
2. **Re-enrollment workflow:**
   - [ ] Crew can "reset enrollment" to try again if quality poor
   - [ ] SPV approval gate (future) for re-enrollment updates
   - [ ] Quality metrics: blur detection, lighting check before save

3. **Privacy audit trail:**
   - [ ] Store hash/version of privacy policy consent (not just timestamp)
   - [ ] Digital signature/ID proof (future)

4. **Email verification:**
   - [ ] Optional email confirm on account create
   - [ ] Enables password reset flow

### Lower Priority
5. **Cross-outlet transfer:**
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
**Related:** `ROLE-JOBDESK.md`, `SECURITY-CHECKLIST.md`
