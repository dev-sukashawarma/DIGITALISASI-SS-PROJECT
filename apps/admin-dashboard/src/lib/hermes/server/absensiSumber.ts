// Loader data bot HRD — HANYA dipanggil route /api/hermes/mcp setelah autentikasi kunci.
// Setiap query meniru layar sumbernya; rumus dari @suka/hr-rumus (satu sumber).
import type { SupabaseClient } from '@supabase/supabase-js'
import { computeBoard, isTestOrDevStaff, outletRumah, petaPengecualian, tanggalWib, tempatkanStaf, terburuk, type BoardConfig, type BoardRecord, type NilaiCeklist, type StafPenempatan } from '@suka/hr-rumus'
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
  let janjiSemua: Promise<StafPenempatan[]> | null = null

  const outlets = () =>
    (janjiOutlet ??= (async () => {
      const data = wajib(await svc.from('outlets').select('id, name, slug, type, is_active').order('id'))
      return outletTerhitungAbsensi(data as any[])
    })())

  // Semua staf aktif (utama + penugasan staff_outlets), tanpa akun tes/dev/mitra/owner (R3).
  // Tiap orang SATU entri; penempatan ke outlet ditentukan tempatkanStaf/outletRumah.
  const semuaStaf = () =>
    (janjiSemua ??= (async () => {
      const [utama, tambahan] = await Promise.all([
        semuaHalaman<any>(() =>
          svc
            .from('outlet_staff')
            .select('id, name, username, role, account_category, outlet_id, outlets!outlet_staff_outlet_id_fkey(id, name, slug)')
            .eq('status', 'active')
            .order('id'),
        ),
        semuaHalaman<{ staff_id: string; outlet_id: string }>(() =>
          svc.from('staff_outlets').select('staff_id, outlet_id').order('staff_id').order('outlet_id'),
        ),
      ])
      const tambahanPer = new Map<string, string[]>()
      for (const r of tambahan) {
        const arr = tambahanPer.get(r.staff_id) ?? []
        arr.push(r.outlet_id)
        tambahanPer.set(r.staff_id, arr)
      }
      return utama
        .filter((s) => !isTestOrDevStaff(s))
        .map<StafPenempatan>((s) => ({ id: s.id, name: s.name, role: s.role ?? '', outletUtama: s.outlet_id ?? null, outletTambahan: tambahanPer.get(s.id) ?? [] }))
    })())

  // Tiap orang muncul SEKALI di outlet rumahnya (R4); dipakai rekap/telat bulan ini.
  const stafPerOutlet = () =>
    (janjiStaf ??= (async () => {
      const cakupan = await outlets()
      const staf = await semuaStaf()
      const peta = new Map<string, StafOutlet[]>(cakupan.map((o) => [o.id, []]))
      for (const s of staf) {
        const rumah = outletRumah(s, cakupan)
        if (rumah) peta.get(rumah)?.push({ id: s.id, nama: s.name })
      }
      return peta
    })())

  async function papan(tanggal: string): Promise<PapanOutlet[]> {
    const daftar = await outlets()
    const ids = daftar.map((o) => o.id)
    const [staf, absen, cfgRes, globalRes, jadwal, cutiRes, rosterRes, kerjaRes, liburRes, roleRes] = await Promise.all([
      semuaStaf(),
      semuaHalaman<BoardRecord & { outlet_id: string }>(() =>
        svc
          .from('attendance')
          .select('id, outlet_id, outlet_staff_id, type, status, ts_server, telat_menit, is_manual_button, shift_jam_masuk, shift_jam_keluar')
          .gte('ts_server', `${tanggal}T00:00:00+07:00`)
          .lte('ts_server', `${tanggal}T23:59:59+07:00`)
          .order('ts_server')
          .order('id'),
      ),
      svc.from('outlet_attendance_config').select('outlet_id, jam_masuk, jam_keluar, toleransi_menit, pilih_shift_aktif, shift2_jam_masuk, outlet_attendance_shift(jam_masuk)').in('outlet_id', ids),
      svc.from('global_settings').select('value').eq('key', 'global_attendance_config').maybeSingle(),
      svc.from('attendance_staff_schedule').select('outlet_id, jam_masuk, attendance_staff_schedule_member(staff_id)').in('outlet_id', ids),
      // Pengecualian alpa/belum: cuti disetujui, Off Shift Roster, libur role kantor (aturan HR di DB).
      svc.from('leave_requests').select('staff_id, leave_type, start_date, end_date').eq('status', 'approved').lte('start_date', tanggal).gte('end_date', tanggal),
      svc.from('attendance_logs').select('staff_id').eq('date', tanggal).ilike('notes', 'off'),
      svc.rpc('hr_hari_kerja', { p_tgl: tanggal }),
      svc.from('hari_libur').select('nama').eq('tanggal', tanggal).eq('aktif', true).limit(1),
      svc.rpc('hr_role_libur_kantor'),
    ])
    const hariKerja = wajib(kerjaRes) !== false
    const pengecualian = petaPengecualian({
      tanggal,
      staf: staf.map((s) => ({ id: s.id, role: s.role })),
      cutiDisetujui: wajib(cutiRes) as any[],
      hariKerja,
      namaHariLibur: ((wajib(liburRes) as any[])[0]?.nama as string | undefined) ?? null,
      roleLiburKantor: (wajib(roleRes) as string[] | null) ?? [],
      rosterOff: new Set(((wajib(rosterRes) as any[]) ?? []).map((r) => r.staff_id as string)),
    })
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
    // R1/R2: hadir bila ada catatan non-alpha di outlet mana pun; tiap orang sekali per hari.
    const tempat = tempatkanStaf(staf, absen.filter((r) => r.status !== 'alpha'), daftar)
    return daftar.map((o) => {
      const p = tempat.get(o.id) ?? { staf: [], records: [] }
      const cfg = cfgLokal.get(o.id) ?? cfgGlobal ?? CFG_CADANGAN
      const { rows, summary } = computeBoard(p.staf, p.records, cfg, aturan.get(o.id), { sekarang, tanggal, pengecualian })
      return {
        outlet: o,
        ringkas: summary,
        staf: rows.map((r) => ({ id: r.id, nama: r.name, state: r.state, menitTelat: r.delay_minutes, jam: r.time, keterangan: r.keterangan ?? null })),
      }
    })
  }

  async function rekapStaf(dari: string, sampai: string): Promise<RekapStafBaris[]> {
    const data = wajib(await svc.rpc('hermes_absensi_rekap_staf', { p_dari: dari, p_sampai: sampai })) as any[]
    if (data.length >= HALAMAN) throw new Error('Hasil rekap terpotong (>= 1.000 staf); persempit rentang/outlet.')
    return data.map((r) => ({ staffId: r.outlet_staff_id, hariHadir: r.hari_hadir, telat: r.jumlah_telat, telatToleransi: r.jumlah_telat_toleransi, menitTelat: r.total_menit_telat, hariDikecualikan: r.hari_dikecualikan ?? 0 }))
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
        return { id: r.id as string, nama: st?.name ?? '-', outletId: st?.outlet_id ?? null, jenis: r.leave_type, mulai: r.start_date, selesai: r.end_date, hari: r.days, status: r.status }
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
      await svc.from('ceklist_harian').select('id, outlet_id, nama_am, temuan, updated_at, ditinjau_pada, ceklist_harian_item(nilai)').eq('tanggal', tanggal),
    ) as any[]
    const per = new Map(data.map((d) => [d.outlet_id, d]))
    return daftar.map((o) => {
      const d = per.get(o.id)
      return {
        outlet: o,
        laporan: d
          ? {
              id: d.id as string,
              diperbaruiPada: (d.updated_at as string | null) ?? null,
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
