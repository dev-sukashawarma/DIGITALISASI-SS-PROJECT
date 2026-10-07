'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useRole } from '@/components/layout/RoleContext'
import { useLeaveMutations } from '@/hooks/useLeaveMutations'
import { useCashAdvanceMutations } from '@/hooks/useCashAdvanceMutations'
import { useHrDirectory } from '@/hooks/useHrDirectory'
import { useOutlets } from '@/hooks/useOutlets'
import { fetchAllAttendance } from '@/hooks/useAttendance'
import { exportAbsensiExcel } from '@/lib/exportAbsensiExcel'
import { tinjauCeklist, type Laporan } from '@/lib/ceklistHarian'
import { ALL_NAV_ITEMS } from '@/components/layout/navConfig'
import { bangunUrl, bolehJalankanAksi, MAKS_AKSI, pathDiizinkan, type BlokAksi } from '@/lib/botHrd/aksi'

type Hasil = { status: 'jalan' | 'ok' | 'gagal'; pesan?: string }

// Sekali-jalan per kunci: bertahan antar re-render/remount selama sesi tab.
const mulai = new Set<string>()
const hasilMap = new Map<string, Hasil>()
const pendengar = new Map<string, Set<(h: Hasil | undefined) => void>>()

function setHasil(k: string, h: Hasil) {
  hasilMap.set(k, h)
  pendengar.get(k)?.forEach((f) => f(h))
}

const pesanGalat = (e: unknown) =>
  (e instanceof Error ? e.message : (e as { message?: string })?.message) || 'kesalahan tak dikenal'

