# Security & Privacy Checklist — Face Enrollment (Absensi M1)

**Status:** Active / Session 2026-06-22  
**Last Updated:** 2026-06-22  
**Scope:** Face recognition, biometric data handling, privacy compliance (UU PDP), access control

---

## 🔐 Biometric Data Protection

### Encryption & Storage

- ✅ **Face descriptor (float32[128])** stored in Supabase database
  - [ ] **TODO:** Encrypt at-rest (AES-256) — currently plaintext in PostgreSQL
  - ✅ HTTPS in transit
  - ✅ Access scoped by RLS (`outlet_staff.outlet_id`)

- ✅ **Reference photo (JPEG)** stored in Supabase Storage bucket `face-refs`
  - ✅ Signed URLs only (expire after X minutes)
  - ✅ RLS policy restricts download to same outlet staff
  - [ ] **TODO:** Consider encryption for sensitive visual data

- ✅ **Auth tokens** stored in HTTP-only cookies (set via @suka/auth)

### Data Lifecycle

| Stage | Handling | Risk Level |
|-------|----------|-----------|
| **Capture (client-side)** | Raw face image on camera stream | Low (ephemeral, processed client-side) |
| **Processing** | Descriptor extraction via @vladmandic/human | Low (face.js is reputable, no server upload of raw image) |
| **Averaging** | 3 descriptors → 1 averaged vector | Low (mathematical operation, no reversible info) |
| **Upload (storage)** | JPEG ref photo + float32 descriptor | **Medium** — persist in database |
| **Storage (at-rest)** | Database row + Storage object | **Medium** — needs encryption |
| **Matching (kiosk)** | Compare live embedding vs stored | Low (cosine similarity, no raw image stored) |
| **Deletion (if crew leaves)** | Manual cleanup: delete `outlet_staff` row + `face-refs/` object | **Critical** — process not yet automated |

---

## 📋 Privacy Compliance (UU PDP — Indonesian Data Privacy Law)

### Consent & Audit Trail

- ✅ **Checkbox consent** at `/dashboard/enroll`
  - Text: "Staff yang bersangkutan hadir di tempat dan dengan sadar menyetujui perekaman serta pemrosesan data biometrik wajahnya untuk keperluan absensi kerja internal Suka Shawarma."
  - Recorded: `consent_at` (timestamp), `consent_by` (staff ID who clicked)

- [ ] **TODO:** Store policy version/hash
  - Currently only timestamp → if policy changes, no way to know which version was agreed to
  - **Recommendation:** Save `privacy_policy_version` or hash of policy text in `outlet_staff` table

- [ ] **TODO:** Digital signature / crew ID proof
  - Checkbox alone not sufficient for legal compliance
  - **Recommendation:** Capture crew ID photo or have SPV/Leader co-sign with their credentials

### Data Retention & Deletion

- ✅ **Retention period:** Specified in privacy policy (currently not documented)
  - **Recommendation:** Document retention in employee handbook (e.g., "kept for 2 years after crew leaves")

- [ ] **TODO:** Automated deletion on crew exit
  - Currently manual (admin deletes `outlet_staff` row)
  - **Recommendation:** Add soft-delete + cleanup job (90-day grace period, then auto-purge descriptors/photos)

### Data Subject Rights (UU PDP Article 21)

- [ ] **Right to access:** crew can request & download their face descriptor + ref photo
  - **Recommendation:** Add endpoint `/api/crew/face-data/export`

- [ ] **Right to correction:** crew can ask to re-enroll if enrollment rejected unjustly
  - **Recommendation:** Add "Request Re-enroll" flow with SPV approval

- [ ] **Right to deletion:** crew can request descriptor & photo removal
  - **Recommendation:** Add "/api/crew/face-data/delete" with audit log

---

## 🔒 Access Control & Authorization

### Page-Level Guards

| Route | Access | Guard Method | Risk |
|-------|--------|--------------|------|
| `/dashboard/enroll` | SPV, Leader only | Role nav + **page-level check** | ✅ Low (defense-in-depth) |
| `/dashboard/manajemen-kru` | SPV, Leader only | Role nav + page-level check | ✅ Low |
| Kiosk `/kiosk/[outlet_id]` | Public (guest, no auth) | None (public endpoint) | ⚠️ Medium — face data not exposed, but reveals who clocked in |

