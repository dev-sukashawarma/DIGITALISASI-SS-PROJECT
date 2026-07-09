# Gudang Pusat and Outlet Kitchen Separation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengimplementasikan pemisahan logikal antara Gudang Pusat (HQ) dan Outlet Kitchen (Pusat) di database dan dokumentasi proyek.

**Architecture:** Kita akan memperbarui `CONTEXT.md` untuk merefleksikan arsitektur baru ini, lalu membuat dan menjalankan skrip migrasi (menggunakan Supabase JS client) untuk mengubah nama entitas outlet di tabel `outlets` agar penamaannya menjadi jelas secara operasional.

**Tech Stack:** Node.js, Supabase JS Client

## Global Constraints

Tidak ada perubahan struktur tabel, hanya *update* data (row) pada tabel `outlets` dan pembaruan dokumen referensi (`CONTEXT.md`).

---

### Task 1: Update CONTEXT.md

**Files:**
- Modify: `CONTEXT.md`

**Interfaces:**
- Consumes: N/A
- Produces: Konteks dokumentasi yang akurat mengenai Gudang Pusat dan Outlet Kitchen.

- [ ] **Step 1: Tambahkan deskripsi pemisahan entitas di CONTEXT.md**

Modifikasi file `CONTEXT.md` pada bagian `## Distribusi`.
Tambahkan penjelasan bahwa Gudang Pusat (Central Warehouse) dan Outlet Kitchen secara sistem dipisah. Gudang Pusat menggunakan entitas bernama `GUDANG PUSAT (HQ)` dan Outlet Kitchen menggunakan entitas `SUKA SHAWARMA KITCHEN (PUSAT)`.

- [ ] **Step 2: Commit**

```bash
git add CONTEXT.md
git commit -m "docs: update CONTEXT.md with Gudang Pusat and Outlet Kitchen logical separation rules"
```

---

### Task 2: Update Database Data (Rename Outlets)

**Files:**
- Create: `update_outlets_naming.js`

**Interfaces:**
- Consumes: Koneksi ke Supabase (dari `.env.local`).
- Produces: Data di tabel `outlets` yang sudah diperbarui.

- [ ] **Step 1: Write migration script**

Buat file `update_outlets_naming.js` dengan isi:

```javascript
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' });

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    require('dotenv').config({ path: '.env.local' });
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  // Update 'Kantor Pusat' or 'SUKA SHAWARMA HQ' to 'GUDANG PUSAT (HQ)'
  // We will rename 'SUKA SHAWARMA HQ' (slug: suka-shawarma-hq) to 'GUDANG PUSAT (HQ)'
  const { data, error } = await supabase
    .from('outlets')
    .update({ name: 'GUDANG PUSAT (HQ)' })
    .eq('slug', 'suka-shawarma-hq');

  if (error) {
    console.error("Failed to update warehouse:", error);
  } else {
    console.log("Successfully renamed SUKA SHAWARMA HQ to GUDANG PUSAT (HQ)");
  }
}

main();
```

- [ ] **Step 2: Run the script to verify it passes**

Run: `node update_outlets_naming.js`
Expected: Output "Successfully renamed SUKA SHAWARMA HQ to GUDANG PUSAT (HQ)"

- [ ] **Step 3: Commit**

```bash
git add update_outlets_naming.js
git commit -m "chore: add script to rename HQ outlet to GUDANG PUSAT (HQ)"
```
