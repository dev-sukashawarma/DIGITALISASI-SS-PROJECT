# 04 — RLS & Keamanan Query

Optimasi tidak boleh membuka data. Dua hal yang ditemukan saat audit HR:

- `payroll_records`, `leave_requests`, `cash_advances`, `cash_advance_payments` punya policy
  SELECT **`USING (true)`** → crew & mitra bisa membaca **gaji semua karyawan**.
- `discipline_records` bisa dibaca **tanpa login** (policy untuk `anon`).

## Aturan

1. **Tidak ada `USING (true)` untuk SELECT pada data pribadi/keuangan.**
   Nama policy generik ("Allow authenticated read", "Enable all access…") hampir pasti `true`.
2. Pola aman: **milik sendiri** (`staff_id = (SELECT auth.uid())`) **ATAU** fungsi peran
   (`(SELECT public.is_hr_pusat())`). Bungkus `auth.uid()`/fungsi dengan `(SELECT …)` agar
   dievaluasi sekali per query, bukan per baris.
3. Fungsi peran = `STABLE SECURITY DEFINER SET search_path = public`, cek `outlet_staff.role`.
4. **`REVOKE ALL ON <tabel> FROM anon`** bila tabel tidak punya kebutuhan publik.
5. **Scope outlet** lewat satu sumber: `accessible_outlet_ids()`. Jangan hardcode daftar outlet.
6. View di atas tabel ber-RLS **wajib** `security_invoker = true` (kecuali sengaja definer).
7. RPC baca `SECURITY INVOKER`; RPC tulis/trigger `SECURITY DEFINER` + `REVOKE` dari client.
8. Sebelum menutup policy: **cari semua pembaca** di seluruh repo (web, native, edge function):
   `grep -rn "from('<tabel>')" apps mobile supabase/functions packages`.

## Audit cepat

Jalankan [`templates/audit_rls.sql`](templates/audit_rls.sql):
- policy SELECT yang ekspresinya `true`
- tabel yang bisa dibaca `anon`
- fungsi `SECURITY DEFINER` tanpa `search_path`
- view tanpa `security_invoker`

## Uji dengan login sungguhan (bukan asumsi)

Tandatangani JWT HS256 dengan `SUPABASE_JWT_SECRET` untuk `sub = <id staf>` per role
(crew, leader, mitra, admin_finance, admin_hr, owner) + anon, lalu hitung baris yang terlihat
lewat PostgREST (`Prefer: count=exact`). Bandingkan **sebelum vs sesudah**. Contoh hasil HR:

| role | sebelum (payroll) | sesudah |
|---|---|---|
| anon | 0 (SP: terbaca!) | 401 semua tabel |
| crew / leader | 300 | hanya miliknya (2) |
| mitra | 300 | 0 |
| HR pusat | 300 | 300 (tidak berubah) |

Skrip contoh: [`scripts/rls-check.example.js`](scripts/rls-check.example.js).
