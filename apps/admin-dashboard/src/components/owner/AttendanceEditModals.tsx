'use client'

import { useEffect, useId, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarDays,
  Clock3,
  Loader2,
  LogIn,
  LogOut,
  Minus,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import type { Outlet } from '@/lib/types'
import { Select } from '@/components/ui/Select'
import type { AttendanceRecordExt } from './AttendanceReportView'
import {
  ambilAturanJamAbsensi,
  hapusAbsensi,
  koreksiAbsensi,
  type AturanJamAbsensi,
} from '@/app/dashboard/owner/rekap-absensi/actions'
import { hitungStatusMasuk, hitungStatusPulang } from '@/lib/absensi/statusAbsen'

/* ───────────────────────── Data & helper ───────────────────────── */

type Tone = 'emerald' | 'amber' | 'red' | 'blue'

/** Label & warna status yang AKAN tersimpan — dihitung dari jam, bukan dipilih (hitung_status_absen). */
const LABEL_STATUS: Record<string, { label: string; tone: Tone }> = {
  tepat: { label: 'Tepat waktu', tone: 'emerald' },
  telat_toleransi: { label: 'Telat dlm toleransi', tone: 'blue' },
  telat: { label: 'Terlambat', tone: 'amber' },
  alpha: { label: 'Alfa', tone: 'red' },
  // Pulang: lewat jam pulang tidak diberi label telat (keputusan owner) — hanya
  // "Pulang" atau "Pulang cepat". Data tetap menyimpan 'pulang_telat'/'tepat'.
  pulang: { label: 'Pulang', tone: 'emerald' },
  lebih_awal: { label: 'Pulang cepat', tone: 'blue' },
}

const ALASAN_CEPAT_EDIT = ['Lupa absen pulang', 'Salah input jam', 'Kendala kamera / aplikasi', 'Dikonfirmasi SPV']
const ALASAN_CEPAT_HAPUS = ['Absen ganda', 'Salah akun', 'Data uji coba', 'Tidak masuk kerja']

const TONE_BADGE: Record<Tone, string> = {
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  blue: 'bg-blue-50 text-blue-700 ring-blue-200',
}

const pad = (n: number) => String(n).padStart(2, '0')
const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
const fromMin = (m: number) => {
  const v = ((m % 1440) + 1440) % 1440
  return `${pad(Math.floor(v / 60))}:${pad(v % 60)}`
}
const isJam = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v)
/** Jam pada record berformat id-ID ("09.11") → "09:11". */
const normJam = (v: string | null | undefined) => (v ? v.slice(0, 5).replace('.', ':') : '')

function statusMasukAwal(row: AttendanceRecordExt): string {
  const raw = row.in_status_raw
  return raw === 'telat_toleransi' || raw === 'telat' || raw === 'alpha' ? raw : 'tepat'
}
/** Label pulang yang tampil: hanya 'lebih_awal' yang dibedakan, sisanya 'pulang'. */
const tampilPulang = (status: string | null | undefined, menit: number) =>
  status === 'lebih_awal' ? { status: 'lebih_awal', menit } : { status: 'pulang', menit: 0 }
const menitTampil = (status: string, menit: number) =>
  status === 'telat' || status === 'telat_toleransi' || status === 'lebih_awal' ? ` (${menit} mnt)` : ''

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
}

