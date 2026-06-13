# Attract Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambahkan attract screen fullscreen bergaya kiosk MCD — menampilkan gambar promo saat idle, tap mana saja untuk mulai memesan, auto-reset setelah 15 detik tidak ada aktivitas.

**Architecture:** State `isIdle` di `app/page.tsx` mengontrol kapan `<AttractScreen>` ditampilkan sebagai fixed overlay `z-50`. Idle timer berbasis `window` event listener aktif saat `isIdle === false`; timeout reset cart dan set `isIdle = true`. Gambar cover diupload admin ke Supabase Storage bucket `kiosk-assets`, URL disimpan di tabel `kiosk_settings`.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Supabase (database + storage), Zustand (cart store)

---

## File Map

| File | Action | Tanggung Jawab |
|------|--------|----------------|
| `tailwind.config.js` | Modify | Tambah `fadeOut` keyframe + `animate-fade-out` |
| `components/AttractScreen.tsx` | Create | Fullscreen cover overlay dengan tap handler |
| `app/page.tsx` | Modify | State `isIdle`, idle timer, fetch `coverUrl`, render AttractScreen |
| `app/admin/settings/page.tsx` | Create | Upload gambar cover ke Supabase Storage |
| `components/AdminNav.tsx` | Modify | Tambah link "Settings" |

---

## Task 1: Add `animate-fade-out` to Tailwind Config

**Files:**
- Modify: `tailwind.config.js`

- [ ] **Step 1: Tambah keyframe `fadeOut` dan animation `fade-out`**

Di `tailwind.config.js`, tambahkan ke dalam `animation` dan `keyframes`:

```js
// Di dalam theme.extend.animation — tambahkan setelah baris 'spin-slow':
'fade-out': 'fadeOut .3s ease forwards',

// Di dalam theme.extend.keyframes — tambahkan setelah fadeIn:
fadeOut: { from: { opacity: 1 }, to: { opacity: 0 } },
```

File lengkap setelah edit (bagian `animation` dan `keyframes`):

```js
animation: {
  'fade-up':    'fadeUp .4s ease forwards',
  'fade-in':    'fadeIn .3s ease forwards',
  'fade-out':   'fadeOut .3s ease forwards',
  'slide-in':   'slideIn .35s cubic-bezier(.16,1,.3,1) forwards',
  'scale-in':   'scaleIn .2s ease forwards',
  'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
  'spin-slow':  'spin 2s linear infinite',
},
keyframes: {
  fadeUp:     { from: { opacity: 0, transform: 'translateY(12px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
  fadeIn:     { from: { opacity: 0 }, to: { opacity: 1 } },
  fadeOut:    { from: { opacity: 1 }, to: { opacity: 0 } },
  slideIn:    { from: { opacity: 0, transform: 'translateX(20px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
  scaleIn:    { from: { opacity: 0, transform: 'scale(.95)' }, to: { opacity: 1, transform: 'scale(1)' } },
  pulseSoft:  { '0%,100%': { opacity: 1 }, '50%': { opacity: .5 } },
},
```

- [ ] **Step 2: Verifikasi — restart dev server**

```bash
npm run dev
```

Pastikan tidak ada error kompilasi.

- [ ] **Step 3: Commit**

```bash
git add tailwind.config.js
git commit -m "feat: add animate-fade-out to tailwind config"
```

---

## Task 2: Set Up Supabase (Manual Steps)

**Perlu dilakukan di Supabase Dashboard sebelum melanjutkan.**

- [ ] **Step 1: Buat tabel `kiosk_settings`**

Buka Supabase Dashboard → SQL Editor, jalankan:

```sql
create table if not exists kiosk_settings (
  key   text primary key,
  value text
);

insert into kiosk_settings (key, value)
values ('cover_image_url', null)
on conflict (key) do nothing;
```

- [ ] **Step 2: Buat Storage bucket `kiosk-assets`**

Buka Supabase Dashboard → Storage → "New bucket":
- Name: `kiosk-assets`
- Public bucket: **ON** (centang)
- Klik "Save"

- [ ] **Step 3: Verifikasi**

Di SQL Editor jalankan:
```sql
select * from kiosk_settings;
```
Harus muncul satu row: `key = 'cover_image_url'`, `value = null`.

Di Storage, bucket `kiosk-assets` harus muncul dengan status Public.

---

## Task 3: Create `components/AttractScreen.tsx`

**Files:**
- Create: `components/AttractScreen.tsx`

- [ ] **Step 1: Buat file `components/AttractScreen.tsx`**

