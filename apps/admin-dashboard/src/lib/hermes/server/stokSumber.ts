import type { OutletInfo } from '@/lib/sukaBot/alat/penjualan'
import type { BahanInfo, BarisStok } from '@/lib/sukaBot/alat/stok'
import type { AktivitasStokRingkas, KonteksStokHermes, SuratJalanRingkas } from '../stok/tipe'

export function buatKonteksStok(svc: any, outlets: OutletInfo[], hariIni: string): KonteksStokHermes {
  const cariOutletIds = (nama?: string) => {
    if (!nama) return outlets.map((o) => o.id)
    const target = nama.trim().toLocaleLowerCase('id-ID')
    const cocok = outlets.filter((o) => o.name.toLocaleLowerCase('id-ID') === target || o.slug?.toLocaleLowerCase('id-ID') === target)
    if (cocok.length !== 1) throw new Error(`Outlet "${nama}" tidak ditemukan atau tidak unik.`)
    return cocok.map((o) => o.id)
  }

  const ambilAktivitas = async (
    tabel: 'opname' | 'permintaan_bahan',
    opts: { outlet?: string; hari: number; limit: number },
  ): Promise<AktivitasStokRingkas[]> => {
    const outletIds = cariOutletIds(opts.outlet)
    const sejak = new Date(Date.now() - opts.hari * 24 * 60 * 60 * 1000)
    const filterSejak = tabel === 'opname'
      ? sejak.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
      : sejak.toISOString()
    const kolom = tabel === 'opname'
      ? 'outlet_id, tanggal, status, tipe, created_at'
      : 'outlet_id, status, created_at'
    const { data, error } = await svc
      .from(tabel)
      .select(kolom)
      .in('outlet_id', outletIds)
      .gte(tabel === 'opname' ? 'tanggal' : 'created_at', filterSejak)
      .order('created_at', { ascending: false })
      .limit(opts.limit)
    if (error) throw new Error(`${tabel}: ${error.message}`)
    const namaOutlet = new Map(outlets.map((o) => [o.id, o.name]))
    return (data ?? []).map((r: any) => ({
      outlet: namaOutlet.get(r.outlet_id) ?? '(outlet tidak dikenal)',
      tanggal: r.tanggal ?? r.created_at?.slice(0, 10) ?? '',
      status: r.status ?? 'tidak diketahui',
      ...(tabel === 'opname' && r.tipe ? { tipe: r.tipe } : {}),
    }))
  }

  return {
    hariIni,
    outlets,
    daftarBahan: async (): Promise<BahanInfo[]> => {
      const { data, error } = await svc
        .from('bahan_baku')
        .select('id, nama, satuan, satuan_tengah, faktor_tengah, satuan_kecil, faktor_tampilan')
        .eq('is_active', true)
        .order('nama')
      if (error) throw new Error(`bahan_baku: ${error.message}`)
      return data ?? []
    },
    barisStok: async (bahanId: string): Promise<BarisStok[]> => {
      const { data, error } = await svc
        .from('monitoring_view_spv')
        .select('outlet_id, bahan_baku_id, current_qty, last_opname_date, saldo_is_gram')
        .eq('bahan_baku_id', bahanId)
      if (error) throw new Error(`monitoring_view_spv: ${error.message}`)
      const seen = new Set<string>()
      return (data ?? []).filter((r: any) => (seen.has(r.outlet_id) ? false : (seen.add(r.outlet_id), true)))
    },
    suratJalan: async (opts): Promise<SuratJalanRingkas[]> => {
      let q = svc
        .from('surat_jalan')
        .select(`
          id,
          outlet_id,
          status,
          created_at,
          outlets (name),
          surat_jalan_item (
            id,
            qty_dikirim,
            qty_terima,
            kondisi,
            selisih,
            bahan_baku (nama, satuan)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(opts.limit ?? 10)
      if (opts.status && opts.status !== 'semua') {
        q = q.eq('status', opts.status)
      }
      const { data, error } = await q
      if (error) throw new Error(`surat_jalan: ${error.message}`)
      return (data ?? []).map((sj: any) => ({
        id: sj.id,
        outlet: sj.outlets?.name ?? '(outlet tidak dikenal)',
        status: sj.status,
        tanggal: sj.created_at ? sj.created_at.slice(0, 10) : null,
        item: (sj.surat_jalan_item ?? []).map((it: any) => ({
          bahan: it.bahan_baku?.nama ?? 'Bahan',
          satuan: it.bahan_baku?.satuan ?? 'pcs',
          qty_dikirim: Number(it.qty_dikirim) || 0,
          qty_terima: it.qty_terima !== null ? Number(it.qty_terima) : null,
          kondisi: it.kondisi ?? 'baik',
          selisih: it.selisih !== null ? Number(it.selisih) : 0,
        })),
      }))
    },
    opname: (opts) => ambilAktivitas('opname', opts),
    permintaanBahan: (opts) => ambilAktivitas('permintaan_bahan', opts),
  }
}
