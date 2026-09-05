# Perhitungan ROI/BEP Mitra Pindah ke Database — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aturan bagi hasil mitra hidup di satu fungsi database yang dipanggil web maupun Android, menggantikan perhitungan TypeScript yang tak bisa dipakai ulang — tanpa mengubah satu angka pun yang dilihat mitra.

**Architecture:** Fungsi baru `get_mitra_roi` di Postgres memanggil ulang `get_mitra_orders_summary` dan `get_waste_periode` yang sudah ada, lalu menambahkan lapisan aturan bisnis (persentase, management fee, BEP, ROI) di atasnya. `getMitraRealtimeBepBreakdown` di web berubah jadi pemanggil tipis; jalur cadangan yang menarik seluruh order ke browser dihapus. Bentuk data yang dikembalikan dipertahankan persis agar ketiga pemakainya tak perlu diubah.

**Tech Stack:** PostgreSQL (PL/pgSQL, Supabase), TypeScript, Next.js Server Actions, Supabase CLI.

**Spec:** `docs/superpowers/specs/2026-09-02-mitra-roi-rpc-design.md` (revisi 2026-09-05)

## Global Constraints

- **Fungsi wajib `SECURITY INVOKER`.** Setiap tabel yang dibaca sudah punya RLS yang benar; berjalan sebagai pemanggil membuat mitra otomatis hanya menerima outletnya sendiri. Menulis pemeriksaan hak akses sendiri di dalam fungsi adalah pola yang sudah pernah kebobolan di proyek ini (memori `server-action-authz-gap`).
- **`expenses` disaring `type = 'expense'`, BUKAN `'out'`.** Nol baris memakai `'out'`; seluruh 302 baris sejak 1 Agustus bertipe `'expense'` (Rp 345 juta). Menyalin filter lama membuat gaji, listrik, dan sewa hilang dari OPEX sehingga laba mitra menggelembung.
- **Dua basis BEP sengaja berbeda dan tidak boleh disatukan.** `is_bep_kebijakan` (basis kas) menyetir tarif; `is_bep` (basis hak) ditampilkan. Menyatukannya membuat rumus melingkar dan mengubah perilaku.
- **Cutoff kebijakan `2026-09-01`** diputuskan dari `p_from`, bukan `p_to` dan bukan tanggal hari ini — agar sepakat dengan `mitraPolicy.ts`.
- Tanggal mulai sistem: `2026-08-01 00:00 WIB` = `2026-07-31T17:00:00Z`.
- Bahasa komentar kode dan UI: Indonesia.
- Jangan sentuh `mitraPnl.ts`, `mitraPolicy.ts`, atau fungsi HPP di database.

## Prasyarat

Branch kerja ini bercabang dari `main` **sebelum** PR #45/#49/#50 mendarat. Sebelum Task 1, gabungkan `origin/main` — kalau tidak, `mitraRoi.ts` yang Anda ubah adalah versi usang dan konflik saat merge nanti.

## Struktur Berkas

| Berkas | Tanggung jawab |
|---|---|
| `supabase/migrations/20300130000000_get_mitra_roi.sql` (baru) | Fungsi `get_mitra_roi`. Satu-satunya tempat aturan bagi hasil hidup. |
| `apps/admin-dashboard/src/app/actions/mitraRoi.ts` (ubah) | Jadi pemanggil tipis. ~200 baris penarik order + `getItemHpp` dihapus. |
| `apps/admin-dashboard/src/app/dashboard/mitra/MitraDashboardView.tsx` (ubah) | Menambah angka pendamping "sudah diterima" di kartu ROI. |

**Tidak berubah** karena bentuk data dipertahankan: `mitra/page.tsx`, `owner/kelola-mitra/page.tsx`, `KelolaMitraView.tsx` (membaca `totalDanaKembali` dan `isBep`).

---

### Task 0: Ambil patokan resmi dari layar produksi (GERBANG MANUAL)

**Tidak ada kode.** Tanpa patokan ini, Task 2 tidak punya pembanding dan seluruh gerbang verifikasi runtuh.

**Files:** tidak ada.

