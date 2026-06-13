# Remote Realtime Kiosk Logout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans / subagent-driven-development.

**Goal:** Kasir dapat me-logout tablet kiosk cabangnya dari jarak jauh secara realtime (hard logout).

**Architecture:** Supabase Realtime Presence (daftar kiosk online) + Broadcast (sinyal instan) + API route service-role (cabut sesi server, hard). 1 akun = 1 tablet. Tanpa perubahan skema DB.

**Tech Stack:** Next.js 14 (App Router), Supabase (ssr, supabase-js, Realtime), vitest (node).

---

## File Structure

- Create `lib/kiosk-logout.ts` — pure helper resolusi target + validasi (TDD).
- Create `tests/kiosk-logout.test.ts` — unit test helper.
- Create `app/api/kiosk/logout/route.ts` — API hard logout (auth, revoke, broadcast).
- Create `lib/useKioskControl.ts` — hook kiosk: presence + listen force_logout.
- Create `components/KioskControlPanel.tsx` — panel kasir: daftar kiosk online + tombol logout.
- Create `app/kasir/kiosk/page.tsx` — halaman kasir untuk panel.
- Modify `components/KasirNav.tsx` — tambah link nav "Kiosk".
- Modify `app/page.tsx` — expose userId/username/outletId & panggil useKioskControl.

---

### Task 1: Pure helper `resolveLogoutTargets` (TDD)

**Files:** Create `lib/kiosk-logout.ts`, Test `tests/kiosk-logout.test.ts`

- [ ] Step 1: tulis test gagal (lihat kode di Task detail), jalankan `npm test` → FAIL.
- [ ] Step 2: implement helper hingga PASS.
- [ ] Step 3: commit.

Helper signature: `resolveLogoutTargets(requester, body, outletKiosks)` mengembalikan `{ok,status,targetUserIds,error}`. Aturan: role wajib `kasir`; outlet_id wajib; target `'all'` → semua kiosk outlet; target id → harus ada di daftar outlet, jika tidak 403.

### Task 2: API `/api/kiosk/logout`

**Files:** Create `app/api/kiosk/logout/route.ts`

Validasi requester via cookie → profil; ambil semua akun kiosk outletnya; panggil `resolveLogoutTargets`; untuk tiap target panggil GoTrue admin logout (`POST {URL}/auth/v1/admin/users/{id}/logout`); broadcast `force_logout` via `POST {URL}/realtime/v1/api/broadcast`. Verifikasi manual.

### Task 3: Hook kiosk `useKioskControl` + wire `app/page.tsx`

Join `kiosk-control:<outlet_id>`, track presence `{username,device_label,online_at}`, listen `force_logout` → `signOut({scope:'global'})` + `location.href='/login'`. Verifikasi manual 2 device.

### Task 4: Panel kasir + halaman + nav

`KioskControlPanel` subscribe presence (read-only), tampilkan kartu kiosk online + tombol Logout/Logout Semua (dengan konfirmasi). Halaman `/kasir/kiosk` + link nav. Verifikasi manual.

### Task 5 (opsional hardening): Realtime Authorization private channel + RLS

Didokumentasikan di spec; v1 pakai public channel (revoke selalu tervalidasi di server).

---

Verifikasi akhir: `npm test` hijau + checklist manual (kiosk muncul <3s, logout 1 device tak ganggu lain, logout semua, cabang lain tak terpengaruh).