```tsx
'use client'

import { useState } from 'react'
import Image from 'next/image'

interface AttractScreenProps {
  onStart: () => void
  coverUrl: string | null
}

export default function AttractScreen({ onStart, coverUrl }: AttractScreenProps) {
  const [isLeaving, setIsLeaving] = useState(false)

  function handleTap() {
    if (isLeaving) return
    setIsLeaving(true)
    setTimeout(onStart, 300)
  }

  return (
    <div
      className={`fixed inset-0 z-50 cursor-pointer select-none
        ${isLeaving ? 'animate-fade-out' : 'animate-fade-in'}`}
      onClick={handleTap}
    >
      {coverUrl ? (
        <Image
          src={coverUrl}
          alt="Cover promo"
          fill
          className="object-cover"
          priority
          unoptimized
        />
      ) : (
        <div className="absolute inset-0 bg-amber-gradient" />
      )}

      {/* Overlay gelap agar teks terbaca di atas gambar apapun */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Tap-to-start text */}
      <div className="absolute bottom-16 left-0 right-0 text-center px-6">
        <p className="text-white text-2xl font-bold tracking-wide drop-shadow-lg animate-pulse">
          Ketuk di mana saja untuk memesan
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verifikasi TypeScript**

```bash
npx tsc --noEmit
```

Tidak boleh ada error.

- [ ] **Step 3: Commit**

```bash
git add components/AttractScreen.tsx
git commit -m "feat: add AttractScreen component"
```

---

## Task 4: Modify `app/page.tsx` — Idle Logic + AttractScreen

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Tambah imports di bagian atas**

Tambahkan setelah baris import `useCart`:
```tsx
import AttractScreen from '@/components/AttractScreen'
```

Import `useEffect` sudah ada. Pastikan juga `useRef` ditambah jika belum ada:
```tsx
import { useEffect, useState, useRef } from 'react'
```

- [ ] **Step 2: Tambah state `isIdle` dan `coverUrl`**

Setelah baris `const { totalItems, totalPrice, isOpen, toggleCart } = useCart()`, tambahkan `clearCart` dan `closeCart` dari useCart, lalu tambah state baru:

```tsx
const { totalItems, totalPrice, isOpen, toggleCart, clearCart, closeCart } = useCart()
const [isIdle, setIsIdle] = useState(true)
const [coverUrl, setCoverUrl] = useState<string | null>(null)
```

- [ ] **Step 3: Fetch `cover_image_url` dalam `fetchData`**

Ubah fungsi `fetchData` dalam `useEffect` yang sudah ada menjadi:

```tsx
async function fetchData() {
  const supabase = createClient()
  const [{ data: items }, { data: cats }, { data: setting }] = await Promise.all([
    supabase.from('menu_items').select('*, categories(id,name,sort_order)').order('sort_order'),
    supabase.from('categories').select('*').order('sort_order'),
    supabase.from('kiosk_settings').select('value').eq('key', 'cover_image_url').single(),
  ])
  setMenuItems(items ?? [])
  setCategories(cats ?? [])
  setCoverUrl(setting?.value ?? null)
  setLoading(false)
}
```

- [ ] **Step 4: Tambah idle timer `useEffect`**

Tambahkan useEffect baru setelah useEffect yang sudah ada:

```tsx
useEffect(() => {
  if (isIdle) return

  const IDLE_MS = 15_000
  let timer: ReturnType<typeof setTimeout>

  function resetTimer() {
    clearTimeout(timer)
    timer = setTimeout(() => {
      clearCart()
      closeCart()
      setIsIdle(true)
    }, IDLE_MS)
  }

  const events = ['click', 'touchstart', 'mousemove', 'keydown'] as const
  events.forEach((e) => window.addEventListener(e, resetTimer))
  resetTimer()

  return () => {
    clearTimeout(timer)
    events.forEach((e) => window.removeEventListener(e, resetTimer))
  }
}, [isIdle, clearCart, closeCart])
```

- [ ] **Step 5: Render `<AttractScreen>` di bagian atas return**

Di dalam `return (...)`, sebelum closing `</div>` paling luar (atau sebagai elemen terakhir di dalam fragment), tambahkan:

```tsx
{isIdle && (
  <AttractScreen
    onStart={() => setIsIdle(false)}
    coverUrl={coverUrl}
  />
)}
```

Letakkan tepat sebelum baris `</div>` penutup paling bawah di return statement.

- [ ] **Step 6: Verifikasi manual**

1. Buka `http://localhost:3000`
2. Harus muncul cover screen fullscreen (background amber gradient karena belum ada gambar)
3. Teks "Ketuk di mana saja untuk memesan" harus terlihat dan berdenyut (pulse)
4. Klik di mana saja → cover screen fade out, menu muncul
5. Diam 15 detik → cover screen muncul lagi, cart ter-reset

