---
name: absensi-rls-embed-gotcha
description: Supabase embed (JOIN) di select ikut tunduk RLS tabel yang di-embed — bisa membuang seluruh baris induk, bukan cuma null-kan field
metadata:
  type: project
---

Ditemukan di `apps/absensi/src/app/dashboard/rekap/page.tsx`: query `attendance` pakai embed `outlet_staff(name)`. Kalau baris `outlet_staff` yang di-embed tak lolos RLS SELECT untuk user yang login, PostgREST **membuang seluruh baris induk** (attendance) dari hasil — bukan sekadar mengosongkan field `outlet_staff`. Gejalanya: staff yang sudah absen ("Masuk" di [[papan-kehadiran]] yang query-nya tanpa embed) muncul sebagai "Alpha" di rekap, karena baris attendance-nya lenyap total dari hasil query.

**Penyebab kongkret kasus ini:** kemungkinan migration drift — role `kepala_outlet` di-rename ke `leader` (`20260620000000_rename_role_kepala_outlet_to_leader.sql`), fungsi `auth_is_supervisor()` di-update untuk cover `leader`, tapi kalau migration ini belum ter-apply penuh di production, RLS `outlet_staff_read_own_outlet` masih pakai definisi lama → user role `leader` tak bisa baca baris `outlet_staff` kolega → embed gagal senyap.

**Aturan aman:** hindari embed lintas-tabel di query yang RLS-nya berbeda ketat antar tabel (attendance vs outlet_staff). Fetch terpisah lalu gabung di client (pakai `Map` by id) — pola yang dipakai [[papan-kehadiran]] & sekarang juga di rekap. Lebih verbose tapi tak rapuh terhadap RLS drift. (Fix commit `f88ee53`, sesi 2026-07-02.)

Terkait: [[absensi-face-model-config-gotcha]] — sesi yang sama, dua bug berbeda di app yang sama dalam satu hari.