**Interfaces:**
- Consumes: —
- Produces: catatan angka produksi per outlet, dipakai Task 2.

- [ ] **Step 1: Minta pemilik produk membuka halaman produksi**

Minta tangkapan layar `/dashboard/owner/kelola-mitra` di produksi, dalam keadaan login sebagai owner. Halaman itu memanggil `getMitraRealtimeBepBreakdown` langsung, jadi angkanya adalah keluaran kode yang sedang berjalan.

- [ ] **Step 2: Catat angka per outlet ke berkas**

Simpan ke scratchpad (bukan repo) sebagai tabel: outlet, modal investasi, total dana kembali, status BEP. Sertakan tanggal dan jam pengambilan — angka bergerak setiap ada order baru.

- [ ] **Step 3: Catat batasannya**

Patokan **tidak boleh** diambil dari skrip service-role. `get_waste_periode` menyaring lewat `accessible_outlet_ids()`, dan tanpa konteks pengguna ia mengembalikan nol baris tanpa galat — sehingga waste hilang diam-diam dan laba terlihat lebih besar. Ini bukan kehati-hatian teoretis: patokan pertama spec ini rusak persis karena itu.

---

### Task 1: Fungsi `get_mitra_roi` di database

**Files:**
- Create: `supabase/migrations/20300130000000_get_mitra_roi.sql`

**Interfaces:**
- Consumes: `get_mitra_orders_summary(uuid[], timestamptz, timestamptz)` → `SETOF mitra_orders_summary_row` (kolom: `outlet_id`, `channel_group`, `gross_revenue`, `deductions`, `cogs`, `order_count`, `grab_rev`, `gofood_rev`, `shopee_rev`) — **satu baris per channel_group per outlet**, jadi wajib di-`SUM` dan di-`GROUP BY outlet_id`. Juga `get_waste_periode(date, date)` → `TABLE(outlet_id uuid, nilai_waste numeric)`.
- Produces: `get_mitra_roi(p_outlet_ids uuid[], p_from timestamptz, p_to timestamptz)` mengembalikan satu baris per outlet dengan kolom yang didaftar di Step 1.

- [ ] **Step 1: Tulis migration**

Buat `supabase/migrations/20300130000000_get_mitra_roi.sql`:

