# Petty Cash Notification Badge Design

## Objective
Menambahkan indikator notifikasi (badge merah) di dashboard Leader dan Area Manager untuk menginformasikan adanya pengajuan Petty Cash yang membutuhkan tindakan (approval atau serah terima dana).

## Scope
1. Komponen Layout utama (`RoleLayout.tsx`).
2. Komponen Layout spesifik Role (`LeaderLayout.tsx` dan `AreaManagerLayout.tsx`).
3. Halaman Daftar Petty Cash untuk masing-masing role (`apps/finance/src/app/leader/petty-cash/components/PettyCashList.tsx` dan `apps/finance/src/app/area-manager/petty-cash/components/PettyCashList.tsx`).

## Pendekatan Teknis (Client-Side Fetching dengan React Query)

### 1. `RoleLayout.tsx`
- **Tipe Data:** Menambahkan tipe opsional `badge?: number` pada definisi tipe `NavItem`.
- **Desktop Sidebar UI:** Menambahkan elemen UI badge merah berbentuk pill/lingkaran kecil di sebelah kanan label menu jika nilai `badge > 0`.
- **Mobile Bottom Nav UI:** Menambahkan elemen UI badge titik merah (red dot) atau angka absolut yang melayang (absolute positioning) pada icon jika nilai `badge > 0`.

### 2. `LeaderLayout.tsx` & `AreaManagerLayout.tsx`
- Mengimpor dan memanggil hook `usePettyCashRequests`.
- Menghitung jumlah item petty cash yang membutuhkan tindakan:
  - **Leader:** `status === 'pending' || status === 'forwarded_to_area_manager' || status === 'forwarded_by_area_manager'`
  - **Area Manager:** `status === 'pending' || status === 'forwarded_to_area_manager' || status === 'approved_by_finance' || status === 'forwarded_by_finance'`
- Menyisipkan nilai hasil perhitungan tersebut ke dalam array `NAV_GROUPS` pada item Petty Cash melalui parameter `badge`.

### 3. Komponen Tab di Halaman Petty Cash
- Mengubah format angka jumlah request dari teks biasa `({count})` menjadi UI badge merah yang mencolok di samping tulisan tab ("Aktif / Butuh Serah Terima" & "Butuh Tindakan") apabila `count > 0`.

## Alasan & Keuntungan
- Data badge dan tabel petty cash akan selalu sinkron karena keduanya menggunakan cache `React Query` yang sama.
- Mencegah masalah *prop drilling* atau pemakaian global state yang kompleks.
- Ketika aksi approval/penerusan dilakukan, `queryClient.invalidateQueries` otomatis merender ulang Layout dan daftar petty cash secara serentak.
