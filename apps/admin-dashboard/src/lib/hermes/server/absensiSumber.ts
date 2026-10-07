// Loader data bot HRD — HANYA dipanggil route /api/hermes/mcp setelah autentikasi kunci.
// Setiap query meniru layar sumbernya; rumus dari @suka/hr-rumus (satu sumber).
import type { SupabaseClient } from '@supabase/supabase-js'
import { computeBoard, isTestOrDevStaff, tanggalWib, terburuk, type BoardConfig, type BoardRecord, type NilaiCeklist } from '@suka/hr-rumus'
import { outletTerhitungAbsensi } from '../absensi/outlet'
import type { CeklistOutlet, CutiBaris, KasbonOutlet, KonteksAbsensi, OutletAbsensi, PapanOutlet, RekapStafBaris, StafOutlet } from '../absensi/tipe'

const HALAMAN = 1000

/** Ambil semua halaman; `build` wajib membuat builder baru tiap panggilan & berurutan unik. */
async function semuaHalaman<T>(build: () => any): Promise<T[]> {
  const hasil: T[] = []
  for (let dari = 0; ; dari += HALAMAN) {
    const { data, error } = await build().range(dari, dari + HALAMAN - 1)
    if (error) throw new Error(error.message)
    hasil.push(...((data ?? []) as T[]))
    if (!data || data.length < HALAMAN) return hasil
  }
}

function wajib<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

// Fallback config sama dengan /api/attendance/papan (bukan aturan_jam_absen SQL).
const CFG_CADANGAN: BoardConfig = { jam_masuk: '08:00', jam_keluar: '16:00', toleransi_menit: 15 }

