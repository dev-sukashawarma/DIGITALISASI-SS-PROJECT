# Sukashawarma Linktree Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membuat halaman Linktree-style untuk SUKA Shawarma sebagai static HTML yang menjadi pusat navigasi ke outlet, kemitraan, order, dan TikTok.

**Architecture:** Single static `index.html` dengan inline CSS yang mengimport design tokens dari `SUKA Shawarma Design System/colors_and_type.css`. Layout mobile-first 480px, hero section + 4 tombol card bertumpuk. Tidak perlu JavaScript.

**Tech Stack:** Vanilla HTML5, CSS3, Google Fonts (Lilita One + Plus Jakarta Sans), SUKA Shawarma Design System tokens.

---

## File Structure

```
D:\MIT\CLAUDE CODE PROJECT\LINKTREE SS\
├── index.html                          ← CREATE (halaman utama)
├── SUKA Shawarma Design System\
│   ├── colors_and_type.css             ← READ ONLY (design tokens)
│   └── assets\
│       └── logo.png                    ← READ ONLY (brand logo)
└── docs\superpowers\
    ├── specs\2026-06-05-sukashawarma-linktree-design.md
    └── plans\2026-06-05-sukashawarma-linktree.md
```

---

### Task 1: Buat struktur HTML dasar + design tokens

**Files:**
- Create: `index.html`

- [ ] **Step 1: Buat `index.html` dengan boilerplate SUKA Shawarma**

```html
<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>SUKA Shawarma</title>
  <link rel="stylesheet" href="SUKA Shawarma Design System/colors_and_type.css" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      min-height: 100vh;
      background: var(--bg);
      display: flex;
      justify-content: center;
      align-items: flex-start;
    }

    .phone {
      width: 100%;
      max-width: var(--container-mobile);
      min-height: 100vh;
      background: var(--bg);
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: var(--space-8) var(--gutter) var(--space-10);
    }

    @media (min-width: 500px) {
      body { background: #e8e8e8; align-items: flex-start; padding: 32px 0; }
      .phone {
        min-height: unset;
        border: 1px solid var(--line-2);
        box-shadow: 0 4px 32px rgba(64,10,7,.10);
        border-radius: var(--radius-lg);
        margin: 0 auto;
      }
    }
  </style>
</head>
<body>
  <div class="phone">
    <!-- hero dan tombol akan ditambahkan di task berikutnya -->
  </div>
</body>
</html>
```

- [ ] **Step 2: Buka file di browser dan verifikasi background cream muncul**

Buka `index.html` di browser. Expected: halaman dengan background `#fff7ed` (krem hangat), bukan putih atau abu-abu.

- [ ] **Step 3: Commit**

```bash
git init
git add index.html
git commit -m "feat: init halaman linktree sukashawarma"
```

---

### Task 2: Hero Section — logo, nama, tagline

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Tambahkan hero section di dalam `.phone`**

Ganti komentar `<!-- hero dan tombol -->` dengan:

```html
<!-- ─── Hero ─────────────────────────────────────────────────────── -->
<div class="hero">
  <img
    src="SUKA Shawarma Design System/assets/logo.png"
    alt="SUKA Shawarma"
    class="hero-logo"
  />
  <h1 class="hero-name">🌯 SUKA Shawarma</h1>
  <p class="hero-tagline">Besar dan Nikmat</p>
</div>
```

- [ ] **Step 2: Tambahkan CSS untuk hero section di dalam `<style>`**

```css
/* ─── Hero ─────────────────────────────────────────────────────────── */
.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding-bottom: var(--space-8);
  text-align: center;
}

.hero-logo {
  width: 88px;
  height: 88px;
  object-fit: contain;
  border-radius: var(--radius);
  filter: drop-shadow(0 4px 12px rgba(242,151,68,.25));
}

.hero-name {
  font-family: var(--font-display);
  font-size: 28px;
  font-weight: 400;
  color: var(--suka-brown);
  line-height: var(--lh-tight);
  letter-spacing: 0;
}

.hero-tagline {
  font-family: var(--font-sans);
  font-size: var(--fs-h3);
  font-weight: 600;
  color: var(--fg2);
  margin: 0;
  line-height: var(--lh-snug);
}
```