```sql
-- Satu-satunya tempat aturan bagi hasil mitra hidup. Dipanggil web (admin-dashboard)
-- dan aplikasi Android. Sebelumnya aturan ini hanya ada sebagai TypeScript di
-- apps/admin-dashboard/src/app/actions/mitraRoi.ts, sehingga Android tidak bisa
-- memakainya tanpa menulis salinan kedua dalam bahasa berbeda.
--
-- SECURITY INVOKER disengaja: setiap tabel di bawah sudah punya RLS yang benar,
-- jadi mitra yang memanggil fungsi ini otomatis hanya menerima outletnya sendiri
-- walau ia mengirim daftar outlet orang lain sebagai parameter. Menulis
-- pemeriksaan hak akses sendiri di sini justru pola yang pernah kebobolan.
create or replace function get_mitra_roi(
  p_outlet_ids uuid[],
  p_from timestamptz default '2026-07-31T17:00:00Z',
  p_to timestamptz default now()
)
returns table (
  outlet_id uuid,
  modal_investasi numeric,
  omzet_historis numeric,
  transfer_historis numeric,
  sudah_diterima numeric,
  omzet numeric,
  deduksi numeric,
  cogs numeric,
  opex numeric,
  waste numeric,
  management_fee numeric,
  laba_bersih numeric,
  persentase numeric,
  bagi_hasil_mitra numeric,
  dana_kembali numeric,
  roi_pct numeric,
  bep_pct numeric,
  is_bep boolean,
  is_bep_kebijakan boolean,
  sisa_modal numeric,
  roi_diterima_pct numeric
)
language sql
security invoker
set search_path = public
as $$
with
-- Cutoff kebijakan diputuskan dari p_from, bukan p_to dan bukan tanggal hari ini,
-- supaya sepakat dengan resolveMitraPolicy() di apps/admin-dashboard/src/lib/mitraPolicy.ts
kebijakan as (
  select (p_from::date >= date '2026-09-01') as pakai_aturan_baru
),
ord as (
  select s.outlet_id,
         coalesce(sum(s.gross_revenue), 0) as omzet,
         coalesce(sum(s.deductions), 0)    as deduksi,
         coalesce(sum(s.cogs), 0)          as cogs
  from get_mitra_orders_summary(p_outlet_ids, p_from, p_to) s
  group by s.outlet_id
),
petty as (
  select e.outlet_id, coalesce(sum(e.amount), 0) as total
  from petty_cash_expenses e
  where e.outlet_id = any(p_outlet_ids)
    and e.deleted_at is null
    and e.expense_date >= p_from::date
  group by e.outlet_id
),
bulanan as (
  -- type = 'expense', BUKAN 'out'. Nol baris memakai 'out'; memakainya membuat
  -- gaji, listrik, dan sewa hilang dari OPEX sehingga laba mitra menggelembung.
  select e.outlet_id, coalesce(sum(e.amount), 0) as total
  from expenses e
  where e.outlet_id = any(p_outlet_ids)
    and e.type = 'expense'
    and e.expense_date >= p_from::date
  group by e.outlet_id
),
waste_per_outlet as (
  select w.outlet_id, coalesce(sum(w.nilai_waste), 0) as total
  from get_waste_periode(p_from::date, p_to::date) w
  where w.outlet_id = any(p_outlet_ids)
  group by w.outlet_id
),
transfer as (
  select t.outlet_id, coalesce(sum(t.nominal), 0) as total
  from mitra_transfers t
  where t.outlet_id = any(p_outlet_ids)
  group by t.outlet_id
),
dasar as (
  select
    o.id as outlet_id,
    coalesce(inv.nilai_investasi, 0)     as modal_investasi,
    coalesce(inv.omzet_historis, 0)      as omzet_historis,
    coalesce(inv.transfer_historis, 0)   as transfer_historis,
    coalesce(tr.total, 0)                as sudah_diterima,
    coalesce(inv.persentase_bagi_hasil, mp.profit_sharing_pct, 50) as pct_historis,
    coalesce(inv.management_fee, 0)      as fee_historis,
    coalesce(ord.omzet, 0)               as omzet,
    coalesce(ord.deduksi, 0)             as deduksi,
    coalesce(ord.cogs, 0)                as cogs,
    coalesce(p.total, 0) + coalesce(b.total, 0) as opex,
    coalesce(w.total, 0)                 as waste
  from unnest(p_outlet_ids) as o(id)
  left join mitra_investments inv on inv.outlet_id = o.id
  left join mitra_profiles mp on o.id = any(mp.outlet_ids)
  left join ord on ord.outlet_id = o.id
  left join petty p on p.outlet_id = o.id
  left join bulanan b on b.outlet_id = o.id
  left join waste_per_outlet w on w.outlet_id = o.id
  left join transfer tr on tr.outlet_id = o.id
),
tarif as (
  select
    d.*,
    -- BASIS KAS. Inilah yang menyetir tarif, dan ia SENGAJA berbeda dari is_bep
    -- yang ditampilkan (basis hak, dihitung di bawah). Menyamakan keduanya
    -- membuat rumusnya melingkar: persentase <- BEP <- bagi hasil <- persentase.
    -- Jangan "merapikannya" jadi satu.
    (d.modal_investasi > 0
      and (d.omzet_historis + d.transfer_historis + d.sudah_diterima) >= d.modal_investasi
    ) as is_bep_kebijakan
  from dasar d
),
hitung as (
  select
    t.*,
    case when k.pakai_aturan_baru
         then case when t.is_bep_kebijakan then 50 else 100 end
         else t.pct_historis end as pct,
    case when k.pakai_aturan_baru
         then case when t.is_bep_kebijakan then 0 else 3 end
         else t.fee_historis end as fee_pct
  from tarif t cross join kebijakan k
),
hasil as (
  select
    h.*,
    (h.omzet * h.fee_pct / 100) as mgmt_fee,
    (h.omzet - h.deduksi - h.cogs - h.opex - h.waste - (h.omzet * h.fee_pct / 100)) as laba
  from hitung h
),
akhir as (
  select
    h.*,
    case when h.laba > 0 then round(h.laba * h.pct / 100) else 0 end as bagi_hasil
  from hasil h
)
select
  a.outlet_id,
  a.modal_investasi,
  a.omzet_historis,
  a.transfer_historis,
  a.sudah_diterima,
  a.omzet,
  a.deduksi,
  a.cogs,
  a.opex,
  a.waste,
  a.mgmt_fee                                        as management_fee,
  a.laba                                            as laba_bersih,
  a.pct                                             as persentase,
  a.bagi_hasil                                      as bagi_hasil_mitra,
  (a.omzet_historis + a.transfer_historis + a.bagi_hasil) as dana_kembali,
  case when a.modal_investasi > 0
       then ((a.omzet_historis + a.transfer_historis + a.bagi_hasil) / a.modal_investasi) * 100
       else 0 end                                   as roi_pct,
  least(
    round((case when a.modal_investasi > 0
                then ((a.omzet_historis + a.transfer_historis + a.bagi_hasil) / a.modal_investasi) * 100
                else 0 end)::numeric, 1),
    100
  )                                                 as bep_pct,
  (a.modal_investasi > 0
    and (a.omzet_historis + a.transfer_historis + a.bagi_hasil) >= a.modal_investasi) as is_bep,
  a.is_bep_kebijakan,
  greatest(0, a.modal_investasi - (a.omzet_historis + a.transfer_historis + a.bagi_hasil)) as sisa_modal,
  case when a.modal_investasi > 0
       then ((a.omzet_historis + a.transfer_historis + a.sudah_diterima) / a.modal_investasi) * 100
       else 0 end                                   as roi_diterima_pct
from akhir a;
$$;

grant execute on function get_mitra_roi(uuid[], timestamptz, timestamptz) to authenticated;
```

