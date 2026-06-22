# pos-kasir: Performa Perpindahan Tab — Design

## Latar Belakang

Kasir merasakan perpindahan antar-tab di `/kasir/*` (Order, Manajemen Menu, Histori, Laporan) terasa "agak laggy". Belum diuji di device outlet asli (tablet/Android), baru ditest di PC dev — jadi optimasi ini fokus pada *root cause* arsitektural yang berlaku di semua device, bukan tuning device-specific.

## Root Cause

1. **`useMyOutlet()` di-refetch dari nol di setiap mount halaman.** Hook ini memanggil `supabase.auth.getUser()` lalu query `outlet_staff` (+ join `outlets`) — dipanggil ulang oleh `KasirNav`, `/kasir`, dan duplikat manual di `/kasir/menu`. Outlet ID kasir tidak berubah selama sesi, tapi tiap pindah tab query ini jalan lagi.
2. **Tiap halaman fetch data dari nol saat mount, tanpa cache.** `/kasir` (orders), `/kasir/histori`, `/kasir/menu`, `/kasir/reports` semua pakai pola `useState` + `useEffect` manual. Pindah ke tab yang baru saja dibuka → data hilang, balik fetch dari awal → flash loading + network round-trip yang sebenarnya tidak perlu.
3. Next.js App Router prefetch `<Link>` hanya prefetch *kode route*, bukan data (karena semua fetching client-side via Supabase JS), sehingga prefetch route tidak menutupi waterfall data-fetching ini.

## Solusi

Pasang **@tanstack/react-query** sebagai caching layer (sudah dipakai konsisten di `apps/stok` dan `apps/admin-dashboard` di monorepo ini).

### 1. Outlet identity — query tunggal per sesi

- `lib/useMyOutlet.ts` diubah dari `useEffect` manual menjadi `useQuery({ queryKey: ['my-outlet'], staleTime: Infinity, gcTime: Infinity })`.
- `staleTime: Infinity` karena identitas outlet kasir tidak berubah dalam sesi login — kalau berubah (mis. admin pindahkan kasir ke outlet lain), perlu re-login untuk efek penuh karena banyak state lain (cart, dll) juga terikat sesi.
- Hook publik (`useMyOutlet()`) tetap punya signature return yang sama (`outletId`, `outletName`, `loaded`, `isBlocked`, `blockedReason`) agar semua consumer (KasirNav, page Order, dll) tidak perlu diubah — hanya internal implementasinya yang pindah ke React Query.
- Duplikat fetch outlet manual di `app/kasir/menu/page.tsx` (baris 38-45) dihapus, diganti pakai `useMyOutlet()` yang sama.
- Efek: query auth+outlet_staff hanya jalan **sekali per sesi browser** (di-cache React Query di memori), bukan tiap pindah tab.

### 2. Per-halaman: `useQuery` + polling via `refetchInterval`

| Halaman | Query key | Polling | Catatan |
|---|---|---|---|
| `/kasir` (Order) | `['orders', outletId]` | `refetchInterval: 3000` | Realtime channel tetap dipasang, dipakai untuk `queryClient.invalidateQueries` instan saat event masuk (tidak menunggu interval 3s) |
| `/kasir/histori` | `['histori', outletId, filter]` | `refetchInterval: 15000` | Filter status jadi bagian query key → ganti filter = data terpisah di cache, balik ke filter lama = instan dari cache |
| `/kasir/menu` | `['menu', outletId]` | tidak ada (refetch on window focus, default React Query) | Mutasi (`toggleAvail`, `toggleBestseller`, dst.) memanggil `queryClient.invalidateQueries(['menu', outletId])` setelah sukses, ganti pola `fetchData()` manual |
| `/kasir/reports` | `['reports', outletId, range, customStart, customEnd]` | tidak ada | Ganti range tanggal = query key baru; balik ke range yg sudah dilihat = instan dari cache (`staleTime` sekitar 30s, cukup untuk laporan yang tak perlu real-time) |

**Default `staleTime`** untuk Order & Histori: pendek (misal 3s/15s, selaras dengan interval polling) — karena datanya time-sensitive (pesanan baru harus muncul cepat). Untuk Menu & Reports: `staleTime` lebih panjang (30s) karena tidak butuh real-time.

**Efek ke pengalaman kasir:** begitu user pindah ke tab yang sudah pernah dibuka dalam sesi ini, React Query langsung render data dari cache (instant, tanpa flash blank/spinner), lalu diam-diam refetch di background kalau data sudah stale. Pindah tab jadi terasa instan, bukan "reload setiap kali".

### 3. Setup `QueryClientProvider`

- Dipasang satu kali di `app/layout.tsx` (root), bukan di `app/kasir/layout.tsx`, supaya cache juga bertahan kalau user keluar-masuk area `/kasir` (mis. ke `/panduan` lalu balik).
- `QueryClient` dibuat sekali via `useState(() => new QueryClient())` (pola standar Next.js App Router + React Query, supaya tidak re-create tiap render).

### 4. Di luar scope

- `/kasir/settings` (form upload cover layar) — tidak ada masalah re-fetch berat, dilewati.
- `/kasir/kiosk` (`KioskControlPanel` + `useKioskControl`) — murni realtime presence channel, tidak ada data-fetch berulang yang jadi masalah, dilewati.
- Optimasi khusus low-end device/tablet — belum ditest di device asli, jadi tidak masuk scope ini. Bisa jadi follow-up setelah caching layer ini live dan diuji di outlet.

## Testing

- Manual smoke test tiap halaman (Order, Histori, Menu, Reports): pindah tab bolak-balik, pastikan data tidak hilang/flash, polling tetap jalan (order baru tetap muncul ≤3s, realtime notification masih bunyi).
- Manual test mutasi menu (toggle availability/bestseller/upsell/rekomendasi) tetap reflect ke UI setelah invalidate.
- `yarn type-check` clean setelah migrasi.
- Tidak ada test e2e existing untuk flow ini (cek `e2e/` cuma `example.spec.ts`) — tidak menambah e2e baru, manual smoke test cukup untuk scope ini.
