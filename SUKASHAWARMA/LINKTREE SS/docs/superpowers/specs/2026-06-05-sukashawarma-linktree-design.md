# Sukashawarma Linktree Page — Design Spec

**Date:** 2026-06-05
**Status:** Approved

---

## Overview

Halaman Linktree-style untuk SUKA Shawarma — satu halaman mobile-first yang
menjadi pusat navigasi ke semua touchpoint brand: outlet, kemitraan, order, dan
TikTok. Dibangun sebagai static HTML menggunakan design system SUKA Shawarma
yang sudah ada.

---

## Content & Information Architecture

Urutan konten (atas ke bawah):

1. **Hero** — logo + nama brand + tagline
2. **Outlet** — link ke halaman outlet yang sudah ada
3. **Kemitraan** — link ke halaman kemitraan
4. **Order Sekarang** — link ke order.sukashawarma.com (primary CTA)
5. **TikTok** — link ke @sukashawarmaofficial

---

## Visual Design

### Approach
Card Stack — single-scroll, hero di atas, 4 tombol card bertumpuk vertikal.
Konsisten dengan design language SUKA (mobile-first 480px, warm cream bg,
card + shadow system).

### Hero Section
- Logo: `SUKA Shawarma Design System/assets/logo.png`, centered, ~80px tinggi
- Nama: `🌯 SUKA Shawarma` — font `Lilita One`, warna `--suka-brown`
- Tagline: `Besar dan Nikmat` — `Plus Jakarta Sans` 600, warna `--suka-ink-2`
- Background: `--suka-cream` (#fff7ed)

### Tombol Cards

| # | Emoji | Label | Sub-label | Destination |
|---|---|---|---|---|
| 1 | 📍 | Outlet Kami | 19 outlet se-Indonesia | /outlet (halaman outlet existing) |
| 2 | 🤝 | Kemitraan | Bergabung bersama kami | /kemitraan |
| 3 | 🛒 | Order Sekarang | Pickup di outlet terdekat | https://order.sukashawarma.com |
| 4 | 🎵 | TikTok | @sukashawarmaofficial | https://www.tiktok.com/@sukashawarmaofficial |

### Card Styling
- Background: `--surface` (white)
- Border-radius: `--radius` (14px)
- Shadow: `--shadow` (warm 2-stop)
- Padding: 16px
- Hover/tap: `transform: scale(.99)`, transition 80ms
- Tombol **Order Sekarang** dibedakan: background `--suka-orange`, text putih,
  shadow `--shadow-brand` — sebagai primary CTA

### Layout
- `.phone` shell max 480px, centered
- Import `colors_and_type.css` dari design system
- Vanilla HTML + CSS, tidak perlu framework
- File output: `index.html` di root project

---

## Technical Constraints

- Static HTML — tidak perlu server/backend
- Import font dari Google Fonts (Lilita One + Plus Jakarta Sans)
- Gunakan design tokens dari `SUKA Shawarma Design System/colors_and_type.css`
- Mobile-first, responsive pada desktop (column centered dengan outer shadow)
- Tidak ada JavaScript yang diperlukan (semua link `<a href>` biasa)

---

## Skills yang Digunakan saat Implementasi

- `frontend-design` — struktur dan implementasi komponen
- `impeccable` — audit anti-slop, polish visual
- `emil-design-eng` — micro-interactions, detail UI
- `design-taste-frontend` (taste-skill) — design taste check