- [ ] **Step 2: Terapkan migration ke database**

`supabase db push` di proyek ini rutin gagal karena riwayat remote diverged oleh kerja tim lain. Terapkan langsung dari berkas, lalu stempel:

```bash
supabase --experimental db query -f supabase/migrations/20300130000000_get_mitra_roi.sql --linked
```

Perintah `db query` dengan SQL **inline** tidak menjalankan DDL — ia membalas sukses tanpa membuat apa pun. Wajib `-f <berkas>`.

- [ ] **Step 3: Verifikasi fungsinya benar-benar ada, jangan percaya status perintah**

```bash
supabase --experimental db query "select proname, prosecdef, pg_get_function_identity_arguments(oid) from pg_proc where proname='get_mitra_roi'" --linked
```

Harapan: satu baris, `prosecdef = false` (invoker), argumen `uuid[], timestamp with time zone, timestamp with time zone`. Kalau nol baris, migration tidak jalan — jangan lanjut.

- [ ] **Step 4: Stempel riwayat migration**

```bash
supabase migration repair --status applied 20300130000000
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20300130000000_get_mitra_roi.sql
git commit -m "feat(mitra): fungsi get_mitra_roi sebagai satu-satunya tempat aturan bagi hasil"
```

---

### Task 2: Buktikan angkanya sama dengan produksi (GERBANG)

**Files:** tidak ada perubahan kode. Kalau ada selisih, perbaiki Task 1 lalu ulangi.

**Interfaces:**
- Consumes: fungsi dari Task 1; patokan dari Task 0.
- Produces: bukti bahwa fungsi baru menghasilkan angka identik. Tanpa ini, Task 3 tidak boleh dimulai.

- [ ] **Step 1: Jalankan fungsi untuk kesembilan outlet mitra**

