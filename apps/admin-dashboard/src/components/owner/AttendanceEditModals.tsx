'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Trash2, X, Pencil, AlertTriangle } from 'lucide-react'
import type { Outlet } from '@/lib/types'
import type { AttendanceRecordExt } from './AttendanceReportView'
import { hapusAbsensi, koreksiAbsensi } from '@/app/dashboard/owner/rekap-absensi/actions'

const STATUS_MASUK = [
  { value: 'tepat', label: 'Hadir tepat waktu' },
  { value: 'telat_toleransi', label: 'Telat (toleransi)' },
  { value: 'telat', label: 'Terlambat' },
  { value: 'alpha', label: 'Alfa / tanpa keterangan' },
] as const

const STATUS_PULANG = [
  { value: 'tepat', label: 'Pulang tepat waktu' },
  { value: 'lebih_awal', label: 'Pulang lebih awal' },
  { value: 'pulang_telat', label: 'Pulang telat' },
] as const

type StatusMasuk = (typeof STATUS_MASUK)[number]['value']
type StatusPulang = (typeof STATUS_PULANG)[number]['value']

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Jam pada record berformat id-ID ("09.11") → "09:11" untuk <input type="time">. */
const toInputTime = (v: string | null | undefined) => (v ? v.slice(0, 5).replace('.', ':') : '')

function statusMasukAwal(row: AttendanceRecordExt): StatusMasuk {
  const raw = row.in_status_raw
  if (raw === 'telat_toleransi' || raw === 'telat' || raw === 'alpha') return raw
  return 'tepat'
}

function statusPulangAwal(row: AttendanceRecordExt): StatusPulang {
  const raw = row.out_status
  if (raw === 'lebih_awal' || raw === 'pulang_telat') return raw
  return 'tepat'
}

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 focus:border-suka-orange focus:bg-white focus:outline-none disabled:opacity-50'
const labelCls = 'block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1'

