# Inventaris Outlet — MVP Plan

## Understanding

- Area Manager memeriksa aset tetap outlet berdasarkan `SS_Inventaris_Konfirmasi.pdf`.
- Scope outlet berasal dari `accessible_outlet_ids()`/`staff_outlets`, bukan daftar outlet yang di-hardcode.
- Setiap item wajib memiliki foto. Submission langsung final dan tidak dapat diedit.
- Pencatatan kuantitas dibandingkan dengan target; item tanpa kuantitas memakai status ada/tidak ada; LED Strip memakai rentang 10–20 m.
- Semua submission ditampilkan di `admin-dashboard` pada Pusat Laporan > Inventaris Outlet.

## Assumptions

- Satu outlet hanya memiliki satu submission inventaris final per tanggal Jakarta.
- Skor kebersihan/parkiran disimpan sebagai skor 1–5 pada header submission; skor tidak menggantikan foto item.
- Foto disimpan di bucket privat `inventaris-foto` dan diakses memakai signed URL.
- App baru menggunakan Next 16 yang sudah ter-resolve di monorepo dan TypeScript 5.3.3 yang sama dengan root; upgrade TypeScript 7 ditunda karena belum tervalidasi terhadap seluruh workspace.

## Final design

1. `inventaris_master_items` menyimpan 89 item dari PDF, termasuk mode `quantity`, `presence`, dan `range`.
2. `inventaris_submissions` menyimpan outlet, Area Manager, tanggal, skor, dan catatan. RLS membatasi outlet sesuai scope user dan tidak menyediakan update/delete.
3. `inventaris_submission_items` menyimpan hasil per item, kondisi, status evaluasi, catatan, dan path foto. RPC `submit_inventaris` menulis header + detail dalam satu transaksi.
4. Aplikasi `apps/inventori` menyediakan form mobile-friendly dengan input kamera, kompresi WebP, validasi kelengkapan, dan pesan hasil.
5. Admin report membaca seluruh submission, mengelompokkan berdasarkan outlet/submission, serta menampilkan status, target, Area Manager, waktu, dan signed thumbnail foto.

## Decision log

| Decision | Alternatives | Reason |
| --- | --- | --- |
| App terpisah di `apps/inventori` | Menanam form di admin-dashboard | Pengguna utama AM dan admin hanya melihat laporan. |
| Schema inventaris aset terpisah | Reuse `inventory_items`/`opname` | Modul lama adalah stok bahan baku; PDF adalah aset tetap. |
| Final immutable + unique outlet/tanggal | Draft/edit setelah submit | Sesuai proses konfirmasi dan mencegah duplikasi harian. |
| RPC transactional | Insert header/detail terpisah | Mencegah data final tersimpan setengah. |
| Bucket privat | URL publik | Foto inventaris adalah bukti operasional dan perlu dibatasi. |

## Verification

- Migration diterapkan ke project Supabase dan diverifikasi: 89 master item, 0 submission awal, bucket privat tersedia.
- `apps/inventori` type-check dan production build lulus.
- Auth package type-check lulus.
- Admin changed files tidak memiliki error TypeScript baru; full admin build masih terhalang dependency lama `livekit-client` pada modul monitoring.