```bash
supabase --experimental db query "select o.name, r.modal_investasi::bigint, r.omzet::bigint, r.opex::bigint, r.waste::bigint, r.laba_bersih::bigint, r.persentase, r.bagi_hasil_mitra::bigint, r.dana_kembali::bigint, round(r.roi_pct,1) as roi, r.is_bep, r.is_bep_kebijakan from get_mitra_roi((select array_agg(distinct x) from mitra_profiles mp, unnest(mp.outlet_ids) x)) r join outlets o on o.id=r.outlet_id order by o.name" --linked
```

- [ ] **Step 2: Bandingkan dengan patokan Task 0, kolom per kolom**

Wajib **sama persis** untuk kesembilan outlet: omzet, deduksi, COGS, opex, waste, management fee, laba bersih, bagi hasil, dana kembali, ROI, status BEP.

**Tidak ada kategori "selisih yang bisa dijelaskan".** Perpindahan ini dirancang tidak mengubah apa pun, jadi selisih apa pun berarti bug. Kalau ada satu outlet saja yang tidak cocok, berhenti dan cari sebabnya sebelum menyentuh web.

- [ ] **Step 3: Perhatikan khusus angka waste**

Perintah di Step 1 dijalankan lewat CLI, yang tidak punya konteks pengguna — jadi `get_waste_periode` di dalamnya mengembalikan nol. Nilai `waste` **akan** nol di keluaran itu, dan itu **bukan** bukti fungsinya salah.

Untuk memverifikasi waste, jalankan fungsi sebagai pengguna sungguhan: buka halaman web setelah Task 3, atau panggil lewat PostgREST dengan token mitra. Sampai itu dilakukan, tandai kolom waste sebagai **belum terverifikasi** — jangan diklaim lolos.

- [ ] **Step 4: Verifikasi isolasi antar mitra**

Fungsi ini `SECURITY INVOKER`, jadi seharusnya mustahil melihat outlet orang lain. Buktikan, jangan diasumsikan: panggil lewat PostgREST dengan token satu mitra sambil mengirim `p_outlet_ids` berisi outlet mitra lain. Harapan: hanya baris outletnya sendiri yang kembali.

- [ ] **Step 5: Pin aturan cutoff kebijakan**

Aturan inilah yang paling mudah salah dan paling mahal akibatnya. Jalankan fungsi dua kali dengan periode berbeda untuk outlet yang sama:

```bash
supabase --experimental db query "select 'sebelum cutoff' as periode, o.name, r.persentase, round(r.management_fee/nullif(r.omzet,0)*100,1) as fee_pct, r.is_bep_kebijakan from get_mitra_roi((select array_agg(distinct x) from mitra_profiles mp, unnest(mp.outlet_ids) x), '2026-08-01T00:00:00+07', '2026-08-31T23:59:59+07') r join outlets o on o.id=r.outlet_id union all select 'sejak cutoff', o.name, r.persentase, round(r.management_fee/nullif(r.omzet,0)*100,1), r.is_bep_kebijakan from get_mitra_roi((select array_agg(distinct x) from mitra_profiles mp, unnest(mp.outlet_ids) x), '2026-09-01T00:00:00+07', now()) r join outlets o on o.id=r.outlet_id order by name, periode" --linked
```

Harapan:
- Baris **sebelum cutoff**: `persentase` bervariasi per outlet (50/60/100) dan `fee_pct` mengikuti kolom historis — inilah angka dari `mitra_investments`.
- Baris **sejak cutoff**: setiap outlet dengan `is_bep_kebijakan = false` menunjukkan `persentase = 100` dan `fee_pct = 3`; yang `true` menunjukkan `persentase = 50` dan `fee_pct = 0`. Berdasarkan data 2026-09-05, hanya Cibinong yang `true`.

Kalau baris "sejak cutoff" masih menampilkan 60 untuk Ciseeng/Kalisari/Pekayon, berarti mesin kebijakan tidak terpasang — fungsi membaca kolom historis padahal seharusnya tidak.

- [ ] **Step 6: Pin bahwa dua basis BEP tetap terpisah**

```bash
supabase --experimental db query "select o.name, r.is_bep, r.is_bep_kebijakan, round(r.roi_pct,1) as roi_hak, round(r.roi_diterima_pct,1) as roi_kas from get_mitra_roi((select array_agg(distinct x) from mitra_profiles mp, unnest(mp.outlet_ids) x)) r join outlets o on o.id=r.outlet_id order by o.name" --linked
```