- [ ] **Step 7: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add idle attract screen to menu page"
```

---

## Task 5: Create `app/admin/settings/page.tsx`

**Files:**
- Create: `app/admin/settings/page.tsx`

- [ ] **Step 1: Buat file `app/admin/settings/page.tsx`**

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { UploadCloud, Loader2, CheckCircle2, AlertCircle, ImagePlus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const BUCKET = 'kiosk-assets'
const COVER_KEY = 'cover_image_url'

export default function SettingsPage() {
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('kiosk_settings')
        .select('value')
        .eq('key', COVER_KEY)
        .single()
      setCoverUrl(data?.value ?? null)
    }
    load()
  }, [])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)
    setSuccess(false)

    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()
      const path = `cover.${ext}`

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(path)

      const { error: dbError } = await supabase
        .from('kiosk_settings')
        .update({ value: publicUrl })
        .eq('key', COVER_KEY)

      if (dbError) throw dbError

      setCoverUrl(publicUrl)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload gagal')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pengaturan Kiosk</h1>
        <p className="text-gray-500 text-sm mt-1">Kelola tampilan attract screen</p>
      </div>

      <div className="card p-6 space-y-4">
        <h2 className="font-semibold text-gray-700">Gambar Cover Screen</h2>

        {/* Preview */}
        <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-gray-100 border border-gray-200">
          {coverUrl ? (
            <Image
              src={coverUrl}
              alt="Cover saat ini"
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
              <ImagePlus className="w-8 h-8" />
              <p className="text-sm">Belum ada gambar cover</p>
            </div>
          )}
        </div>

        {/* Upload */}
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="btn-primary w-full"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Mengupload...
              </>
            ) : (
              <>
                <UploadCloud className="w-4 h-4" />
                Upload Gambar Cover
              </>
            )}
          </button>
        </div>

        {success && (
          <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4" />
            Gambar berhasil diupload!
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-red-500 text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <p className="text-xs text-gray-400">
          Format yang didukung: JPG, PNG, WebP. Gambar akan ditampilkan fullscreen di kiosk.
          Rekomendasi rasio 16:9.
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verifikasi TypeScript**

```bash
npx tsc --noEmit
```

Tidak boleh ada error.

- [ ] **Step 3: Verifikasi manual**

1. Buka `http://localhost:3000/admin/settings`
2. Halaman harus load dengan area preview kosong
3. Klik "Upload Gambar Cover", pilih file gambar
4. Gambar harus muncul di preview setelah upload
5. Buka kiosk di tab baru (`http://localhost:3000`) → attract screen harus tampilkan gambar yang baru diupload

- [ ] **Step 4: Commit**

```bash
git add app/admin/settings/page.tsx
git commit -m "feat: add admin settings page for cover image upload"
```

---

## Task 6: Add Settings Link to AdminNav

**Files:**
- Modify: `components/AdminNav.tsx`

- [ ] **Step 1: Tambah link Settings ke array `links`**

Di `components/AdminNav.tsx`, tambahkan import `Settings` dari lucide-react:

```tsx
import { ClipboardList, Sandwich, LogOut, LayoutDashboard, Tag, Radio, BarChart3, Settings } from 'lucide-react'
```

Tambahkan entry ke array `links`:

```tsx
const links = [
  { href: '/admin/orders',     label: 'Kasir Live', icon: Radio },
  { href: '/admin',            label: 'Histori',   icon: ClipboardList },
  { href: '/admin/reports',    label: 'Laporan',   icon: BarChart3 },
  { href: '/admin/menu',       label: 'Menu',      icon: LayoutDashboard },
  { href: '/admin/categories', label: 'Kategori',  icon: Tag },
  { href: '/admin/settings',   label: 'Settings',  icon: Settings },
]
```

- [ ] **Step 2: Verifikasi manual**

1. Buka `http://localhost:3000/admin`
2. Link "Settings" harus muncul di navbar admin
3. Klik → navigasi ke `/admin/settings`
4. Link harus highlight (active state) saat di halaman settings

- [ ] **Step 3: Commit**

```bash
git add components/AdminNav.tsx
git commit -m "feat: add Settings link to admin nav"
```

---

## Checklist Akhir

- [ ] Attract screen muncul saat pertama kali buka kiosk
- [ ] Tap di mana saja → fade out, menu muncul
- [ ] Idle 15 detik → attract screen muncul lagi, cart di-reset
- [ ] Gambar cover bisa diupload lewat `/admin/settings`
- [ ] Gambar cover tampil di attract screen setelah upload
- [ ] Fallback amber gradient muncul jika belum ada gambar
