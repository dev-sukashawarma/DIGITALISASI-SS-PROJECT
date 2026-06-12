# Attract Screen (Cover Screen) — Design Spec
Date: 2026-06-06

## Overview

Tambahkan attract screen bergaya kiosk MCD ke sistem POS Shawarma. Saat tidak ada aktivitas, layar menampilkan gambar promo fullscreen dengan teks "Ketuk di mana saja untuk memesan". User tap → masuk ke menu. Idle 15 detik tanpa aktivitas → kembali ke attract screen dan cart di-reset.

---

## 1. Flow & State

### State
Di `app/page.tsx`, tambahkan satu state:
```ts
const [isIdle, setIsIdle] = useState(true)
```
Default `true` agar attract screen tampil pertama kali saat halaman dibuka.

### Render logic
- `isIdle === true` → render `<AttractScreen onStart={() => setIsIdle(false)} coverUrl={...} />`
- `isIdle === false` → render halaman menu seperti biasa

`<AttractScreen>` dirender sebagai `fixed inset-0 z-50`, overlay di atas menu.

### Idle timer
- Aktif hanya saat `isIdle === false`
- Event listener: `click`, `touchstart`, `mousemove`, `keydown` pada `window`
- Setiap event → reset timer 15 detik
- Timer habis → `setIsIdle(true)` + reset cart (`clearCart()` dari store)
- Cleanup event listener saat `isIdle` kembali `true`

### Cart reset
Saat kembali ke attract screen (idle timeout), panggil `clearCart()` dari `store/cart.ts` agar sesi bersih untuk user berikutnya.

---

## 2. AttractScreen Component

**File:** `components/AttractScreen.tsx`

**Props:**
```ts
interface AttractScreenProps {
  onStart: () => void
  coverUrl: string | null
}
```

**Layout:**
- `fixed inset-0 z-50 bg-black` — fullscreen overlay
- Gambar cover: `<img>` atau `<Image>` Next.js dengan `object-fit: cover`, fullscreen
- Fallback: background gradient brand (amber) jika `coverUrl` null
- Teks **"Ketuk di mana saja untuk memesan"** — posisi `absolute bottom-16 left-0 right-0 text-center`, warna putih, animasi `animate-pulse`
- Animasi masuk: `animate-fade-in` (sudah ada di globals.css)
- Animasi keluar: state internal `isLeaving` — set `true` saat tap, tambah class `animate-fade-out`, setelah 200ms baru panggil `onStart()`
- `onClick` pada container → trigger `onStart`

---

## 3. Admin Panel — Upload Cover Image

### Database
Tabel baru di Supabase: `kiosk_settings`
```sql
create table kiosk_settings (
  key   text primary key,
  value text
);
-- seed
insert into kiosk_settings (key, value) values ('cover_image_url', null);
```

### Storage
Bucket Supabase Storage: `kiosk-assets` (public read)

### Admin UI
Halaman baru: `app/admin/settings/page.tsx`
- Tampilkan preview gambar cover saat ini (jika ada)
- Tombol upload gambar → upload ke `kiosk-assets/cover.jpg` di Supabase Storage
- Setelah upload, update row `cover_image_url` di tabel `kiosk_settings`
- Tambahkan link "Settings" di `components/AdminNav.tsx`

### Data fetch di `app/page.tsx`
Fetch `cover_image_url` dari `kiosk_settings` bersamaan dengan fetch menu & kategori:
```ts
supabase.from('kiosk_settings').select('value').eq('key', 'cover_image_url').single()
```

---

## 4. File Changes Summary

| File | Perubahan |
|------|-----------|
| `app/page.tsx` | Tambah state `isIdle`, idle timer logic, fetch `cover_image_url`, render `<AttractScreen>` |
| `components/AttractScreen.tsx` | Komponen baru — fullscreen cover + tap handler |
| `app/admin/settings/page.tsx` | Halaman baru — upload cover image |
| `components/AdminNav.tsx` | Tambah link "Settings" |
| `app/globals.css` | Tambah animasi `fade-out` jika belum ada |
| Supabase | Buat tabel `kiosk_settings`, bucket `kiosk-assets` |

---

## 5. Out of Scope

- Slideshow multiple gambar (bisa ditambahkan nanti)
- Idle timeout yang bisa dikonfigurasi dari admin (hardcode 15 detik untuk development)
- Suara/video di attract screen
