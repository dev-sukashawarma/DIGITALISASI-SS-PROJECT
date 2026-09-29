# 01 — Pagination di Database lewat RPC

## Masalah yang dicegah

```ts
// ❌ JANGAN
const { data } = await supabase.from('attendance').select('*').gte('ts', from).lte('ts', to)
```

- PostgREST punya **batas 1.000 baris per request**. Lewat dari itu dipotong **tanpa error**.
  Kasus nyata: absensi September 2.405 baris → yang tampil hanya ±tgl 18–30; payroll denda
  telat ikut salah karena query yang sama.
- Semua baris dikirim ke browser → makin lambat tiap bulan, boros bandwidth & CPU database.
- `.limit(1000)` "untuk aman" = bug yang ditunda, bukan solusi.

## Pola yang dipakai

Satu RPC mengembalikan **satu objek** berisi halaman + total + ringkasan:

```json
{ "total": 1326, "ringkasan": { "hadir": 1229, "terlambat": 97 }, "rows": [ …50 baris… ] }
```

Kenapa satu `jsonb`, bukan `RETURNS TABLE`:
- **Satu round-trip** untuk tabel, pagination, dan kartu KPI sekaligus.
- `jsonb` skalar **tidak kena batas 1.000 baris** PostgREST.
- Bentuk baris bisa disamakan dengan embed PostgREST lama → komponen UI tidak perlu diubah.

### Aturan wajib RPC daftar

| Aturan | Alasan |
|---|---|
| `SECURITY INVOKER` | RLS tabel tetap berlaku; crew tidak tiba-tiba melihat data semua outlet |
| `SET search_path = public` | Mencegah pembajakan nama objek |
| `LIMIT LEAST(GREATEST(p_limit,1), 5000)` | Klien tidak bisa minta sejuta baris |
| `OFFSET GREATEST(p_offset,0)` | Input negatif tidak error |
| `ORDER BY … , id` (tiebreak unik) | Tanpa tiebreak, baris bisa muncul dobel/hilang antar halaman |
| Parameter daftar id sebagai `uuid[]` (POST body) | Daftar id di URL bisa > 8 KB → HTTP 414 |
| Pencarian `ILIKE` dengan escape `\ % _` | Input `50%` tidak jadi wildcard |
| `REVOKE ALL … FROM PUBLIC, anon; GRANT EXECUTE … TO authenticated` | Tanpa login tidak bisa memanggil |
| Ringkasan dihitung **sebelum** filter status | Kartu KPI tetap informatif saat tabel difilter |

Template: [`templates/rpc_daftar_paginasi.sql`](templates/rpc_daftar_paginasi.sql)

### Pola query di dalam RPC (supaya O(halaman))

Tulis **dua query terpisah**, bukan satu CTE yang dipakai ulang:

```sql
-- (1) total + ringkasan: agregat ringan, idealnya index-only scan
SELECT count(*) …, count(*) FILTER (WHERE status = 'x') … INTO v_total, v_ring FROM t WHERE <filter>;

-- (2) halaman: planner bisa membaca index berurutan lalu BERHENTI di LIMIT
SELECT … FROM (SELECT * FROM t WHERE <filter> ORDER BY tgl DESC, id LIMIT n OFFSET m) p
LEFT JOIN master … ;   -- join master SETELAH limit, hanya 50 baris
```

CTE yang direferensikan > 1 kali di-*materialize* → seluruh rentang dibaca, LIMIT tidak menolong.

### Index pendamping

Index harus cocok dengan `WHERE` + `ORDER BY` halaman, dan `INCLUDE` kolom yang dipakai
untuk hitung ringkasan (index-only scan):

```sql
CREATE INDEX IF NOT EXISTS idx_x_tgl ON public.x (tgl DESC, clock_in DESC NULLS LAST, staff_id)
  INCLUDE (status, outlet_id);
```

## Pengecualian akun tes / dummy

Aturan "akun mana yang disembunyikan" sering rumit (pola nama, role, kategori) dan hidup di
TypeScript (`isTestOrDevStaff`). Jangan disalin ke SQL (dua sumber kebenaran). Caranya:

1. Klien memuat direktori staf ringan sekali (±200 baris, cache 5 menit).
2. Hitung daftar id yang disembunyikan di klien.
3. Kirim sebagai `p_exclude_staff uuid[]` di **body RPC**.

Referensi: `apps/HR/src/hooks/useHrDirectory.ts`.

## Export CSV/Excel

Export memakai RPC yang sama, **per batch sampai `total` tercapai** (dedup per kunci),
bukan satu request besar. Lihat `fetchAllPages` di [`templates/paging.ts`](templates/paging.ts).