### RLS (Row-Level Security)

- ✅ **SPV:** View all 19 outlet staff (view definer bypass)
- ✅ **Leader:** View only staff in their `staff_outlets` mapping (RLS enforced)
- ✅ **Crew:** View self only (RLS: `auth.uid() = outlet_staff.id`)
- ✅ **Kiosk:** No auth needed for match endpoint, but returns only match/no-match (no descriptor leaked)

### Permission Enforcement

- ✅ `enroll/page.tsx` checks role at page load → redirects if not SPV/leader
- ✅ Manajemen-kru same guard
- ✅ Database RLS prevents cross-outlet access for leader/crew

---

## 🚨 Threat Model & Mitigations

### Threat 1: Unauthorized Enrollment
**Attack:** Crew A's face registered under Crew B's account → Clock in as someone else

**Current Mitigations:**
- ✅ SPV/Leader must authorize enrollment (page guard)
- ✅ Consent checkbox (documented)
- [ ] **Gap:** No re-enrollment approval — crew can re-do anytime
  
**Recommended:**
- [ ] Lock enrollment after first success (toggle: `enroll_locked` in `outlet_staff`)
- [ ] Re-enrollment requires SPV approval

---

### Threat 2: Face Spoofing
**Attack:** Photo/video replay of crew's face → Fool system

**Current Mitigations:**
- ✅ **Liveness detection:** Gesture requirement (head turn, tilt) prevents static photo
- ✅ 3-angle capture reduces replay attack surface
- [ ] **Gap:** Liveness only during kiosk clock-in (good), but not during enrollment

**Recommended:**
- [ ] Add liveness check during enrollment too (secondary gesture)

---

### Threat 3: Descriptor Extraction (Reverse Engineering)
**Attack:** Attacker gets descriptor → Generate synthetic face

**Current Mitigations:**
- ✅ Descriptor is float32[128] (lossy, non-reversible, not raw image)
- ✅ RLS prevents unauthorized access
- [ ] **Gap:** Not encrypted at-rest

**Recommended:**
- [ ] Encrypt descriptor with per-outlet key (not critical but good practice)

---

### Threat 4: Photo Reference Leakage
**Attack:** Download everyone's ref photos from storage bucket

**Current Mitigations:**
- ✅ Storage has RLS policy (signed URLs only to authorized outlet staff)
- [ ] **Gap:** If RLS broken, all photos visible

**Recommended:**
- [ ] Verify storage RLS policy is active: `SELECT * FROM pg_policies WHERE tablename = 'storage.objects' AND policyname LIKE '%face%'`

---

### Threat 5: Cross-Outlet Data Leakage
**Attack:** Crew in Outlet A accesses Outlet B's enrollment data

**Current Mitigations:**
- ✅ RLS blocks crew to own outlet (`outlet_staff.outlet_id` check)
- ✅ Leader scoped by `staff_outlets` mapping

**Recommended:**
- [ ] Audit RLS policies quarterly (automated test: try access other outlet data as crew/leader)

---

### Threat 6: Database Compromise
**Attack:** DBA or attacker gains database access → all descriptors leaked

**Current Mitigations:**
- ✅ Backups encrypted by Supabase
- ✅ Access logs retained (Supabase audit)
- [ ] **Gap:** Descriptor plaintext in PostgreSQL

**Recommended:**
- [ ] Encrypt descriptor before insert (app-level crypto, keep encryption key in secret manager)
- [ ] Enable full-text search if future use case requires searching faces (currently not needed)

---

## 🧪 Testing & Verification

### Unit Tests
- ✅ `identify.test.ts` — matcher works correctly, threshold enforced
- ✅ `match.test.ts` — similarity calculation, euclidean distance, edge cases
- [ ] **TODO:** Test RLS policies (PostgreSQL RLS validation tests)