export function AksiBot({
  aksi,
  kunci,
  boleh,
  dilewati,
}: {
  aksi: BlokAksi
  kunci: string
  /** true hanya untuk balasan yang baru diterima sesi ini. */
  boleh: boolean
  dilewati: boolean
}) {
  const router = useRouter()
  const { role } = useRole()
  const db = useMemo(() => createClient(), [])
  const leave = useLeaveMutations()
  const kasbon = useCashAdvanceMutations()
  const { data: dir } = useHrDirectory()
  const { data: outlets = [] } = useOutlets()
  const [hasil, setH] = useState<Hasil | undefined>(() => hasilMap.get(kunci))

  useEffect(() => {
    let set = pendengar.get(kunci)
    if (!set) {
      set = new Set()
      pendengar.set(kunci, set)
    }
    const s = set
    s.add(setH)
    setH(hasilMap.get(kunci))
    return () => {
      s.delete(setH)
    }
  }, [kunci])

  const berwenang = bolehJalankanAksi(role)
  const siapDir = aksi.aksi !== 'unduh_rekap_absensi' || !!dir

  useEffect(() => {
    if (!boleh || dilewati || !berwenang || !siapDir || mulai.has(kunci)) return
    mulai.add(kunci)
    setHasil(kunci, { status: 'jalan' })
    jalankan()
      .then((pesan) => setHasil(kunci, { status: 'ok', pesan }))
      .catch((e) => setHasil(kunci, { status: 'gagal', pesan: pesanGalat(e) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boleh, dilewati, berwenang, siapDir, kunci])

  async function jalankan(): Promise<string | undefined> {
    switch (aksi.aksi) {
      case 'setujui_cuti':
      case 'tolak_cuti': {
        const { data, error } = await db
          .from('leave_requests')
          .select('id, staff_id, days, status')
          .eq('id', aksi.id)
          .maybeSingle()
        if (error) throw error
        if (!data) throw new Error('Pengajuan cuti tidak ditemukan')
        if (data.status !== 'pending') throw new Error(`Sudah diproses (status: ${data.status})`)
        if (aksi.aksi === 'setujui_cuti') {
          await leave.approve.mutateAsync({ id: data.id, staff_id: data.staff_id, days: Number(data.days) })
        } else {
          await leave.reject.mutateAsync({ id: data.id, rejection_note: aksi.alasan })
        }
        return undefined
      }
      case 'setujui_kasbon':
      case 'tolak_kasbon': {
        const { data, error } = await db.from('cash_advances').select('id, status, status_hr').eq('id', aksi.id).maybeSingle()
        if (error) throw error
        if (!data) throw new Error('Kasbon tidak ditemukan')
        if (data.status_hr !== 'pending' || data.status === 'paid_off') {
          throw new Error(`Sudah diproses (status: ${data.status === 'paid_off' ? 'lunas' : data.status_hr})`)
        }
        if (aksi.aksi === 'setujui_kasbon') await kasbon.approve.mutateAsync(data.id)
        else await kasbon.reject.mutateAsync({ id: data.id, note: aksi.alasan })
        return undefined
      }
      case 'tinjau_ceklist': {
        const { data, error } = await db
          .from('ceklist_harian')
          .select('id, updated_at, ditinjau_pada')
          .eq('id', aksi.id)
          .maybeSingle()
        if (error) throw error
        if (!data) throw new Error('Laporan ceklist tidak ditemukan')
        if (data.ditinjau_pada) throw new Error('Sudah ditinjau sebelumnya')
        const l = { id: data.id, diperbaruiPada: data.updated_at, ditinjauPada: null } as unknown as Laporan
        await tinjauCeklist(db, l, aksi.tanggapan ?? '')
        return undefined
      }
      case 'buka_halaman': {
        if (!pathDiizinkan(aksi.path, ALL_NAV_ITEMS.map((i) => i.href))) throw new Error('Halaman tidak dikenal')
        router.push(bangunUrl(aksi.path, aksi.query))
        return 'Dibuka'
      }
      case 'unduh_rekap_absensi': {
        if (!dir) throw new Error('Data belum siap')
        const filter = { dateFrom: aksi.dari, dateTo: aksi.sampai, outletId: aksi.outlet_id || 'all', status: 'all' }
        const semua = await fetchAllAttendance(db, filter, '', {
          staffIds: dir.excludedStaffIds,
          outletIds: dir.excludedOutletIds,
        })
        if (semua.rows.length === 0) throw new Error('Tidak ada data absensi pada rentang itu')
        const outletLabel =
          filter.outletId === 'all' ? 'Semua Outlet' : outlets.find((o) => o.id === filter.outletId)?.name ?? '-'
        await exportAbsensiExcel(semua.rows, {
          dateFrom: aksi.dari,
          dateTo: aksi.sampai,
          outletLabel,
          statusLabel: 'Semua Status',
          search: '',
        })
        return `${semua.rows.length} catatan diunduh`
      }
    }
  }

  const spinner = (
    <span className="inline-flex items-center gap-1 text-[#8A766C]">
      <Loader2 className="h-3 w-3 animate-spin" /> Menjalankan…
    </span>
  )
  let status: React.ReactNode
  if (dilewati) status = <span className="text-[#8A766C]">Dilewati: maks {MAKS_AKSI} aksi per pesan</span>
  else if (!berwenang) status = <span className="text-red-700">Tidak berwenang</span>
  else if (hasil?.status === 'jalan') status = spinner
  else if (hasil?.status === 'ok') {
    status = (
      <span className="text-emerald-700">
        ✓ {hasil.pesan === 'Dibuka' ? 'Dibuka' : hasil.pesan ? `Berhasil — ${hasil.pesan}` : 'Berhasil'}
      </span>
    )
  } else if (hasil?.status === 'gagal') status = <span className="text-red-700">✗ Gagal: {hasil.pesan}</span>
  else if (boleh) status = spinner
  else status = <span className="text-[#8A766C]">Aksi dari percakapan sebelumnya — tidak dijalankan ulang</span>

  return (
    <div className="w-full min-w-0 rounded-lg border border-[#E8DCCB] bg-[#FDF9F3] p-2.5 text-xs">
      <p className="font-semibold text-[#4A1713]">{aksi.label}</p>
      <p className="mt-0.5">{status}</p>
    </div>
  )
}
