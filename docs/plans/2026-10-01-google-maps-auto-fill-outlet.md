# Google Maps Auto-Fill Outlet Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Menyediakan fitur quick-fill pada form outlet (`OutletForm.tsx`) sehingga admin cukup menempelkan link Google Maps (short link HP, link browser, maupun koordinat mentah) dan sistem secara otomatis mengekstrak koordinat presisi, alamat lengkap Bahasa Indonesia yang mudah dibaca, serta nama outlet tanpa mengganggu fitur yang sudah ada (zero regression).

**Architecture:** Server Action `resolveLokasiGoogleMaps` di Next.js App Router menangani unshorten redirect (bebas CORS) dan reverse geocoding via OpenStreetMap Nominatim secara aman dengan rate-limiting & cache. Frontend `OutletForm.tsx` menyematkan Quick-Fill Bar modern di bagian atas modal form untuk mengisi state form (`lat`, `lng`, `address`, dan `name`/`slug` jika masih kosong) serta menyajikan badge verifikasi tautan peta.

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, TypeScript, Tailwind CSS, Lucide React (`MapPin`, `Loader2`, `ExternalLink`, `CheckCircle2`), Sonner (toast), Vitest.

---

### Task 1: Unit Tests untuk Parser Link & Format Alamat Lokasi

**Files:**
- Create: `apps/admin-dashboard/src/lib/lokasi/googleMapsLink.test.ts`
- Create: `apps/admin-dashboard/src/lib/lokasi/formatAlamat.test.ts`
- Reference: `apps/admin-dashboard/src/lib/lokasi/googleMapsLink.ts`
- Reference: `apps/admin-dashboard/src/lib/lokasi/formatAlamat.ts`

**Step 1: Tulis unit test untuk `googleMapsLink.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import {
  bacaTempelanLokasi,
  hostGoogleMapsDiizinkan,
  parseDms,
  diLuarIndonesia,
} from './googleMapsLink'

describe('googleMapsLink parser', () => {
  it('mendeteksi short link maps.app.goo.gl sebagai link_pendek', () => {
    const res = bacaTempelanLokasi('https://maps.app.goo.gl/w1nL6wS8T4e9yJ128')
    expect(res.jenis).toBe('link_pendek')
    if (res.jenis === 'link_pendek') {
      expect(res.url).toBe('https://maps.app.goo.gl/w1nL6wS8T4e9yJ128')
    }
  })

  it('mengekstrak koordinat pin dari parameter data !3d !4d', () => {
    const url = 'https://www.google.com/maps/place/Suka+Shawarma/@-6.597143,106.806038,17z/data=!3m1!4b1!4m6!3m5!1s0x2e69c5e!8m2!3d-6.597143!4d106.806038!16s'
    const res = bacaTempelanLokasi(url)
    expect(res.jenis).toBe('titik')
    if (res.jenis === 'titik') {
      expect(res.titik.lat).toBeCloseTo(-6.597143, 5)
      expect(res.titik.lng).toBeCloseTo(106.806038, 5)
      expect(res.titik.akurasi).toBe('pin')
      expect(res.namaTempat).toBe('Suka Shawarma')
    }
  })

  it('mengekstrak koordinat dari format koma desimal langsung', () => {
    const res = bacaTempelanLokasi('-6.597143, 106.806038')
    expect(res.jenis).toBe('titik')
    if (res.jenis === 'titik') {
      expect(res.titik.lat).toBeCloseTo(-6.597143, 5)
      expect(res.titik.lng).toBeCloseTo(106.806038, 5)
      expect(res.titik.akurasi).toBe('pin')
    }
  })

  it('menolak link di luar domain google maps', () => {
    expect(hostGoogleMapsDiizinkan('evil.com')).toBe(false)
    expect(hostGoogleMapsDiizinkan('maps.app.goo.gl')).toBe(true)
    expect(hostGoogleMapsDiizinkan('www.google.com')).toBe(true)
    const res = bacaTempelanLokasi('https://evil.com/fake-maps')
    expect(res.jenis).toBe('bukan_link_maps')
  })
})
```

**Step 2: Tulis unit test untuk `formatAlamat.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { formatAlamat } from './formatAlamat'

describe('formatAlamat', () => {
  it('menyusun alamat berurutan tanpa duplikasi kelurahan/suburb', () => {
    const alamat = formatAlamat({
      road: 'Jalan Pajajaran',
      house_number: '12',
      suburb: 'Sukasari',
      city_district: 'Bogor Timur',
      city: 'Kota Bogor',
      state: 'Jawa Barat',
      postcode: '16142',
    })
    expect(alamat).toBe('Jalan Pajajaran No. 12, Sukasari, Bogor Timur, Kota Bogor, Jawa Barat 16142')
  })

  it('mengembalikan null jika objek kosong', () => {
    expect(formatAlamat(null)).toBeNull()
    expect(formatAlamat(undefined)).toBeNull()
    expect(formatAlamat({})).toBeNull()
  })
})
```

**Step 3: Jalankan Vitest untuk memverifikasi parser & format alamat**
- Command: `npx vitest run src/lib/lokasi/` di `apps/admin-dashboard`
- Expected: All tests PASS.

**Step 4: Commit**
```bash
git add apps/admin-dashboard/src/lib/lokasi/
git commit -m "test: add unit tests for google maps parser and address formatter"
```

---

### Task 2: Integrasi Quick-Fill Google Maps di `OutletForm.tsx`

