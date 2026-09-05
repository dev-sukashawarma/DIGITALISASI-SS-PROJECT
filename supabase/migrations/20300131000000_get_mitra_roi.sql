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
kebijakan as (
  -- Cutoff dibaca dari p_to, BUKAN p_from. Terlihat janggal, tapi inilah yang
  -- dilakukan produksi: mitraRoi.ts:250 mengirim `new Date().toISOString()`
  -- (tanggal hari ini) sebagai periodFrom ke resolveMitraPolicy, sementara
  -- jendela omzetnya selalu mulai 2026-08-01. Fungsi ini wajib menghasilkan
  -- angka yang identik dengan produksi, jadi ia mengikuti acuan yang sama.
  -- Konsekuensi yang diwarisi: laporan periode lampau memakai tarif hari ini,
  -- bukan tarif periode itu. Ditinjau terpisah, bukan diubah di sini.
  select (p_to::date >= date '2026-09-01') as pakai_aturan_baru
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
    -- Batas tanggal dikonversi dulu ke Asia/Jakarta sebelum di-cast ke date.
    -- mitraRoi.ts memakai literal tanggal tetap '2026-08-01'; p_from::date polos
    -- bergantung timezone sesi koneksi (UTC vs Asia/Jakarta bisa beda 1 hari),
    -- sehingga web dan Android bisa menghasilkan angka berbeda. Jangan
    -- disederhanakan kembali ke p_from::date.
    and e.expense_date >= (p_from at time zone 'Asia/Jakarta')::date
  group by e.outlet_id
),
bulanan as (
  -- type = 'expense', BUKAN 'out'. Nol baris memakai 'out'; memakainya membuat
  -- gaji, listrik, dan sewa hilang dari OPEX sehingga laba mitra menggelembung.
  select e.outlet_id, coalesce(sum(e.amount), 0) as total
  from expenses e
  where e.outlet_id = any(p_outlet_ids)
    and e.type = 'expense'
    -- Lihat komentar di CTE petty di atas: konversi ke Asia/Jakarta dulu agar
    -- batas tanggal tidak bergantung timezone sesi koneksi.
    and e.expense_date >= (p_from at time zone 'Asia/Jakarta')::date
  group by e.outlet_id
),
waste_per_outlet as (
  select w.outlet_id, coalesce(sum(w.nilai_waste), 0) as total
  from get_waste_periode(
    (p_from at time zone 'Asia/Jakarta')::date,
    (p_to at time zone 'Asia/Jakarta')::date
  ) w
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
  -- Lookup deterministik satu baris per outlet, meniru profiles.find(...) di
  -- mitraRoi.ts:239 (ambil profil pertama yang cocok). Sebuah left join biasa
  -- ke mitra_profiles via `any(outlet_ids)` bisa menggandakan baris outlet
  -- kalau suatu outlet pernah muncul di lebih dari satu profil (tak ada
  -- constraint yang mencegahnya) — penjumlahan di caller jadi dobel-hitung.
  -- Subquery correlated + order stabil (id) + limit 1 (setara distinct on
  -- outlet_id) membuat baris terpilih tak berubah antar run.
  left join lateral (
    select mp.profit_sharing_pct
    from mitra_profiles mp
    where o.id = any(mp.outlet_ids)
    order by mp.id
    limit 1
  ) mp on true
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
  -- management_fee dibulatkan SEKALI di sini dan dipakai di dua tempat (kolom
  -- output & pengurang laba), meniru Math.round(...) tunggal di mitraRoi.ts:313.
  -- Menghitungnya dua kali (sekali dibulatkan, sekali mentah) membuat keduanya
  -- bisa selisih, dan sisa pecahan itu ikut menggeser bagi_hasil_mitra yang
  -- juga dibulatkan.
  select
    h.*,
    round(h.omzet * h.fee_pct / 100) as mgmt_fee,
    (h.omzet - h.deduksi - h.cogs - h.opex - h.waste - round(h.omzet * h.fee_pct / 100)) as laba
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
