'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Info, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { rupiah } from '@/lib/format'
import { ambilBiayaRab, cocokTargetRab, ringkasBiayaRab, type BiayaRabRow } from '@/lib/biayaRab'

/** receipt_url Marcom bisa URL tunggal atau JSON array string; ambil yang pertama. */
function notaPertama(raw: string | null): string | null {
  if (!raw) return null
  const t = raw.trim()
  if (t.startsWith('[')) {
    try {
      const arr = JSON.parse(t)
      return Array.isArray(arr) && typeof arr[0] === 'string' ? arr[0] : null
    } catch {
      return null
    }
  }
  return t || null
}

/**
 * Kartu "Ditanggung RAB" — HANYA INFORMASI.
 * Angkanya sengaja tidak dikirim ke luar komponen ini, supaya tidak pernah
 * ikut terjumlah ke OPEX/laba. File ini identik di admin-dashboard & finance.
 *
 * `rows` diisi bila pemanggil sudah mengambil datanya (Buku Kas); kalau tidak,
 * komponen mengambil sendiri lewat klien pengguna (tunduk RLS).
 */
export function BiayaRabPanel({
  from,
  to,
  target = 'all',
  mitraIds,
  rows: rowsProp,
  outletIds,
  judul = 'Ditanggung RAB (Dana Investasi)',
}: {
  from: string
  to: string
  target?: string
  mitraIds?: ReadonlySet<string>
  rows?: BiayaRabRow[]
  outletIds?: string[]
  judul?: string
}) {
  const [rowsSendiri, setRowsSendiri] = useState<BiayaRabRow[]>([])
  const [loading, setLoading] = useState(!rowsProp)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const kunciOutlet = (outletIds ?? []).join(',')

  useEffect(() => {
    if (rowsProp) return
    let batal = false
    setLoading(true)
    setError(null)
    ambilBiayaRab(createClient(), { from, to, outletIds: kunciOutlet ? kunciOutlet.split(',') : undefined })
      .then((data) => {
        if (!batal) setRowsSendiri(data)
      })
      .catch((err) => {
        if (!batal) setError(err?.message || 'Gagal memuat')
      })
      .finally(() => {
        if (!batal) setLoading(false)
      })
    return () => {
      batal = true
    }
  }, [from, to, rowsProp, kunciOutlet])

  const rows = rowsProp ?? rowsSendiri
  const kosongSet = useMemo(() => new Set<string>(), [])
  const tersaring = useMemo(
    () => rows.filter((r) => cocokTargetRab(r.outlet_id, target, mitraIds ?? kosongSet)),
    [rows, target, mitraIds, kosongSet]
  )
  const ringkasan = useMemo(() => ringkasBiayaRab(tersaring), [tersaring])

  if (loading && !rowsProp) {
    return (
      <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-4 text-xs text-sky-800 flex items-center gap-2">
        <Loader2 size={14} className="animate-spin" /> Memuat pengeluaran ditanggung RAB...
      </div>
    )
  }
  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">
        Gagal memuat pengeluaran ditanggung RAB: {error}
      </div>
    )
  }
  if (ringkasan.jumlahTransaksi === 0) return null

  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-4 text-xs text-sky-900">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex flex-wrap items-center justify-between gap-2 text-left cursor-pointer"
      >
        <span className="flex items-center gap-2 font-bold">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          {judul}
          <span className="font-normal text-sky-700">· {ringkasan.jumlahTransaksi} transaksi</span>
        </span>
        <span className="font-mono font-bold">{rupiah(ringkasan.total)}</span>
      </button>
      <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-sky-800">
        <Info size={12} className="mt-0.5 shrink-0" />
        Hanya informasi. Pengeluaran ini sudah ditanggung dana investasi (RAB), <b>tidak dihitung</b> di OPEX,
        laba outlet, laba perusahaan, maupun bagi hasil mitra.
      </p>

      {open && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {ringkasan.perOutlet.map((o) => (
              <span
                key={o.outletId ?? 'pusat'}
                className="rounded-lg border border-sky-200 bg-white px-2 py-1"
              >
                {o.nama}: <b className="font-mono">{rupiah(o.total)}</b>
              </span>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left border-collapse">
              <thead className="text-[10px] uppercase tracking-wider text-sky-700">
                <tr className="border-b border-sky-200">
                  <th className="py-1.5 pr-3">Tanggal</th>
                  <th className="py-1.5 pr-3">Outlet</th>
                  <th className="py-1.5 pr-3">Sumber</th>
                  <th className="py-1.5 pr-3">Keterangan</th>
                  <th className="py-1.5 text-right">Nominal</th>
                </tr>
              </thead>
              <tbody>
                {tersaring.map((r) => (
                  <tr key={r.id} className="border-b border-sky-100 last:border-0">
                    <td className="py-1.5 pr-3 font-mono whitespace-nowrap">{r.tanggal}</td>
                    <td className="py-1.5 pr-3 whitespace-nowrap">{r.outlet_nama}</td>
                    <td className="py-1.5 pr-3">{r.kategori_label}</td>
                    <td className="py-1.5 pr-3">
                      {r.keterangan}
                      {notaPertama(r.receipt_url) && (
                        <a
                          href={notaPertama(r.receipt_url) as string}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-1.5 text-sky-700 underline"
                        >
                          nota
                        </a>
                      )}
                    </td>
                    <td className="py-1.5 text-right font-mono whitespace-nowrap">{rupiah(Number(r.jumlah) || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