- [ ] **Step 3: Verifikasi di browser**

Buka `index.html`. Expected:
- Logo chef muncul, ~88px, dengan soft orange drop-shadow
- Nama "🌯 SUKA Shawarma" dengan font Lilita One, warna coklat
- Tagline "Besar dan Nikmat" di bawahnya, Plus Jakarta Sans 600

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: tambah hero section — logo, nama, tagline"
```

---

### Task 3: Tombol cards — Outlet, Kemitraan, Order, TikTok

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Tambahkan markup 4 tombol setelah `.hero`**

```html
<!-- ─── Link Cards ──────────────────────────────────────────────────── -->
<nav class="links">

  <a href="/outlet" class="link-card">
    <span class="link-icon">📍</span>
    <span class="link-body">
      <span class="link-label">Outlet Kami</span>
      <span class="link-sub">19 outlet se-Indonesia</span>
    </span>
    <span class="link-arrow">›</span>
  </a>

  <a href="/kemitraan" class="link-card">
    <span class="link-icon">🤝</span>
    <span class="link-body">
      <span class="link-label">Kemitraan</span>
      <span class="link-sub">Bergabung bersama kami</span>
    </span>
    <span class="link-arrow">›</span>
  </a>

  <a href="https://order.sukashawarma.com" class="link-card link-card--primary" target="_blank" rel="noopener">
    <span class="link-icon">🛒</span>
    <span class="link-body">
      <span class="link-label">Order Sekarang</span>
      <span class="link-sub">Pickup di outlet terdekat</span>
    </span>
    <span class="link-arrow">›</span>
  </a>

  <a href="https://www.tiktok.com/@sukashawarmaofficial" class="link-card" target="_blank" rel="noopener">
    <span class="link-icon">🎵</span>
    <span class="link-body">
      <span class="link-label">TikTok</span>
      <span class="link-sub">@sukashawarmaofficial</span>
    </span>
    <span class="link-arrow">›</span>
  </a>

</nav>
```

- [ ] **Step 2: Tambahkan CSS untuk link cards di dalam `<style>`**

```css
/* ─── Link Cards ────────────────────────────────────────────────────── */
.links {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.link-card {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4);
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  border: 1px solid var(--line);
  text-decoration: none;
  color: inherit;
  transition: transform 80ms ease, box-shadow 80ms ease;
  -webkit-tap-highlight-color: transparent;
}

.link-card:active {
  transform: scale(.99);
  box-shadow: var(--shadow-sm);
}

/* Primary CTA — Order Sekarang */
.link-card--primary {
  background: var(--suka-orange);
  border-color: var(--suka-orange-deep);
  box-shadow: var(--shadow-brand);
}

.link-card--primary .link-label,
.link-card--primary .link-sub,
.link-card--primary .link-arrow {
  color: #ffffff;
}

.link-icon {
  font-size: 28px;
  line-height: 1;
  flex-shrink: 0;
  width: 40px;
  text-align: center;
}

.link-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.link-label {
  font-family: var(--font-sans);
  font-size: var(--fs-h3);
  font-weight: 700;
  color: var(--fg1);
  line-height: var(--lh-tight);
}

.link-sub {
  font-size: var(--fs-caption);
  color: var(--fg-muted);
  line-height: var(--lh-snug);
}

