# Per-Role Test Suite — Design (Manual Checklist)

**Date:** 2026-06-20
**Status:** Approved (brainstorming) — **pivot ke checklist MANUAL** (bukan Playwright otomatis)
**Owner:** Dev Suka Shawarma

## Goal

Checklist tes **manual** yang dijalankan tester lewat browser sendiri untuk
memverifikasi **matriks akses role → aplikasi** untuk ke-7 role
(`admin`, `owner`, `spv`, `leader`, `kasir`, `crew`, `kiosk`).

Bukan tes otomatis. Tidak ada Playwright. Output = satu dokumen checklist berisi
langkah + hasil yang diharapkan, dengan kotak centang per langkah.

## Scope

- **Tier:** login portal + tampilan launcher per role + akses guard tiap app
  (allow/deny). Bukan alur operasional dalam app (jual, opname, dll).
- **Semua 7 role.** Role SSO manusia lewat portal; `kiosk` terpisah (QR/device).
- **Lingkungan:** subdomain deploy (`*.sukashawarma.com`) — guard aktif penuh
  (termasuk owner-dashboard yang skip enforcement di `localhost`).
- **Read-only:** hanya login + navigasi. Tidak ada perubahan data operasional.
  Pakai akun test khusus.

## Sumber kebenaran matriks

Matriks akses diambil dari `docs/ROLE-JOBDESK.md` (§ Matriks Akses Role → Aplikasi)
dan konstanta `ROLE_APP_ACCESS` di `packages/auth/src/access.ts`. Checklist harus
selalu cocok dengan keduanya.

| Role | pos-kasir | absensi | stok | distribusi | owner-dashboard | admin-dashboard |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (auto-redirect) |
| owner | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| spv | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| leader | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| kasir | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| crew | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| kiosk | ✅ (mode kiosk) | ❌ | ❌ | ❌ | ❌ | ❌ |

## Bentuk dokumen

Satu file: `docs/QA-CHECKLIST-ROLE.md`.

Struktur:
- **Persiapan:** daftar akun test per role (kolom diisi tester), URL tiap app,
  catatan keamanan (read-only).
- **Bagian per role** (7 bagian). Tiap bagian:
  - Langkah login portal + hasil yang diharapkan.
  - Cek launcher: app yang TAMPIL vs TIDAK tampil (sesuai matriks).
  - Cek akses tiap app: buka URL app → diizinkan masuk / ditolak (redirect ke
    portal) sesuai matriks. Kotak centang per app.
  - Kasus khusus role (mis. admin auto-redirect, kiosk lewat QR bukan portal).
- **Catatan kendala yang sudah diketahui** (lihat di bawah).
- **Ringkasan hasil:** tabel tanda tangan/ tanggal/ pass-fail per role.

## Kendala yang sudah diketahui (dicatat di checklist)

- **pos-kasir tidak punya middleware SSO portal** (alur kiosk QR). Penolakan guard
  tidak bisa diuji via redirect; pos-kasir dicek di level launcher + perilaku app,
  dengan catatan eksplisit.
- **owner-dashboard skip enforcement di `localhost`** — checklist dijalankan di
  subdomain deploy supaya guard aktif.
- **kiosk** login via QR device (alur `qr-login` pos-kasir), bukan email/password
  portal. Bagian kiosk berisi langkah: pastikan kredensial kiosk DITOLAK di portal,
  lalu langkah verifikasi mode kiosk di pos-kasir (manual via device/QR).

## Out of scope

- Tes otomatis (Playwright) — dibatalkan sesuai keputusan.
- Alur operasional mendalam per app.
- Seed/script akun test (tester pakai akun yang ada).
