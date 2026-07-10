# Design Spec: Double Crosscheck Stok di Approval Permintaan

## Tujuan
Memberikan informasi *real-time* kepada Supervisor/Admin mengenai sisa stok bahan di outlet peminta dan stok di Gudang Pusat saat melakukan persetujuan (approval) permintaan bahan. Tujuannya mencegah *oversupply* atau persetujuan melebihi kapasitas gudang.

## Arsitektur & Data Flow
1. **Server Action Baru**: Membuat fungsi `fetchCrosscheckStok(outletId, bahanBakuIds)` di `src/app/actions/permintaan.ts`.
   - Mengambil `id` untuk Gudang Pusat dari tabel `outlets`.
   - Melakukan query ke `stok_balance` untuk `outletId` (outlet peminta) dan `gudangId` untuk setiap `bahan_baku_id` yang diminta.
   - Mengembalikan data dengan struktur map yang mudah dibaca client, contoh: `Record<string, { outletStok: number, gudangStok: number }>`.

2. **State di Komponen `ApprovalModal.tsx`**:
   - `crosscheckData`: Menyimpan hasil *fetch* dari server action.
   - `isFetchingCrosscheck`: State *loading* selama mengambil data stok.
   - Menggunakan `useEffect` untuk memanggil server action saat modal pertama kali terbuka (menggunakan data `permintaan.outlet_id` dan mem-map `permintaan.items` untuk mendapatkan array ID bahan baku).

## Perubahan Komponen UI (`ApprovalModal.tsx`)
1. **Informasi Stok per Item**:
   - Di bawah teks `Diminta: X {satuan}`, ditambahkan baris teks berukuran `text-[10px]` dengan warna font `#544437` yang menampilkan: `Stok Outlet: {X} | Stok Gudang: {Y}`.
   - Selama `isFetchingCrosscheck` true, tampilkan skeleton loading teks.

2. **Inline Warning**:
   - Secara *real-time*, jika state `qtys[bahan_baku_id] > crosscheckData[bahan_baku_id].gudangStok`:
     - Input angka *qty disetujui* (warna teks) berubah menjadi warna oranye/merah (`text-orange-600` atau `text-red-600`).
     - Muncul ikon peringatan kecil (⚠️) tepat di samping input tersebut.

3. **Global Warning**:
   - Di atas div aksi (tombol Batal, Tolak, Setujui), jika ada minimal satu item yang melebihi stok gudang, akan muncul alert peringatan kecil:
     `⚠️ Beberapa kuantitas yang disetujui melebihi stok gudang. Mohon cek kembali.`
   - Tombol "Setujui" tetap aktif dan dapat digunakan jika *user* memang memaksa.

## Error Handling & Edge Cases
- **Gagal Fetch Stok**: Jika request gagal, informasi stok disembunyikan atau menampilkan tulisan `(Stok tidak dapat dimuat)` agar proses *approval* tidak terblokir sepenuhnya.
- **Stok Gudang Tidak Ditemukan (0 atau Kosong)**: Jika data stok gudang tidak ada di `stok_balance`, dianggap `0`.
- **Gudang Pusat Tidak Ditemukan**: Jika database tidak mengembalikan ID Gudang Pusat, fallback qty gudang diset `0`.

## Rencana Pengujian
1. Membuka modal persetujuan dan memastikan baris teks "Stok Outlet / Gudang" muncul.
2. Memasukkan qty disetujui melebihi stok gudang, lalu memverifikasi peringatan warna dan ikon ⚠️ muncul.
3. Menurunkan kembali qty dan memastikan peringatan hilang.
4. Menyelesaikan persetujuan dalam kondisi peringatan aktif maupun non-aktif.