/* ───────────────────────── Komponen kecil ───────────────────────── */

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-suka-orange/40 ${
        checked ? 'bg-suka-orange' : 'bg-slate-300'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-[22px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

/** Status yang akan tersimpan — dihitung ulang setiap jam berubah. */
function StatusPreview({
  hasil,
  acuan,
  memuat,
  galat,
}: {
  hasil: { status: string; menit: number } | null
  acuan: string | null
  memuat: boolean
  galat: string | null
}) {
  if (!hasil) {
    return (
      <p className="rounded-xl bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-500">
        {memuat ? 'Menghitung status…' : galat ? `Status dihitung otomatis saat disimpan (${galat})` : 'Isi jam yang valid.'}
      </p>
    )
  }
  const meta = LABEL_STATUS[hasil.status] ?? { label: hasil.status, tone: 'emerald' as Tone }
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2">
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Status otomatis</p>
        {acuan && <p className="truncate text-[10px] font-semibold text-slate-400">{acuan}</p>}
      </div>
      <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${TONE_BADGE[meta.tone]}`}>
        {meta.label}
        {menitTampil(hasil.status, hasil.menit)}
      </span>
    </div>
  )
}

/** Input jam custom: ketik bebas (0930 → 09:30), tombol ±5 menit, dan pintasan. */
function TimeField({
  value,
  onChange,
  shortcuts,
  label,
}: {
  value: string
  onChange: (v: string) => void
  shortcuts: { label: string; value: string }[]
  label: string
}) {
  const id = useId()
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])

  const commit = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 4)
    let next = ''
    if (digits.length === 4) next = `${digits.slice(0, 2)}:${digits.slice(2)}`
    else if (digits.length === 3) next = `0${digits[0]}:${digits.slice(1)}`
    else if (digits.length > 0 && digits.length <= 2) next = `${pad(Number(digits))}:00`
    if (next && isJam(next)) onChange(next)
    else setDraft(value)
  }
  const geser = (d: number) => onChange(fromMin((isJam(value) ? toMin(value) : 0) + d))

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-[11px] font-bold uppercase tracking-wide text-slate-500">
        {label}
      </label>
      <div className="flex items-stretch overflow-hidden rounded-xl border border-slate-200 bg-white focus-within:border-suka-orange focus-within:ring-2 focus-within:ring-suka-orange/15">
        <button
          type="button"
          onClick={() => geser(-5)}
          className="px-3 text-slate-500 hover:bg-slate-50 hover:text-slate-800"
          aria-label="Mundur 5 menit"
        >
          <Minus size={14} />
        </button>
        <div className="flex flex-1 items-center justify-center gap-1.5 border-x border-slate-100">
          <Clock3 size={14} className="text-slate-400" />
          <input
            id={id}
            value={draft}
            inputMode="numeric"
            placeholder="--:--"
            maxLength={5}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit((e.target as HTMLInputElement).value)
              if (e.key === 'ArrowUp') {
                e.preventDefault()
                geser(1)
              }
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                geser(-1)
              }
            }}
            className="w-16 bg-transparent py-2.5 text-center font-mono text-lg font-extrabold tracking-wider text-slate-900 focus:outline-none"
          />
          <span className="text-[10px] font-bold text-slate-400">WIB</span>
        </div>
        <button
          type="button"
          onClick={() => geser(5)}
          className="px-3 text-slate-500 hover:bg-slate-50 hover:text-slate-800"
          aria-label="Maju 5 menit"
        >
          <Plus size={14} />
        </button>
      </div>
      {shortcuts.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {shortcuts.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => onChange(s.value)}
              className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors ${
                value === s.value ? 'bg-suka-orange/10 text-suka-brown' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ReasonField({
  value,
  onChange,
  quick,
  placeholder,
  showError,
}: {
  value: string
  onChange: (v: string) => void
  quick: string[]
  placeholder: string
  showError: boolean
}) {
  const id = useId()
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-[11px] font-bold uppercase tracking-wide text-slate-500">
        Alasan <span className="text-red-500">*</span>
      </label>
      <div className="flex flex-wrap gap-1.5">
        {quick.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onChange(q)}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
              value === q
                ? 'border-suka-orange bg-suka-orange/10 text-suka-brown'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
            }`}
          >
            {q}
          </button>
        ))}
      </div>
      <textarea
        id={id}
        rows={2}
        maxLength={500}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full resize-none rounded-xl border bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
          showError ? 'border-red-300 focus:ring-red-100' : 'border-slate-200 focus:border-suka-orange focus:ring-suka-orange/15'
        }`}
      />
      {showError && <p className="text-[11px] font-semibold text-red-600">Alasan wajib diisi — tercatat di jejak audit.</p>}
    </div>
  )
}

function Shell({
  children,
  onClose,
  busy,
  labelledBy,
  size = 'lg',
}: {
  children: React.ReactNode
  onClose: () => void
  busy: boolean
  labelledBy: string
  size?: 'md' | 'lg'
}) {
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) closeRef.current()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [busy])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-[2px] sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`flex max-h-[94vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl ${
          size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-md'
        }`}
      >
        {children}
      </div>
    </div>
  )
}

function Header({
  row,
  dateLabel,
  titleId,
  title,
  icon,
  onClose,
  busy,
}: {
  row: AttendanceRecordExt
  dateLabel: string
  titleId: string
  title: string
  icon: React.ReactNode
  onClose: () => void
  busy: boolean
}) {
  return (
    <div className="border-b border-slate-100 px-5 pb-4 pt-5 sm:px-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-suka-orange/10 text-sm font-black text-suka-brown">
            {initials(row.staff_name)}
          </div>
          <div>
            <p id={titleId} className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
              {icon}
              {title}
            </p>
            <p className="text-base font-extrabold leading-tight text-slate-900">{row.staff_name}</p>
            <p className="text-[11px] font-bold uppercase text-suka-orange">{row.staff_role}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          aria-label="Tutup"
        >
          <X size={18} />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-semibold text-slate-600">
        <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1">
          <CalendarDays size={12} /> {dateLabel}
        </span>
        <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1">
          <Building2 size={12} /> {row.outlet_name}
          {row.out_outlet_name ? ` → ${row.out_outlet_name}` : ''}
        </span>
        {(row.shift_jam_masuk || row.shift_jam_keluar) && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1">
            <Clock3 size={12} /> Shift {row.shift_jam_masuk ?? '?'}–{row.shift_jam_keluar ?? '?'}
          </span>
        )}
      </div>
    </div>
  )
}

function SideCard({
  tone,
  icon,
  title,
  enabled,
  onToggle,
  asal,
  children,
  emptyText,
}: {
  tone: 'emerald' | 'blue'
  icon: React.ReactNode
  title: string
  enabled: boolean
  onToggle: (v: boolean) => void
  asal: string | null
  children: React.ReactNode
  emptyText: string
}) {
  const accent = tone === 'emerald' ? 'text-emerald-700 bg-emerald-50' : 'text-blue-700 bg-blue-50'
  return (
    <section className={`rounded-2xl border p-4 transition-colors ${enabled ? 'border-slate-200 bg-white' : 'border-dashed border-slate-200 bg-slate-50/60'}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${accent}`}>{icon}</span>
          <div>
            <p className="text-sm font-extrabold text-slate-900">{title}</p>
            <p className="text-[10px] font-semibold text-slate-400">{asal ? `Tercatat ${asal}` : 'Belum tercatat'}</p>
          </div>
        </div>
        <Toggle checked={enabled} onChange={onToggle} label={title} />
      </div>
      {enabled ? <div className="space-y-3">{children}</div> : <p className="py-3 text-center text-xs font-semibold text-slate-400">{emptyText}</p>}
    </section>
  )
}

/* ───────────────────────── Edit ───────────────────────── */

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
  const titleId = useId()
  const [saving, setSaving] = useState(false)
  const [tried, setTried] = useState(false)
  const [, startTransition] = useTransition()

  const asalMasuk = normJam(row.clock_in)
  const asalPulang = normJam(row.clock_out)
  const shiftMasuk = row.shift_jam_masuk ?? null
  const shiftKeluar = row.shift_jam_keluar ?? null

  const [adaMasuk, setAdaMasuk] = useState(!!asalMasuk)
  const [jamMasuk, setJamMasuk] = useState(asalMasuk || shiftMasuk || '')
  const [alfa, setAlfa] = useState(row.in_status_raw === 'alpha')

  const [adaPulang, setAdaPulang] = useState(!!asalPulang)
  const [jamPulang, setJamPulang] = useState(asalPulang || shiftKeluar || '')

  const [outletId, setOutletId] = useState(row.outlet_id)
  const [alasan, setAlasan] = useState('')

  const perluOutlet = (adaMasuk && !asalMasuk) || (adaPulang && !asalPulang)

  // Status tidak dipilih manual: database (koreksi_absensi → hitung_status_absen) selalu
  // menghitung ulang dari jam. Di sini hanya pratinjau dengan aturan yang sama.
  // Outlet acuan = outlet baris yang sudah ada, atau outlet pilihan untuk absen baru.
  const outletMasuk = asalMasuk ? row.outlet_id : outletId
  const outletPulang = asalPulang ? row.out_outlet_id || row.outlet_id : outletId

  const [aturan, setAturan] = useState<Record<string, AturanJamAbsensi>>({})
  const [galatAturan, setGalatAturan] = useState<string | null>(null)
  useEffect(() => {
    const perlu = Array.from(new Set([outletMasuk, outletPulang].filter(Boolean))).filter((id) => !aturan[id])
    if (perlu.length === 0) return
    let batal = false
    Promise.all(perlu.map((id) => ambilAturanJamAbsensi(id).then((h) => [id, h] as const))).then((hasil) => {
      if (batal) return
      const baru: Record<string, AturanJamAbsensi> = {}
      for (const [id, h] of hasil) {
        if (h.ok) baru[id] = h.aturan
        else setGalatAturan(h.pesan)
      }
      if (Object.keys(baru).length > 0) setAturan((prev) => ({ ...prev, ...baru }))
    })
    return () => {
      batal = true
    }
  }, [outletMasuk, outletPulang, aturan])

  const cfgMasuk = outletMasuk ? aturan[outletMasuk] : undefined
  const cfgPulang = outletPulang ? aturan[outletPulang] : undefined
  // Shift yang tercatat di baris menang; tanpa shift → jam config outlet.
  const aturanMasuk = cfgMasuk && {
    jamMasuk: shiftMasuk ?? cfgMasuk.jamMasuk,
    jamKeluar: shiftKeluar ?? cfgMasuk.jamKeluar,
    toleransiMenit: cfgMasuk.toleransiMenit,
  }
  const aturanPulang = cfgPulang && {
    jamMasuk: shiftMasuk ?? cfgPulang.jamMasuk,
    jamKeluar: shiftKeluar ?? cfgPulang.jamKeluar,
    toleransiMenit: cfgPulang.toleransiMenit,
  }
  const hasilMasuk = alfa
    ? { status: 'alpha', menit: 0 }
    : aturanMasuk && isJam(jamMasuk)
      ? hitungStatusMasuk(jamMasuk, aturanMasuk)
      : null
  const hasilPulang = aturanPulang && isJam(jamPulang) ? hitungStatusPulang(jamPulang, aturanPulang) : null
  const pulangBaru = hasilPulang ? tampilPulang(hasilPulang.status, hasilPulang.menit) : null
  const acuanMasuk = alfa
    ? 'Ditandai manual'
    : aturanMasuk
      ? `Acuan ${shiftMasuk ? 'shift' : 'jam outlet'} ${aturanMasuk.jamMasuk} · toleransi ${aturanMasuk.toleransiMenit} mnt`
      : null
  const acuanPulang = aturanPulang ? `Acuan ${shiftKeluar ? 'shift' : 'jam outlet'} ${aturanPulang.jamKeluar}` : null

  const masalah = (() => {
    if (!adaMasuk && !adaPulang) return 'Aktifkan minimal satu absen. Untuk menghapus semuanya, pakai tombol Hapus.'
    if (adaMasuk && !isJam(jamMasuk)) return 'Jam masuk belum valid.'
    if (adaPulang && !isJam(jamPulang)) return 'Jam pulang belum valid.'
    if (adaMasuk && adaPulang && toMin(jamPulang) <= toMin(jamMasuk)) return 'Jam pulang harus setelah jam masuk.'
    if (perluOutlet && !outletId) return 'Pilih outlet untuk absen yang ditambahkan.'
    return null
  })()
  const alasanKurang = alasan.trim().length < 3

  // Ringkasan perubahan untuk dibaca sekilas sebelum simpan.
  const perubahan: string[] = []
  if (adaMasuk !== !!asalMasuk) perubahan.push(adaMasuk ? `Tambah masuk ${jamMasuk}` : `Hapus masuk ${asalMasuk}`)
  else if (adaMasuk && jamMasuk !== asalMasuk) perubahan.push(`Masuk ${asalMasuk} → ${jamMasuk}`)
  // Termasuk saat jam tak berubah tapi status tersimpan basi (koreksi lama) —
  // simpan ulang akan meluruskannya.
  if (
    adaMasuk &&
    hasilMasuk &&
    (hasilMasuk.status !== statusMasukAwal(row) ||
      (hasilMasuk.status !== 'tepat' && hasilMasuk.status !== 'alpha' && hasilMasuk.menit !== (row.late_minutes ?? 0)))
  )
    perubahan.push(`Status masuk → ${LABEL_STATUS[hasilMasuk.status]?.label}${menitTampil(hasilMasuk.status, hasilMasuk.menit)}`)
  if (adaPulang !== !!asalPulang) perubahan.push(adaPulang ? `Tambah pulang ${jamPulang}` : `Hapus pulang ${asalPulang}`)
  else if (adaPulang && jamPulang !== asalPulang) perubahan.push(`Pulang ${asalPulang} → ${jamPulang}`)
  const pulangAwal = tampilPulang(row.out_status, row.out_minutes ?? 0)
  if (
    adaPulang &&
    pulangBaru &&
    (pulangBaru.status !== pulangAwal.status || pulangBaru.menit !== pulangAwal.menit)
  )
    perubahan.push(`Status pulang → ${LABEL_STATUS[pulangBaru.status]?.label}${menitTampil(pulangBaru.status, pulangBaru.menit)}`)

  const simpan = async () => {
    setTried(true)
    if (masalah || alasanKurang || saving) return
    setSaving(true)
    const hasil = await koreksiAbsensi({
      staffId: row.staff_id,
      tanggal: row.date,
      outletId: perluOutlet ? outletId : null,
      jamMasuk: adaMasuk ? jamMasuk : null,
      alfa: adaMasuk && alfa,
      jamPulang: adaPulang ? jamPulang : null,
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

  return (
    <Shell onClose={onClose} busy={saving} labelledBy={titleId}>
      <Header
        row={row}
        dateLabel={dateLabel}
        titleId={titleId}
        title="Edit absensi"
        icon={<Pencil size={11} />}
        onClose={onClose}
        busy={saving}
      />

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
        <div className="grid gap-3 md:grid-cols-2">
          <SideCard
            tone="emerald"
            icon={<LogIn size={14} />}
            title="Absen masuk"
            enabled={adaMasuk}
            onToggle={setAdaMasuk}
            asal={asalMasuk || null}
            emptyText={asalMasuk ? 'Absen masuk akan dihapus.' : 'Aktifkan untuk menambahkan.'}
          >
            <TimeField
              label="Jam masuk"
              value={jamMasuk}
              onChange={setJamMasuk}
              shortcuts={[
                ...(aturanMasuk ? [{ label: `Sesuai ${shiftMasuk ? 'shift' : 'jam'} ${aturanMasuk.jamMasuk}`, value: aturanMasuk.jamMasuk }] : []),
                ...(asalMasuk && asalMasuk !== aturanMasuk?.jamMasuk ? [{ label: `Jam asal ${asalMasuk}`, value: asalMasuk }] : []),
              ]}
            />
            <StatusPreview hasil={hasilMasuk} acuan={acuanMasuk} memuat={!cfgMasuk && !galatAturan} galat={galatAturan} />
            <div className="flex items-center justify-between gap-3 px-1">
              <span className="text-xs font-bold text-slate-600">Tandai Alfa</span>
              <Toggle checked={alfa} onChange={setAlfa} label="Tandai Alfa" />
            </div>
          </SideCard>

          <SideCard
            tone="blue"
            icon={<LogOut size={14} />}
            title="Absen pulang"
            enabled={adaPulang}
            onToggle={setAdaPulang}
            asal={asalPulang || null}
            emptyText={asalPulang ? 'Absen pulang akan dihapus.' : 'Belum absen pulang — aktifkan untuk menambahkan.'}
          >
            <TimeField
              label="Jam pulang"
              value={jamPulang}
              onChange={setJamPulang}
              shortcuts={[
                ...(aturanPulang ? [{ label: `Sesuai ${shiftKeluar ? 'shift' : 'jam'} ${aturanPulang.jamKeluar}`, value: aturanPulang.jamKeluar }] : []),
                ...(asalPulang && asalPulang !== aturanPulang?.jamKeluar ? [{ label: `Jam asal ${asalPulang}`, value: asalPulang }] : []),
              ]}
            />
            <StatusPreview hasil={pulangBaru}acuan={acuanPulang} memuat={!cfgPulang && !galatAturan} galat={galatAturan} />
          </SideCard>
        </div>

        {perluOutlet && (
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Outlet absen baru</p>
            <Select
              options={outlets.map((o) => ({ value: o.id, label: o.name }))}
              value={outletId}
              onChange={setOutletId}
              placeholder="Pilih outlet"
              searchable
              searchPlaceholder="Cari outlet..."
            />
          </div>
        )}

        <ReasonField
          value={alasan}
          onChange={setAlasan}
          quick={ALASAN_CEPAT_EDIT}
          placeholder="Tulis alasan lain bila perlu…"
          showError={tried && alasanKurang}
        />
      </div>

      <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-6">
        {masalah ? (
          <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-amber-700">
            <AlertTriangle size={13} /> {masalah}
          </p>
        ) : perubahan.length > 0 ? (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {perubahan.map((p) => (
              <span key={p} className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">
                <ArrowRight size={11} className="text-suka-orange" /> {p}
              </span>
            ))}
          </div>
        ) : (
          <p className="mb-3 text-xs font-semibold text-slate-400">Belum ada perubahan.</p>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-200/60"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={simpan}
            disabled={saving || !!masalah || perubahan.length === 0}
            className="flex items-center justify-center gap-2 rounded-xl bg-suka-orange px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-suka-orange/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            Simpan perubahan
          </button>
        </div>
      </div>
    </Shell>
  )
}

/* ───────────────────────── Hapus ───────────────────────── */

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
  const titleId = useId()
  const [busy, setBusy] = useState(false)
  const [tried, setTried] = useState(false)
  const [, startTransition] = useTransition()
  const [alasan, setAlasan] = useState('')
  const alasanKurang = alasan.trim().length < 3

  const hapus = async () => {
    setTried(true)
    if (alasanKurang || busy) return
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
    <Shell onClose={onClose} busy={busy} labelledBy={titleId} size="md">
      <Header
        row={row}
        dateLabel={dateLabel}
        titleId={titleId}
        title="Hapus absensi"
        icon={<Trash2 size={11} />}
        onClose={onClose}
        busy={busy}
      />
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-slate-50 p-3 text-center">
            <p className="text-[10px] font-bold uppercase text-slate-400">Masuk</p>
            <p className="font-mono text-lg font-extrabold text-slate-900 line-through decoration-red-400">{normJam(row.clock_in) || '—'}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3 text-center">
            <p className="text-[10px] font-bold uppercase text-slate-400">Pulang</p>
            <p className="font-mono text-lg font-extrabold text-slate-900 line-through decoration-red-400">{normJam(row.clock_out) || '—'}</p>
          </div>
        </div>
        <div className="flex gap-2.5 rounded-2xl bg-red-50 px-4 py-3 text-xs font-semibold leading-relaxed text-red-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>Seluruh absensi staf ini pada tanggal tersebut akan dihapus dan ikut memengaruhi rekap &amp; payroll. Salinannya tetap tersimpan di jejak audit.</span>
        </div>
        <ReasonField
          value={alasan}
          onChange={setAlasan}
          quick={ALASAN_CEPAT_HAPUS}
          placeholder="Tulis alasan lain bila perlu…"
          showError={tried && alasanKurang}
        />
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-200/60"
        >
          Batal
        </button>
        <button
          type="button"
          onClick={hapus}
          disabled={busy}
          className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-red-700 disabled:opacity-40"
        >
          {busy && <Loader2 size={15} className="animate-spin" />}
          Hapus absensi
        </button>
      </div>
    </Shell>
  )
}