.link-arrow {
  font-size: 20px;
  color: var(--fg-faint);
  flex-shrink: 0;
  font-weight: 300;
}
```

- [ ] **Step 3: Verifikasi di browser**

Buka `index.html`. Expected:
- 4 tombol card muncul bertumpuk vertikal
- Tombol "Order Sekarang" berwarna orange (`#f29744`) dengan teks putih
- 3 tombol lainnya putih dengan shadow hangat
- Tap/click menghasilkan `scale(.99)` (terlihat saat di-inspect atau di mobile)
- Emoji icon, label bold, sub-label muted, arrow `›` di kanan

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: tambah 4 link cards — outlet, kemitraan, order, tiktok"
```

---

### Task 4: Polish — hover states, footer credit, meta tags

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Tambahkan hover state untuk desktop di CSS**

Tambahkan di dalam `<style>`:

```css
/* ─── Desktop hover ────────────────────────────────────────────────── */
@media (hover: hover) {
  .link-card:not(.link-card--primary):hover {
    background: var(--surface-2);
    transform: translateY(-1px);
    box-shadow: var(--shadow-lg);
  }

  .link-card--primary:hover {
    background: var(--suka-orange-deep);
    transform: translateY(-1px);
  }
}
```

- [ ] **Step 2: Tambahkan footer credit di bawah `.links`**

```html
<!-- ─── Footer ─────────────────────────────────────────────────────── -->
<footer class="footer">
  <span>🌯 SUKA Shawarma · Besar dan Nikmat</span>
</footer>
```

CSS:

```css
/* ─── Footer ───────────────────────────────────────────────────────── */
.footer {
  margin-top: var(--space-8);
  font-size: var(--fs-caption);
  color: var(--fg-faint);
  text-align: center;
}
```

- [ ] **Step 3: Tambahkan meta tags SEO + theme-color di `<head>`**

Tambahkan setelah `<title>`:

```html
<meta name="description" content="SUKA Shawarma — Besar dan Nikmat. Order pickup, cek outlet, dan info kemitraan." />
<meta name="theme-color" content="#f29744" />
<meta property="og:title" content="SUKA Shawarma" />
<meta property="og:description" content="Besar dan Nikmat" />
<meta property="og:image" content="SUKA Shawarma Design System/assets/logo.png" />
```

- [ ] **Step 4: Verifikasi tampilan akhir di browser**

Buka `index.html` di browser (desktop & mobile view di DevTools). Checklist:
- [ ] Background cream, bukan putih
- [ ] Logo muncul dengan drop-shadow orange
- [ ] Font Lilita One load untuk nama brand (butuh koneksi internet untuk Google Fonts)
- [ ] 4 card terlihat rapi, Order card berwarna orange
- [ ] Di desktop, card memiliki hover effect
- [ ] Footer credit muncul di bawah

- [ ] **Step 5: Commit final**

```bash
git add index.html
git commit -m "feat: polish — hover states, footer, meta tags SEO"
```

---

### Task 5: Audit dengan design skills

**Files:**
- Modify: `index.html` (jika ada temuan dari audit)

- [ ] **Step 1: Jalankan impeccable audit**

Invoke skill `impeccable` dan minta audit halaman `index.html` untuk:
- Anti-pattern check (generic AI slop, boring spacing, flat hierarchy)
- Visual polish (shadow consistency, typography rhythm, color usage)

- [ ] **Step 2: Jalankan emil-design-eng check**

Invoke skill `emil-design-eng` dan periksa:
- Apakah tap/press feedback terasa natural di mobile
- Apakah arrow `›` dan spacing terasa polished
- Micro-interaction quality pada `.link-card:active`

- [ ] **Step 3: Jalankan design-taste-frontend check**

Invoke skill `design-taste-frontend` dan periksa:
- Apakah layout terlihat seperti desain yang intentional, bukan template
- Apakah hierarki visual (hero → primary CTA → secondary links) terbaca jelas

- [ ] **Step 4: Apply temuan**

Terapkan semua saran dari audit yang valid dan commit:

```bash
git add index.html
git commit -m "polish: apply impeccable + emil + taste audit findings"
```