function Shell({
  title,
  icon,
  onClose,
  children,
  busy,
}: {
  title: string
  icon: React.ReactNode
  onClose: () => void
  children: React.ReactNode
  busy: boolean
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, busy])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
            {icon}
            {title}
          </h2>
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Tutup"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function RowSummary({ row, dateLabel }: { row: AttendanceRecordExt; dateLabel: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3 text-xs">
      <div className="font-extrabold text-slate-900">{row.staff_name}</div>
      <div className="mt-0.5 font-semibold text-slate-500">
        {dateLabel} · {row.outlet_name}
        {row.out_outlet_name ? ` → pulang di ${row.out_outlet_name}` : ''}
      </div>
      {(row.shift_jam_masuk || row.shift_jam_keluar) && (
        <div className="mt-0.5 font-semibold text-slate-500">
          Shift: {row.shift_jam_masuk ?? '?'} – {row.shift_jam_keluar ?? '?'}
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────── Edit ─────────────────────────── */

export function EditAttendanceModal({
  row,
  outlets,
  dateLabel,
  onClose,
}: {
  row: AttendanceRecordExt
  outlets: Outlet[]
  dateLabel: string
  onClose: () => void
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [, startTransition] = useTransition()

  const [adaMasuk, setAdaMasuk] = useState(!!row.clock_in)
  const [jamMasuk, setJamMasuk] = useState(toInputTime(row.clock_in))
  const [statusMasuk, setStatusMasuk] = useState<StatusMasuk>(statusMasukAwal(row))
  const [telat, setTelat] = useState<string>(row.clock_in ? String(row.late_minutes ?? 0) : '')

  const [adaPulang, setAdaPulang] = useState(!!row.clock_out)
  const [jamPulang, setJamPulang] = useState(toInputTime(row.clock_out))
  const [statusPulang, setStatusPulang] = useState<StatusPulang>(statusPulangAwal(row))
  const [menitPulang, setMenitPulang] = useState<string>(row.clock_out ? String(row.out_minutes ?? 0) : '')

  const [outletId, setOutletId] = useState(row.outlet_id)
  const [alasan, setAlasan] = useState('')

  const shiftMasuk = row.shift_jam_masuk
  const shiftKeluar = row.shift_jam_keluar
  const perluOutlet = (adaMasuk && !row.clock_in) || (adaPulang && !row.clock_out)

  // Saran otomatis dari jam shift saat jam diubah; tetap bisa ditimpa manual.
  const ubahJamMasuk = (v: string) => {
    setJamMasuk(v)
    if (!v || !shiftMasuk) return
    const selisih = toMin(v) - toMin(shiftMasuk)
    if (selisih <= 0) {
      setStatusMasuk('tepat')
      setTelat('0')
    } else {
      if (statusMasuk === 'tepat') setStatusMasuk('telat')
      setTelat(String(selisih))
    }
  }
  const ubahJamPulang = (v: string) => {
    setJamPulang(v)
    if (!v || !shiftKeluar) return
    const selisih = toMin(v) - toMin(shiftKeluar)
    if (selisih < 0) {
      setStatusPulang('lebih_awal')
      setMenitPulang(String(-selisih))
    } else {
      setStatusPulang('tepat')
      setMenitPulang('0')
    }
  }

  const galat = (() => {
    if (!adaMasuk && !adaPulang) return 'Minimal salah satu jam harus diisi. Untuk menghapus semua, pakai tombol Hapus.'
    if (adaMasuk && !jamMasuk) return 'Isi jam masuk.'
    if (adaPulang && !jamPulang) return 'Isi jam pulang.'
    if (adaMasuk && adaPulang && jamMasuk && jamPulang && jamPulang <= jamMasuk)
      return 'Jam pulang harus setelah jam masuk.'
    if (perluOutlet && !outletId) return 'Pilih outlet untuk absen yang ditambahkan.'
    if (alasan.trim().length < 3) return 'Tulis alasan koreksi (wajib, tercatat di jejak audit).'
    return null
  })()

  const menitAtauNull = (v: string) => (v.trim() === '' ? null : Math.max(0, Math.round(Number(v))))

  const simpan = async () => {
    if (galat || saving) return
    setSaving(true)
    const hasil = await koreksiAbsensi({
      staffId: row.staff_id,
      tanggal: row.date,
      outletId: perluOutlet ? outletId : null,
      jamMasuk: adaMasuk ? jamMasuk : null,
      statusMasuk: adaMasuk ? statusMasuk : null,
      telatMenit:
        adaMasuk && (statusMasuk === 'telat' || statusMasuk === 'telat_toleransi') ? menitAtauNull(telat) : null,
      jamPulang: adaPulang ? jamPulang : null,
      statusPulang: adaPulang ? statusPulang : null,
      menitPulang: adaPulang && statusPulang !== 'tepat' ? menitAtauNull(menitPulang) : null,
      alasan,
    })
    setSaving(false)
    if (!hasil.ok) {
      toast.error(hasil.pesan)
      return
    }
    toast.success(`Absensi ${row.staff_name} diperbarui`)
    onClose()
    startTransition(() => router.refresh())
  }

  const statusTelat = statusMasuk === 'telat' || statusMasuk === 'telat_toleransi'

  return (
    <Shell title="Edit Absensi" icon={<Pencil size={16} className="text-suka-orange" />} onClose={onClose} busy={saving}>
      <div className="space-y-5 px-5 py-4">
        <RowSummary row={row} dateLabel={dateLabel} />

        {/* Masuk */}
        <fieldset className="space-y-3 rounded-xl border border-emerald-200 p-4">
          <legend className="px-1 text-xs font-extrabold text-emerald-700">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={adaMasuk} onChange={(e) => setAdaMasuk(e.target.checked)} />
              Absen masuk
            </label>
          </legend>
          {adaMasuk ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls} htmlFor="jam-masuk">Jam masuk (WIB)</label>
                <input id="jam-masuk" type="time" className={inputCls} value={jamMasuk} onChange={(e) => ubahJamMasuk(e.target.value)} />
              </div>
              <div>
                <label className={labelCls} htmlFor="status-masuk">Status</label>
                <select id="status-masuk" className={inputCls} value={statusMasuk} onChange={(e) => setStatusMasuk(e.target.value as StatusMasuk)}>
                  {STATUS_MASUK.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              {statusTelat && (
                <div className="col-span-2">
                  <label className={labelCls} htmlFor="telat">Menit terlambat</label>
                  <input
                    id="telat"
                    type="number"
                    min={0}
                    max={1440}
                    inputMode="numeric"
                    className={inputCls}
                    value={telat}
                    placeholder={shiftMasuk ? 'Kosongkan = hitung dari jam shift' : '0'}
                    onChange={(e) => setTelat(e.target.value)}
                  />
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs font-semibold text-slate-500">
              {row.clock_in ? 'Absen masuk akan DIHAPUS saat disimpan.' : 'Tidak ada absen masuk.'}
            </p>
          )}
        </fieldset>

        {/* Pulang */}
        <fieldset className="space-y-3 rounded-xl border border-blue-200 p-4">
          <legend className="px-1 text-xs font-extrabold text-blue-700">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={adaPulang} onChange={(e) => setAdaPulang(e.target.checked)} />
              Absen pulang
            </label>
          </legend>
          {adaPulang ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls} htmlFor="jam-pulang">Jam pulang (WIB)</label>
                <input id="jam-pulang" type="time" className={inputCls} value={jamPulang} onChange={(e) => ubahJamPulang(e.target.value)} />
              </div>
              <div>
                <label className={labelCls} htmlFor="status-pulang">Status</label>
                <select id="status-pulang" className={inputCls} value={statusPulang} onChange={(e) => setStatusPulang(e.target.value as StatusPulang)}>
                  {STATUS_PULANG.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              {statusPulang !== 'tepat' && (
                <div className="col-span-2">
                  <label className={labelCls} htmlFor="menit-pulang">
                    {statusPulang === 'lebih_awal' ? 'Menit lebih awal' : 'Menit lewat jam pulang'}
                  </label>
                  <input
                    id="menit-pulang"
                    type="number"
                    min={0}
                    max={1440}
                    inputMode="numeric"
                    className={inputCls}
                    value={menitPulang}
                    placeholder={shiftKeluar ? 'Kosongkan = hitung dari jam shift' : '0'}
                    onChange={(e) => setMenitPulang(e.target.value)}
                  />
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs font-semibold text-slate-500">
              {row.clock_out ? 'Absen pulang akan DIHAPUS saat disimpan.' : 'Belum ada absen pulang — centang untuk menambahkan.'}
            </p>
          )}
        </fieldset>

        {perluOutlet && (
          <div>
            <label className={labelCls} htmlFor="outlet">Outlet untuk absen yang ditambahkan</label>
            <select id="outlet" className={inputCls} value={outletId} onChange={(e) => setOutletId(e.target.value)}>
              <option value="">— pilih outlet —</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className={labelCls} htmlFor="alasan">Alasan koreksi *</label>
          <textarea
            id="alasan"
            rows={2}
            maxLength={500}
            className={inputCls}
            placeholder="mis. lupa absen pulang, dikonfirmasi SPV"
            value={alasan}
            onChange={(e) => setAlasan(e.target.value)}
          />
        </div>

        {galat && <p className="text-xs font-semibold text-amber-700">{galat}</p>}
      </div>

      <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
        <button onClick={onClose} disabled={saving} className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100">
          Batal
        </button>
        <button
          onClick={simpan}
          disabled={!!galat || saving}
          className="flex items-center gap-1.5 rounded-xl bg-suka-orange px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-suka-orange/90 disabled:opacity-50"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          Simpan Perubahan
        </button>
      </div>
    </Shell>
  )
}

/* ─────────────────────────── Hapus ─────────────────────────── */

export function DeleteAttendanceModal({
  row,
  dateLabel,
  onClose,
}: {
  row: AttendanceRecordExt
  dateLabel: string
  onClose: () => void
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [, startTransition] = useTransition()
  const [alasan, setAlasan] = useState('')
  const valid = alasan.trim().length >= 3

  const hapus = async () => {
    if (!valid || busy) return
    setBusy(true)
    const hasil = await hapusAbsensi({ staffId: row.staff_id, tanggal: row.date, alasan })
    setBusy(false)
    if (!hasil.ok) {
      toast.error(hasil.pesan)
      return
    }
    toast.success(`Absensi ${row.staff_name} tanggal ${dateLabel} dihapus`)
    onClose()
    startTransition(() => router.refresh())
  }

  return (
    <Shell title="Hapus Absensi" icon={<Trash2 size={16} className="text-red-600" />} onClose={onClose} busy={busy}>
      <div className="space-y-4 px-5 py-4">
        <RowSummary row={row} dateLabel={dateLabel} />
        <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-800">
          <AlertTriangle size={16} className="shrink-0" />
          <span>
            Absen masuk {row.clock_in ? `(${row.clock_in})` : ''} dan pulang {row.clock_out ? `(${row.clock_out})` : ''} staf
            ini pada tanggal tersebut akan dihapus dan berpengaruh ke rekap &amp; payroll. Salinan datanya tetap tersimpan
            di jejak audit.
          </span>
        </div>
        <div>
          <label className={labelCls} htmlFor="alasan-hapus">Alasan penghapusan *</label>
          <textarea
            id="alasan-hapus"
            rows={2}
            maxLength={500}
            className={inputCls}
            placeholder="mis. absen ganda / salah akun"
            value={alasan}
            onChange={(e) => setAlasan(e.target.value)}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
        <button onClick={onClose} disabled={busy} className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100">
          Batal
        </button>
        <button
          onClick={hapus}
          disabled={!valid || busy}
          className="flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
        >
          {busy && <Loader2 size={14} className="animate-spin" />}
          Hapus
        </button>
      </div>
    </Shell>
  )
}
