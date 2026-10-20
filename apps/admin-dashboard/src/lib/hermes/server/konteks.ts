// Hanya untuk route /api/hermes/* SETELAH autentikasi kunci lolos.
import { laporanPosUntukScope, type CakupanLaporan } from '@/lib/posReport/laporan'
import { buatAmbilLaporan, ambilOutlets } from '@/lib/sukaBot/server/sumberData'
import { jakartaDate } from '@/lib/ownerDashboardCache'
import type { KonteksHermes } from '../registry'
import { buatKonteksAbsensi } from './absensiSumber'
import { buatKonteksHrRinci } from './hrRinciSumber'
import { buatKonteksFinance } from './financeSumber'
import { buatKonteksStok } from './stokSumber'
import { buatKonteksSistem } from './sistemSumber'

export async function konteksHermes(svc: any, sekarang: Date): Promise<KonteksHermes> {
  // Cakupan 'all' = sama dengan role berakses penuh (owner/admin) di layar Rangkuman Penjualan,
  // jadi angka & cache-nya identik. Pembatasan per bot dilakukan lewat scope DOMAIN, bukan outlet.
  const cakupan: CakupanLaporan = { supabase: svc, scopeKey: 'all', allowedOutletIds: 'all' }
  const outlets = await ambilOutlets(svc)
  const hariIni = jakartaDate(sekarang)
  return {
    sekarang,
    penjualan: {
      outlets,
      hariIni,
      sekarang,
      ambilLaporan: buatAmbilLaporan((req) => laporanPosUntukScope(req, cakupan)),
      auditVoid: async (opts) => {
        const rentangHari = opts.hari ?? 1
        const sejak = new Date(sekarang.getTime() - rentangHari * 24 * 60 * 60 * 1000).toISOString()
        let q = svc
          .from('orders')
          .select('id, total_amount, created_at, outlet_id, outlets(name)')
          .gte('created_at', sejak)
          .eq('status', 'cancelled')
          .order('created_at', { ascending: false })
          .limit(opts.limit ?? 20)

        if (opts.outlet) {
          const target = opts.outlet.trim().toLowerCase()
          const cocok = outlets.find(
            (o) => o.name.toLowerCase() === target || o.slug?.toLowerCase() === target
          )
          if (cocok) {
            q = q.eq('outlet_id', cocok.id)
          }
        }

        const { data, error } = await q
        if (error) throw new Error(`orders void: ${error.message}`)

        const rows = (data ?? []) as any[]
        let totalNilai = 0
        const daftarVoid = rows.map((v) => {
          const amt = Number(v.total_amount) || 0
          totalNilai += amt
          const waktuWib = v.created_at
            ? new Date(v.created_at).toLocaleTimeString('id-ID', {
                timeZone: 'Asia/Jakarta',
                hour: '2-digit',
                minute: '2-digit',
              })
            : '-'
          return {
            id: v.id,
            outlet: v.outlets?.name ?? '(outlet tidak dikenal)',
            total_nilai: amt,
            waktu: waktuWib,
          }
        })

        return {
          rentang_hari: rentangHari,
          total_void: rows.length,
          total_nilai_void: totalNilai,
          daftar_void: daftarVoid,
        }
      },
      statusBuka: async (opts) => {
        const tgl = opts.tanggal ?? hariIni
        const startToday = `${tgl}T00:00:00+07:00`
        const endToday = `${tgl}T23:59:59+07:00`

        const { data, error } = await svc
          .from('shifts')
          .select('id, outlet_id, status, start_time, end_time, outlets(name, type, is_active)')
          .gte('start_time', startToday)
          .lt('start_time', endToday)
          .order('start_time', { ascending: true })

        if (error) throw new Error(`shifts: ${error.message}`)

        const shiftRows = (data ?? []) as any[]
        const openedMap = new Map<string, { outlet: string; jamBuka: string }>()
        for (const s of shiftRows) {
          if (s.outlet_id && !openedMap.has(s.outlet_id)) {
            const startWib = s.start_time
              ? new Date(s.start_time).toLocaleTimeString('id-ID', {
                  timeZone: 'Asia/Jakarta',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '-'
            const outName = s.outlets?.name ?? outlets.find((o) => o.id === s.outlet_id)?.name ?? 'Cabang'
            openedMap.set(s.outlet_id, { outlet: outName, jamBuka: startWib })
          }
        }

        const opOutlets = outlets.filter((o) => {
          const n = o.name.toLowerCase()
          return (
            (o.type === 'internal' || o.type === 'mitra') &&
            o.is_active &&
            !n.includes('pusat') &&
            !n.includes('gudang') &&
            !n.includes('office') &&
            !n.includes('online') &&
            !n.includes('tes') &&
            !n.includes('test')
          )
        })

        const daftarSudahBuka = Array.from(openedMap.values()).map((b) => ({
          outlet: b.outlet,
          jam_buka: b.jamBuka,
        }))

        const daftarBelumBuka = opOutlets
          .filter((o) => !openedMap.has(o.id))
          .map((o) => o.name)

        return {
          tanggal: tgl,
          total_outlet_aktif: opOutlets.length,
          total_sudah_buka: openedMap.size,
          total_belum_buka: daftarBelumBuka.length,
          daftar_belum_buka: daftarBelumBuka,
          daftar_sudah_buka: daftarSudahBuka,
        }
      },
    },
    absensi: buatKonteksAbsensi(svc, sekarang),
    hrRinci: buatKonteksHrRinci(svc, sekarang),
    finance: buatKonteksFinance(svc, sekarang, outlets),
    stok: buatKonteksStok(svc, outlets, hariIni),
    sistem: buatKonteksSistem(svc, sekarang),
  }
}
