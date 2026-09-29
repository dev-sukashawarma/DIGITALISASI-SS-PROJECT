'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarOff, RefreshCw, Plus, Trash2, Info } from 'lucide-react'
import { Button, Spinner } from '@suka/design-system'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'
import { DatePicker } from '@/components/ui/DatePicker'
import { createClient } from '@/lib/supabase'
import { todayWib } from '@/lib/dateIso'
import {
  hapusHariLiburManual,
  pastikanHariLiburTerbaru,
  setHariLiburAktif,
  sinkronkanHariLibur,
  tambahHariLibur,
} from '@/app/actions/hariLibur'

interface HariLibur {
  tanggal: string
  nama: string
  jenis: 'libur_nasional' | 'cuti_bersama' | 'manual'
  aktif: boolean
  tentatif: boolean
  sumber: 'google' | 'manual'
}

const JENIS_LABEL: Record<HariLibur['jenis'], { label: string; cls: string }> = {
  libur_nasional: { label: 'Libur Nasional', cls: 'bg-red-50 text-red-700 border-red-200' },
  cuti_bersama: { label: 'Cuti Bersama', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  manual: { label: 'Libur Perusahaan', cls: 'bg-violet-50 text-violet-700 border-violet-200' },
}

function formatTanggal(iso: string) {
  return new Date(`${iso}T00:00:00+07:00`).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  })
}

export default function HariLiburPage() {
  const qc = useQueryClient()
  const tahunIni = Number(todayWib().slice(0, 4))
  const [tahun, setTahun] = useState(String(tahunIni))
  const [busy, setBusy] = useState(false)
  const [tglBaru, setTglBaru] = useState('')
  const [namaBaru, setNamaBaru] = useState('')

  // Sinkron otomatis diam-diam bila data > 30 hari
  useEffect(() => {
    pastikanHariLiburTerbaru().then(() => qc.invalidateQueries({ queryKey: ['hari-libur'] }))
  }, [qc])

  const { data: rows = [], isLoading } = useQuery<HariLibur[]>({
    queryKey: ['hari-libur', tahun],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await createClient()
        .from('hari_libur')
        .select('tanggal, nama, jenis, aktif, tentatif, sumber')
        .gte('tanggal', `${tahun}-01-01`)
        .lte('tanggal', `${tahun}-12-31`)
        .order('tanggal')
      if (error) throw error
      return (data ?? []) as HariLibur[]
    },
  })

  const tahunOptions = useMemo(
    () => [tahunIni - 1, tahunIni, tahunIni + 1].map((y) => ({ label: String(y), value: String(y) })),
    [tahunIni]
  )
  const jumlahAktif = rows.filter((r) => r.aktif).length

  const jalankan = async (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) => {
    setBusy(true)
    try {
      const r = await fn()
      if (r.ok) toast.success(r.message)
      else toast.error(r.error)
      await qc.invalidateQueries({ queryKey: ['hari-libur'] })
      await qc.invalidateQueries({ queryKey: ['attendance'] })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hari Libur &amp; Tanggal Merah"
        description="Minggu dan tanggal merah tidak dihitung alfa. Data diambil otomatis dari kalender resmi hari libur Indonesia."
      >
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={() => jalankan(sinkronkanHariLibur)}
          className="rounded-xl border border-suka-gray-200 gap-1.5 font-bold"
        >
          <RefreshCw size={15} className={busy ? 'animate-spin' : ''} /> Sinkronkan Kalender Resmi
        </Button>
      </PageHeader>

      <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 text-xs text-blue-900 flex gap-2.5">
        <Info size={16} className="shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p>
            <strong>Aturan alfa:</strong> hari kerja (bukan Minggu &amp; bukan tanggal merah aktif) tanpa absen dan
            tanpa cuti/izin/sakit yang disetujui. Dihitung otomatis tiap malam pukul 00.10 WIB.
          </p>
          <p>
            Matikan sebuah tanggal bila outlet tetap beroperasi normal (mis. cuti bersama) — karyawan yang tidak
            masuk di tanggal itu akan dihitung alfa. Perubahan langsung menghitung ulang data absensi.
          </p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-suka-gray-200 shadow-sm flex flex-wrap items-end gap-3">
        <div>
          <p className="mb-1 text-xs font-bold text-suka-brown">Tahun</p>
          <Select options={tahunOptions} value={tahun} onChange={setTahun} className="min-w-[110px]" />
        </div>
        <div className="flex-1" />
        <div>
          <p className="mb-1 text-xs font-bold text-suka-brown">Tambah libur perusahaan</p>
          <div className="flex flex-wrap items-center gap-2">
            <DatePicker value={tglBaru} onChange={setTglBaru} placeholder="Pilih tanggal" />
            <input
              value={namaBaru}
              onChange={(e) => setNamaBaru(e.target.value)}
              placeholder="Nama libur, mis. Libur outlet serentak"
              className="w-64 rounded-xl border border-suka-gray-200 px-3 py-2 text-sm outline-none focus:border-suka-orange"
            />
            <Button
              type="button"
              disabled={busy || !tglBaru || !namaBaru.trim()}
              onClick={() =>
                jalankan(async () => {
                  const r = await tambahHariLibur(tglBaru, namaBaru)
                  if (r.ok) {
                    setTglBaru('')
                    setNamaBaru('')
                  }
                  return r
                })
              }
              className="rounded-xl bg-suka-orange text-white font-bold gap-1.5"
            >
              <Plus size={15} /> Tambah
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-suka-gray-200 bg-white shadow-sm">
        <div className="px-4 py-3 border-b border-suka-gray-100 text-xs text-suka-gray-500">
          <strong className="text-suka-ink">{jumlahAktif}</strong> tanggal dihitung libur di {tahun} (di luar hari
          Minggu)
        </div>
        {isLoading ? (
          <div className="flex justify-center p-12">
            <Spinner />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-suka-gray-200 bg-[#FDF9F3] text-suka-brown font-bold text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">Keterangan</th>
                  <th className="px-4 py-3">Jenis</th>
                  <th className="px-4 py-3 text-center">Dihitung Libur</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-suka-gray-100">
                {rows.map((r) => {
                  const lewat = r.tanggal < todayWib()
                  return (
                    <tr key={r.tanggal} className={lewat ? 'text-suka-gray-500' : ''}>
                      <td className="px-4 py-3 font-semibold whitespace-nowrap">{formatTanggal(r.tanggal)}</td>
                      <td className="px-4 py-3">
                        {r.nama}
                        {r.tentatif && (
                          <span className="ml-2 inline-flex rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                            Tanggal belum pasti
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-bold ${JENIS_LABEL[r.jenis].cls}`}
                        >
                          {JENIS_LABEL[r.jenis].label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => jalankan(() => setHariLiburAktif(r.tanggal, !r.aktif))}
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold border transition-colors cursor-pointer ${
                            r.aktif
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-stone-100 text-stone-600 border-stone-200 hover:bg-stone-200'
                          }`}
                          title="Klik untuk mengubah"
                        >
                          {r.aktif ? 'Ya, libur' : 'Tidak, hari kerja'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {r.sumber === 'manual' && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              if (confirm(`Hapus libur "${r.nama}"?`)) jalankan(() => hapusHariLiburManual(r.tanggal))
                            }}
                            className="inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:text-red-800"
                          >
                            <Trash2 size={13} /> Hapus
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-suka-gray-500">
                      <CalendarOff className="mx-auto mb-2 text-suka-gray-300" />
                      Belum ada data hari libur untuk {tahun}. Klik “Sinkronkan Kalender Resmi”.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