Harapan: `roi_hak` dan `roi_kas` berbeda untuk sebagian besar outlet (Cileungsi paling jauh — hak sekitar 31%, kas 0%), dan `persentase` tetap mengikuti `is_bep_kebijakan`, bukan `is_bep`. Ini memin perilaku yang disengaja agar tidak ada yang "merapikannya" jadi satu di kemudian hari.

- [ ] **Step 7: Uji kasus tepi**

Ketiganya harus mengembalikan baris, bukan galat:

```bash
supabase --experimental db query "select outlet_id, modal_investasi, persentase, bagi_hasil_mitra, roi_pct, is_bep from get_mitra_roi(array[(select id from outlets where type is distinct from 'marketplace' and id not in (select distinct x from mitra_profiles mp, unnest(mp.outlet_ids) x) limit 1)])" --linked
```

Harapan: satu baris untuk outlet yang **tidak punya** baris `mitra_investments` — `modal_investasi = 0`, `roi_pct = 0` (bukan pembagian dengan nol), `is_bep = false`. Fungsi tidak boleh gagal hanya karena outlet belum punya data investasi.

Lalu pastikan laba negatif tidak menghasilkan bagi hasil negatif — periksa apakah ada outlet dengan `laba_bersih < 0` di keluaran Step 1; bila ada, `bagi_hasil_mitra` wajib `0`. Bila tidak ada outlet seperti itu hari ini, catat bahwa kasus ini belum teruji dengan data nyata dan hanya dijamin oleh `case when laba > 0` di SQL.

- [ ] **Step 8: Catat hasilnya**

Tulis tabel perbandingan ke deskripsi PR: patokan lawan keluaran fungsi, per outlet per kolom, termasuk kolom mana yang belum terverifikasi (waste, dan kasus laba negatif bila tak ada datanya).

---

### Task 3: Web memakai fungsi baru

**Files:**
- Modify: `apps/admin-dashboard/src/app/actions/mitraRoi.ts`

**Interfaces:**
- Consumes: `get_mitra_roi` (Task 1).
- Produces: `getMitraRealtimeBepBreakdown(mitraOutletIds: string[]): Promise<Record<string, MitraRealtimeBepItem>>` dengan bentuk data **tidak berubah**, plus dua field baru `sudahDiterima: number` dan `roiDiterimaPct: number` di `MitraRealtimeBepItem`.

- [ ] **Step 1: Ganti isi `getMitraRealtimeBepBreakdown`**

Ganti seluruh badan fungsi (dari `const cookieStore = await cookies()` sampai `return resultMap`) dengan:

```typescript
export async function getMitraRealtimeBepBreakdown(mitraOutletIds: string[]): Promise<Record<string, MitraRealtimeBepItem>> {
  if (mitraOutletIds.length === 0) return {}

  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })

  // Seluruh aturan bagi hasil kini hidup di fungsi database get_mitra_roi,
  // supaya web dan aplikasi Android memakai perhitungan yang sama persis.
  // Jalur cadangan yang dulu menarik seluruh order ke server lalu menghitung
  // ulang HPP sengaja dihapus: ia bisa menghasilkan angka berbeda dari jalur
  // utama tanpa ada yang tahu. Kegagalan kini tampil sebagai galat jujur.
  const { data, error } = await supabase.rpc('get_mitra_roi', {
    p_outlet_ids: mitraOutletIds,
    p_from: '2026-07-31T17:00:00.000Z',
    p_to: new Date().toISOString(),
  })

  if (error) throw new Error(`get_mitra_roi gagal: ${error.message}`)

  const resultMap: Record<string, MitraRealtimeBepItem> = {}
  for (const row of data || []) {
    resultMap[row.outlet_id] = {
      outletId: row.outlet_id,
      modalInvestasi: Number(row.modal_investasi) || 0,
      omzetHistoris: Number(row.omzet_historis) || 0,
      transferHistoris: Number(row.transfer_historis) || 0,
      revenue: Number(row.omzet) || 0,
      cogs: Number(row.cogs) || 0,
      opex: (Number(row.opex) || 0) + (Number(row.waste) || 0),
      managementFee: Number(row.management_fee) || 0,
      netProfit: Number(row.laba_bersih) || 0,
      mitraShare: Number(row.bagi_hasil_mitra) || 0,
      totalDanaKembali: Number(row.dana_kembali) || 0,
      sisaModal: Number(row.sisa_modal) || 0,
      roiPct: Number(row.roi_pct) || 0,
      bepPercentage: Number(row.bep_pct) || 0,
      isBep: Boolean(row.is_bep),
      sudahDiterima: Number(row.sudah_diterima) || 0,
      roiDiterimaPct: Number(row.roi_diterima_pct) || 0,
    }
  }
  return resultMap
}
```