### Integration Tests
- [ ] **TODO:** Mock enrollment end-to-end (create staff → enroll → clock-in)
- [ ] **TODO:** Verify crew cannot access other outlet data

### Security Tests
- [ ] **TODO:** Manual: Try access `/dashboard/enroll` as crew (should redirect)
- [ ] **TODO:** Manual: Try download ref photo as crew from different outlet (should 403)
- [ ] **TODO:** Manual: Verify descriptor averaging works (capture 3 similar faces → descriptor ~same)
- [ ] **TODO:** Penetration test: Liveness bypass (static photo, video replay)

---

## 📊 Audit & Compliance

### Audit Log Requirements

| Event | Logged | Fields | Retention |
|-------|--------|--------|-----------|
| **Account Create** | ✅ Via edge function | staff_id, creator, timestamp | ∞ |
| **Enrollment** | ✅ `enrolled_at`, `consent_at`, `consent_by` | staff_id, consent_by, timestamp | ∞ |
| **Re-enrollment** | ❌ TODO | should log who, when, reason | - |
| **Descriptor Update** | ❌ TODO | should log version/hash | - |
| **Data Access** | ❌ TODO | RLS logs buried in PostgreSQL | - |
| **Deletion** | ❌ TODO | soft-delete audit trail | - |

### Compliance Checklist

- [ ] **UU PDP Article 1 (Consent):** Document + obtain informed consent ✅ (checkbox + audit trail)
- [ ] **Article 5 (Purpose Limitation):** Face used only for attendance, not facial recognition for surveillance ✅ (documented in consent text)
- [ ] **Article 11 (Data Minimization):** Collect only face (not name/ID during capture) ✅
- [ ] **Article 17 (Right to Access):** Provide mechanism to crew request their data — ❌ **TODO**
- [ ] **Article 21 (Right to Deletion):** Deletion on request — ❌ **TODO**
- [ ] **Article 33 (Personal Data Protection Impact Assessment - DPIA):** Conduct DPIA for high-risk processing — ❌ **TODO** (biometric data is high-risk)

---

## 📝 Deployment Checklist

Before going production:

- [ ] Verify storage `face-refs` bucket has RLS enabled
  ```sql
  SELECT * FROM pg_policies WHERE tablename = 'storage.objects';
  ```

- [ ] Test enrollment flow end-to-end (dev server → prod database simulation)

- [ ] Verify consent text is shown correctly (no truncation, legal review)

- [ ] Confirm encryption at-rest for descriptor (if implementing)

- [ ] Document retention policy (employee handbook, privacy policy)

- [ ] Legal review of consent language (UU PDP Article 1 compliance)

- [ ] Train SPV/Leaders on enrollment procedure + privacy obligations

- [ ] Set up audit logging for enrollment events

- [ ] Create runbook for crew data deletion requests

---

## 🔔 Future Considerations

### Phase 2 (Post-MVP)
- [ ] Descriptor encryption (app-level AES)
- [ ] Re-enrollment approval workflow
- [ ] Automated data deletion on crew exit (soft-delete + 90-day grace)
- [ ] Crew self-service: export/delete face data
- [ ] DPIA & formal compliance audit

### Phase 3 (Long-term)
- [ ] Liveness detection improvements (eye blink, mouth movement)
- [ ] Anti-spoofing: multiple modalities (face + fingerprint?)
- [ ] Graduated consent (different retention tiers)
- [ ] Regional compliance alignment (GDPR if EU expansion)

---

**Owner:** Dev Suka Shawarma  
**Reviewed by:** [Legal/Compliance team — pending]  
**Related:** `ENROLLMENT-PROCESS.md`, `ROLE-JOBDESK.md`, `CLAUDE.md`

---

## Quick Fix Checklist (Session 2026-06-22)

- ✅ Page-level role guard added to `/dashboard/enroll`
- ✅ Consent audit trail implemented (`consent_at`, `consent_by`)
- ✅ Threshold validated (0.25, field-tested)
- ❌ Encryption at-rest — **TODO** (next sprint)
- ❌ Re-enrollment workflow — **TODO** (next sprint)
- ❌ DPIA — **TODO** (compliance team)