**Files:**
- Modify: `apps/admin-dashboard/src/components/OutletForm.tsx`
- Reference: `apps/admin-dashboard/src/app/dashboard/outlets/lokasiActions.ts`

**Step 1: Buat state & handler untuk Quick-Fill di `OutletForm.tsx`**

1. Import icon dari `lucide-react`: `MapPin`, `Loader2`, `CheckCircle2`, `ExternalLink`.
2. Import server action `resolveLokasiGoogleMaps` dari `@/app/dashboard/outlets/lokasiActions`.
3. Tambahkan local state:
   - `mapsInput`: string
   - `extracting`: boolean
   - `extractedInfo`: `{ lat: number; lng: number; akurasi: string; alamat: string | null } | null`
4. Buat fungsi `handleEkstrakLokasi`:
   - Cegah form submit default jika dipicu via Enter.
   - Panggil `resolveLokasiGoogleMaps(mapsInput.trim())`.
   - Jika `!res.ok`: munculkan `toast.error(res.pesan)`.
   - Jika `res.ok`:
     - Update state koordinat `lat: res.lat, lng: res.lng`.
     - Update state `address: res.alamat || prev.address`.
     - Jika `res.namaTempat` ada dan `!v.name.trim()`, otomatis isi `name` dan update `slug`.
     - Simpan info ekstraksi di `extractedInfo` untuk memunculkan badge sukses.
     - Tampilkan `toast.success('Lokasi berhasil diekstrak')`.

**Step 2: Render Quick-Fill Box di UI**

Ganti tombol `prompt()` teks oranye lama:
```tsx
      <div className="sm:col-span-2">
        <button type="button" onClick={onPaste} className="text-xs font-medium text-suka-orange">
          Paste dari Google Maps
        </button>
      </div>
```
Dengan komponen Quick-Fill Card di atas kolom Nama:
```tsx
      {/* Quick-Fill dari Google Maps */}
      <div className="sm:col-span-2 rounded-2xl border border-suka-orange/20 bg-orange-50/40 p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-suka-orange">
            <MapPin className="w-3.5 h-3.5" />
            <span>Quick-Fill dari Google Maps</span>
          </div>
          <span className="text-[11px] text-suka-gray-500">
            Dukung link share HP, link web, atau koordinat
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              className="w-full rounded-xl border border-suka-gray-200 bg-white px-3 py-2 text-xs sm:text-sm outline-none focus:border-suka-orange transition-colors"
              placeholder="Tempel link Google Maps (maps.app.goo.gl / google.com/maps) atau koordinat..."
              value={mapsInput}
              onChange={(e) => setMapsInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleEkstrakLokasi()
                }
              }}
              disabled={extracting}
            />
          </div>
          <button
            type="button"
            onClick={handleEkstrakLokasi}
            disabled={extracting || !mapsInput.trim()}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-suka-orange text-white text-xs font-medium hover:bg-suka-orange-dark disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm shrink-0"
          >
            {extracting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Mengekstrak...</span>
              </>
            ) : (
              <>
                <MapPin className="w-3.5 h-3.5" />
                <span>Ekstrak Lokasi</span>
              </>
            )}
          </button>
        </div>

        {extractedInfo && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-emerald-700 bg-emerald-50/80 border border-emerald-200 rounded-xl px-3 py-1.5">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Titik & Alamat berhasil diekstrak ({extractedInfo.lat.toFixed(5)}, {extractedInfo.lng.toFixed(5)})</span>
            </div>
            <a
              href={`https://www.google.com/maps?q=${extractedInfo.lat},${extractedInfo.lng}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-800 hover:underline"
            >
              <span>Lihat di Maps</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>
```

**Step 3: Jaga 100% Fitur Form Lama (Zero Regression)**
- Pertahankan semua kolom: `Nama`, `Slug` (termasuk tombol ubah slug saat edit), `Alamat`, `Latitude`, `Longitude`, `Tipe`, `Batas Peringatan Porsi`, `Jam Buka`, `Jam Tutup`, `Aktif`.
- Input manual tetap berfungsi normal jika admin ingin mengetik atau mengubah apa pun.
- Validasi wajib dan alur `onSubmit` tidak diubah sama sekali.

**Step 4: Verifikasi Type Checking**
- Command: `npm run lint` di `apps/admin-dashboard`
- Expected: No type errors.

**Step 5: Commit**
```bash
git add apps/admin-dashboard/src/components/OutletForm.tsx
git commit -m "feat(outlets): add google maps quick-fill to outlet form"
```

---

### Task 3: Verifikasi E2E & Validasi Pengujian

**Files:**
- Test with sample real Google Maps links and raw coordinate inputs.

**Step 1: Test berbagai variasi input**
- Uji input link pendek: `https://maps.app.goo.gl/...`
- Uji input web link desktop lengkap
- Uji input angka koordinat mentah: `-6.597143, 106.806038`
- Uji link invalid: tampilkan toast pesan error yang ramah pengguna tanpa merusak state form.

**Step 2: Test Form Submission**
- Pastikan outlet baru berhasil dibuat dan masuk ke database dengan data koordinat & alamat yang akurat.
- Pastikan mode edit outlet (`isEdit = true`) tidak mengalami perubahan data yang tidak diinginkan.

**Step 3: Final Commit**
```bash
git add .
git commit -m "chore: finalize google maps auto-fill for outlets"
```