Perhatikan `opex` digabung dengan `waste` — itu memang bentuk lama yang dipakai pemanggilnya, jadi dipertahankan.

- [ ] **Step 2: Tambah dua field ke interface**

Di `MitraRealtimeBepItem`, setelah `isBep: boolean`, tambahkan:

```typescript
  sudahDiterima: number
  roiDiterimaPct: number
```

- [ ] **Step 3: Tambah dua field ke keluaran `getMitraRoiStats`**

Di `getMitraRoiStats`, tambahkan akumulator dan sertakan di objek yang dikembalikan — termasuk di cabang `targetOutlets.length === 0` supaya bentuknya konsisten:

```typescript
  // di cabang kosong:
  return { systemProfitMitra: 0, historisProfitMitra: 0, nilaiInvestasi: 0,
           totalProfitKumulatif: 0, roi: 0, bepPercentage: 0, sudahDiterima: 0, roiDiterima: 0 }
```

```typescript
  // di badan utama, sejajar akumulator lain:
  let sudahDiterima = 0
  // di dalam loop:
  sudahDiterima += item.sudahDiterima
  // di objek yang dikembalikan:
  sudahDiterima,
  roiDiterima: nilaiInvestasi > 0 ? Math.round((sudahDiterima / nilaiInvestasi) * 1000) / 10 : 0,
```

- [ ] **Step 4: Hapus kode mati**

Hapus dari berkas: `getItemHppBase`, `getItemHpp`, seluruh blok paginasi `orders` (`while (true)`), variabel `allOrders`, `SYSTEM_START_DATE` bila tak terpakai lagi, dan import `cleanItemName` bila tak ada pemakai tersisa. Jangan hapus `resolveMitraPolicy` dari `mitraPolicy.ts` — berkas itu masih dipakai `mitraPnl.ts` dan untuk label UI.

- [ ] **Step 5: Type-check**

```bash
cd apps/admin-dashboard && yarn type-check
```

Harapan: nol error **baru**. Repo ini punya error pre-existing di berkas BOM/bahan-baku; catat jumlah baseline sebelum mengubah apa pun agar bisa dibandingkan jujur.

- [ ] **Step 6: Build**

```bash
cd apps/admin-dashboard && yarn build
```

Harapan: sukses.

- [ ] **Step 7: Commit**

```bash
git add apps/admin-dashboard/src/app/actions/mitraRoi.ts
git commit -m "refactor(mitra): ROI/BEP dihitung fungsi database, buang jalur cadangan"
```

---

### Task 4: Angka pendamping "sudah diterima" di kartu

**Files:**
- Modify: `apps/admin-dashboard/src/app/dashboard/mitra/MitraDashboardView.tsx`

**Interfaces:**
- Consumes: `getMitraRoiStats` yang kini mengembalikan `sudahDiterima` dan `roiDiterima` (Task 3).
- Produces: tampilan; tak ada yang mengonsumsinya.

- [ ] **Step 1: Perluas state ROI**

Di sekitar baris 81, nilai bawaan prop:

```tsx
  initialRoiStats = { roi: 0, bepPercentage: 0, roiDiterima: 0 },
```

Di sekitar baris 103, tipe dan nilai awal state:

```tsx
  const [roiStats, setRoiStats] = useState<{ roi: number; bepPercentage: number; roiDiterima: number; loading: boolean }>({
    roi: initialRoiStats?.roi || 0,
    bepPercentage: initialRoiStats?.bepPercentage || 0,
    roiDiterima: initialRoiStats?.roiDiterima || 0,
    loading: false,
  })
```

Di sekitar baris 127, setelah pemanggilan `getMitraRoiStats`:

```tsx
          setRoiStats({ roi: stats.roi, bepPercentage: stats.bepPercentage, roiDiterima: stats.roiDiterima, loading: false })
```

Sesuaikan nilai `loading` awal dengan yang sudah ada di berkas — jangan mengubah perilaku pemuatan, hanya menambah satu field.

- [ ] **Step 2: Tampilkan di bawah angka ROI**

Setelah blok `CountUp` ROI (sekitar baris 507), sisipkan:

```tsx
<p className="text-[11px] text-suka-gray-400 font-semibold mt-1">
  Sudah diterima: <strong className="text-suka-brown">{roiStats.roiDiterima.toFixed(1)}%</strong>
</p>
```

Pertahankan kelas Tailwind yang sudah dipakai di sekitarnya agar konsisten. Angka utama tidak diubah sama sekali.

- [ ] **Step 3: Build**

```bash
cd apps/admin-dashboard && yarn build
```

- [ ] **Step 4: Commit**

```bash
git add apps/admin-dashboard/src/app/dashboard/mitra/MitraDashboardView.tsx
git commit -m "feat(mitra): tampilkan ROI yang sudah benar-benar diterima sebagai angka pendamping"
```

---

### Task 5: Verifikasi akhir di layar nyata

**Files:** tidak ada perubahan kode.

**Interfaces:**
- Consumes: Task 1–4.
- Produces: bukti bahwa angka di layar tidak bergeser, dan waste akhirnya terverifikasi.

- [ ] **Step 1: Deploy ulang admin-dashboard**

Trigger redeploy `admin-dashboard` di Coolify. Tanpa ini tidak ada yang berubah di produksi.

Kalau setelah redeploy muncul "Server Action ... was not found on the server", itu **bukan bug**: ID Server Action di-generate ulang tiap build dan tab lama memegang referensi lama. Hard refresh.

- [ ] **Step 2: Bandingkan halaman kelola-mitra dengan patokan Task 0**

Buka `/dashboard/owner/kelola-mitra` sebagai owner. Total dana kembali dan jumlah outlet yang sudah BEP harus **sama** dengan patokan — dengan toleransi pergerakan wajar akibat order baru sejak patokan diambil.

- [ ] **Step 3: Verifikasi waste, yang belum pernah terbukti**

Bandingkan `opex` di layar dengan patokan Task 0. Nilai `waste` kini ikut karena fungsi berjalan sebagai pengguna sungguhan. Kalau opex jauh lebih kecil dari patokan, `get_waste_periode` di dalam fungsi tidak mengembalikan apa-apa — selidiki sebelum dianggap selesai.

- [ ] **Step 4: Buka dashboard mitra**

Buka `/dashboard/mitra` sebagai owner (mode admin). Verifikasi kartu ROI menampilkan angka utama seperti sebelumnya, plus baris "Sudah diterima" di bawahnya. Untuk Cileungsi angka pendamping itu akan 0% sementara angka utama sekitar 31% — itu benar, bukan bug.

- [ ] **Step 5: Catat hasil**

Tulis temuan di deskripsi PR. Jangan tandai selesai bila ada langkah yang dilewati — sebutkan langkah mana dan alasannya.

## Di luar cakupan

- Menyatukan dua definisi "modal sudah kembali" — keputusan produk tersendiri, dikerjakan setelah pemindahan ini terbukti benar.
- Layar Android "Dashboard Saya" (sub-proyek 1) yang akan memanggil fungsi ini.
- Puluhan skrip `check_*.js` yang diam-diam mendapat hasil kosong dari fungsi ber-scope.
- F5/F6/F7 dari spec sub-proyek 0.