export function buatKonteksAbsensi(svc: SupabaseClient, sekarang: Date): KonteksAbsensi {
  const hariIni = tanggalWib(sekarang)
  let janjiOutlet: Promise<OutletAbsensi[]> | null = null
  let janjiStaf: Promise<Map<string, StafOutlet[]>> | null = null

  const outlets = () =>
    (janjiOutlet ??= (async () => {
      const data = wajib(await svc.from('outlets').select('id, name, slug, type, is_active').order('id'))
      return outletTerhitungAbsensi(data as any[])
    })())

  // Staf aktif per lokasi = outlet_staff.outlet_id + staff_outlets (aturan papan & rekap).
  const stafPerOutlet = () =>
    (janjiStaf ??= (async () => {
      const ids = (await outlets()).map((o) => o.id)
      const [utama, tambahan] = await Promise.all([
        semuaHalaman<{ id: string; name: string; outlet_id: string }>(() =>
          svc.from('outlet_staff').select('id, name, outlet_id').eq('status', 'active').in('outlet_id', ids).order('id'),
        ),
        semuaHalaman<{ outlet_id: string; outlet_staff: any }>(() =>
          svc.from('staff_outlets').select('outlet_id, staff_id, outlet_staff!inner(id, name, status)').in('outlet_id', ids).order('outlet_id').order('staff_id'),
        ),
      ])
      const peta = new Map<string, Map<string, StafOutlet>>(ids.map((id) => [id, new Map()]))
      for (const s of utama) peta.get(s.outlet_id)?.set(s.id, { id: s.id, nama: s.name })
      for (const r of tambahan) {
        const st = Array.isArray(r.outlet_staff) ? r.outlet_staff[0] : r.outlet_staff
        if (st?.status === 'active' && !peta.get(r.outlet_id)?.has(st.id)) peta.get(r.outlet_id)?.set(st.id, { id: st.id, nama: st.name })
      }
      return new Map([...peta].map(([k, v]) => [k, [...v.values()]]))
    })())

  async function papan(tanggal: string): Promise<PapanOutlet[]> {
    const daftar = await outlets()
    const ids = daftar.map((o) => o.id)
    const [staf, absen, cfgRes, globalRes, jadwal] = await Promise.all([
      stafPerOutlet(),
      semuaHalaman<BoardRecord & { outlet_id: string }>(() =>
        svc
          .from('attendance')
          .select('id, outlet_id, outlet_staff_id, type, status, ts_server, telat_menit, is_manual_button, shift_jam_masuk, shift_jam_keluar')
          .in('outlet_id', ids)
          .gte('ts_server', `${tanggal}T00:00:00+07:00`)
          .lte('ts_server', `${tanggal}T23:59:59+07:00`)
          .order('ts_server')
          .order('id'),
      ),
      svc.from('outlet_attendance_config').select('outlet_id, jam_masuk, jam_keluar, toleransi_menit, pilih_shift_aktif, shift2_jam_masuk, outlet_attendance_shift(jam_masuk)').in('outlet_id', ids),
      svc.from('global_settings').select('value').eq('key', 'global_attendance_config').maybeSingle(),
      svc.from('attendance_staff_schedule').select('outlet_id, jam_masuk, attendance_staff_schedule_member(staff_id)').in('outlet_id', ids),
    ])
    const cfgLokal = new Map<string, BoardConfig>()
    for (const c of wajib(cfgRes) as any[]) {
      const { outlet_attendance_shift: shift, outlet_id, ...kolom } = c
      cfgLokal.set(outlet_id, { ...kolom, shifts_jam_masuk: ((shift ?? []) as { jam_masuk: string | null }[]).map((s) => s.jam_masuk).filter((j): j is string => !!j) })
    }
    let cfgGlobal: BoardConfig | null = null
    const gv = (wajib(globalRes) as any)?.value
    if (gv) {
      try {
        cfgGlobal = typeof gv === 'string' ? JSON.parse(gv) : gv
      } catch {
        cfgGlobal = null
      }
    }
    const aturan = new Map<string, Map<string, string>>()
    for (const j of wajib(jadwal) as any[]) {
      if (!j.jam_masuk) continue
      const m = aturan.get(j.outlet_id) ?? new Map<string, string>()
      for (const a of j.attendance_staff_schedule_member ?? []) m.set(a.staff_id, String(j.jam_masuk).slice(0, 5))
      aturan.set(j.outlet_id, m)
    }
    return daftar.map((o) => {
      const s = staf.get(o.id) ?? []
      const rec = absen.filter((r) => r.outlet_id === o.id)
      const cfg = cfgLokal.get(o.id) ?? cfgGlobal ?? CFG_CADANGAN
      const { rows, summary } = computeBoard(
        s.map((x) => ({ id: x.id, name: x.nama, role: '' })),
        rec,
        cfg,
        aturan.get(o.id),
        { sekarang, tanggal },
      )
      return {
        outlet: o,
        ringkas: summary,
        staf: rows.map((r) => ({ id: r.id, nama: r.name, state: r.state, menitTelat: r.delay_minutes, jam: r.time })),
      }
    })
  }

  async function rekapStaf(dari: string, sampai: string): Promise<RekapStafBaris[]> {
    const data = wajib(await svc.rpc('hermes_absensi_rekap_staf', { p_dari: dari, p_sampai: sampai })) as any[]
    if (data.length >= HALAMAN) throw new Error('Hasil rekap terpotong (>= 1.000 staf); persempit rentang/outlet.')
    return data.map((r) => ({ staffId: r.outlet_staff_id, hariHadir: r.hari_hadir, telat: r.jumlah_telat, telatToleransi: r.jumlah_telat_toleransi, menitTelat: r.total_menit_telat }))
  }

  // Staf tes/dev/mitra/owner disembunyikan sama seperti layar HR (useHrDirectory).
  async function stafDikecualikan(): Promise<Set<string>> {
    const data = await semuaHalaman<any>(() =>
      svc.from('outlet_staff').select('id, name, username, role, account_category, outlet_id, outlets!outlet_staff_outlet_id_fkey(id, name, slug)').order('id'),
    )
    return new Set(data.filter((s) => isTestOrDevStaff(s)).map((s) => s.id))
  }

  async function cuti(): Promise<CutiBaris[]> {
    const tujuhHariLalu = tanggalWib(new Date(sekarang.getTime() - 7 * 86_400_000))
    const [kecuali, data] = await Promise.all([
      stafDikecualikan(),
      semuaHalaman<any>(() =>
        svc
          .from('leave_requests')
          .select('id, staff_id, leave_type, start_date, end_date, days, status, outlet_staff!leave_requests_staff_id_fkey!inner(name, outlet_id)')
          .or(`status.eq.pending,end_date.gte.${tujuhHariLalu}`)
          .in('status', ['pending', 'approved'])
          .order('start_date')
          .order('id'),
      ),
    ])
    return data
      .filter((r) => !kecuali.has(r.staff_id))
      .map((r) => {
        const st = Array.isArray(r.outlet_staff) ? r.outlet_staff[0] : r.outlet_staff
        return { nama: st?.name ?? '-', outletId: st?.outlet_id ?? null, jenis: r.leave_type, mulai: r.start_date, selesai: r.end_date, hari: r.days, status: r.status }
      })
  }

  async function kasbon(): Promise<KasbonOutlet[]> {
    const kecuali = await stafDikecualikan()
    const data = wajib(await svc.rpc('hermes_kasbon_per_outlet', { p_exclude_staff: [...kecuali] })) as any[]
    return data.map((r) => ({ outletId: r.outlet_id, menungguJumlah: r.menunggu_jumlah, menungguNominal: Number(r.menunggu_nominal), aktifJumlah: r.aktif_jumlah, aktifSisa: Number(r.aktif_sisa) }))
  }

  // Cakupan ceklist = layar Ceklist Harian HR: outlet aktif internal/mitra saja.
  async function ceklist(tanggal: string): Promise<CeklistOutlet[]> {
    const daftar = (await outlets()).filter((o) => o.type === 'internal' || o.type === 'mitra')
    const data = wajib(
      await svc.from('ceklist_harian').select('outlet_id, nama_am, temuan, ditinjau_pada, ceklist_harian_item(nilai)').eq('tanggal', tanggal),
    ) as any[]
    const per = new Map(data.map((d) => [d.outlet_id, d]))
    return daftar.map((o) => {
      const d = per.get(o.id)
      return {
        outlet: o,
        laporan: d
          ? {
              namaAm: d.nama_am ?? '-',
              nilai: terburuk(((d.ceklist_harian_item ?? []) as { nilai: NilaiCeklist }[]).map((i) => i.nilai)),
              jumlahTemuan: (d.temuan ?? []).length,
              ditinjau: Boolean(d.ditinjau_pada),
            }
          : null,
      }
    })
  }

  return { hariIni, sekarang, outlets, papan, stafPerOutlet, rekapStaf, cuti, kasbon, ceklist }
}
