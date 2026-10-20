import type { OutletInfo } from '@/lib/sukaBot/alat/penjualan'
import type { BahanInfo, BarisStok } from '@/lib/sukaBot/alat/stok'
import type { AktivitasStokRingkas, KonteksStokHermes, SuratJalanRingkas, HasilWasteHermes } from '../stok/tipe'

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
    waste: async (opts): Promise<HasilWasteHermes> => {
      const outletIds = opts.outlet ? cariOutletIds(opts.outlet) : outlets.map((o) => o.id)
      const sejak = new Date(Date.now() - opts.hari * 24 * 60 * 60 * 1000).toISOString()

      const { data: rawPrices } = await svc
        .from('bahan_baku_harga')
        .select('bahan_baku_id, harga_beli, harga_updated_at')
        .order('harga_updated_at', { ascending: false })
        .limit(250)

      const priceMap = new Map<string, number>()
      for (const p of (rawPrices ?? []) as any[]) {
        if (!priceMap.has(p.bahan_baku_id)) {
          priceMap.set(p.bahan_baku_id, Number(p.harga_beli) || 0)
        }
      }

      let q = svc
        .from('stok_waste_reports')
        .select(`
          id,
          qty,
          reason,
          status,
          created_at,
          outlet_id,
          bahan_baku_id,
          outlets (name),
          bahan_baku (nama, satuan)
        `)
        .gte('created_at', sejak)
        .order('created_at', { ascending: false })
        .limit(600)

      if (opts.outlet) {
        q = q.in('outlet_id', outletIds)
      }

      const { data, error } = await q
      if (error) throw new Error(`stok_waste_reports: ${error.message}`)

      const rows = (data ?? []) as any[]
      const filterBahan = opts.bahan ? opts.bahan.trim().toLowerCase() : null

      let totalEstKerugian = 0
      const bahanMap: Record<string, { nama: string; satuan: string; totalQty: number; frekuensi: number; reasons: Record<string, number>; estKerugian: number }> = {}
      const outletMap: Record<string, { nama: string; frekuensi: number; totalQty: number }> = {}

      let hitungLaporan = 0

      for (const r of rows) {
        const bNama = r.bahan_baku?.nama || 'Bahan Baku'
        if (filterBahan && !bNama.toLowerCase().includes(filterBahan)) {
          continue
        }

        hitungLaporan++
        const sat = r.bahan_baku?.satuan || 'unit'
        const qty = Number(r.qty) || 0
        const hBeli = priceMap.get(r.bahan_baku_id) || 0
        const loss = Math.round(qty * hBeli)
        totalEstKerugian += loss

        if (!bahanMap[bNama]) {
          bahanMap[bNama] = { nama: bNama, satuan: sat, totalQty: 0, frekuensi: 0, reasons: {}, estKerugian: 0 }
        }
        bahanMap[bNama].totalQty += qty
        bahanMap[bNama].frekuensi += 1
        bahanMap[bNama].estKerugian += loss

        const rClean = (r.reason || 'Lainnya').replace(/alasan/gi, 'ket').trim()
        bahanMap[bNama].reasons[rClean] = (bahanMap[bNama].reasons[rClean] || 0) + 1

        const outNama = r.outlets?.name || '(outlet tidak dikenal)'
        if (!outletMap[outNama]) {
          outletMap[outNama] = { nama: outNama, frekuensi: 0, totalQty: 0 }
        }
        outletMap[outNama].frekuensi += 1
        outletMap[outNama].totalQty += qty
      }

      const topBahan = Object.values(bahanMap)
        .sort((a, b) => b.totalQty - a.totalQty)
        .slice(0, opts.limit)
        .map((b) => {
          const topReason = Object.entries(b.reasons).sort((x, y) => y[1] - x[1])[0]?.[0] || '-'
          return {
            bahan: b.nama,
            satuan: b.satuan,
            total_qty: Math.round(b.totalQty * 100) / 100,
            frekuensi: b.frekuensi,
            estimasi_kerugian: b.estKerugian,
            faktor_dominan: topReason,
          }
        })

      const topOutlet = Object.values(outletMap)
        .sort((a, b) => b.frekuensi - a.frekuensi)
        .slice(0, opts.limit)
        .map((o) => ({
          outlet: o.nama,
          frekuensi: o.frekuensi,
          total_qty: Math.round(o.totalQty * 10) / 10,
        }))

      return {
        rentang_hari: opts.hari,
        total_laporan: hitungLaporan,
        total_estimasi_kerugian: totalEstKerugian,
        top_bahan: topBahan,
        top_outlet: topOutlet,
      }
    },
  }
}
