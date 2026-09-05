'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  Battery,
  Crosshair,
  Gauge,
  MapPin,
  Radio,
  Route,
  Search,
  ShieldAlert,
  Users,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import {
  accuracyText,
  batteryText,
  mapJoinedRow,
  cleanTrail,
  droppedTotal,
  mapRow,
  relativeTime,
  roleLabel,
  speedKmh,
  STATUS_COLOR,
  STATUS_LABEL,
  statusOf,
  TRAIL_WINDOW_HOURS,
  type LiveLocationJoinedRow,
  type LiveLocationRow,
  type StaffLocation,
  type TrailFilterResult,
  type TrailPoint,
} from '@/lib/liveLocation'

// Leaflet menyentuh `window` saat import, jadi peta wajib client-only.
const LiveLocationMap = dynamic(() => import('./LiveLocationMap'), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center bg-slate-100 text-sm font-semibold text-slate-400">
      Memuat peta…
    </div>
  ),
})

const LIVE_SELECT =
  'outlet_staff_id, outlet_id, lat, lng, accuracy_m, speed_mps, heading_deg, altitude_m, battery_pct, is_charging, is_mock, is_moving, provider, device_name, recorded_at, updated_at, outlet_staff!inner(name, role, status, ref_photo_url), outlets(name)'

type TrailRow = { lat: number; lng: number; recorded_at: string; accuracy_m: number | null; is_mock: boolean }

export default function LiveLocationBoard() {
  const supabase = useMemo(() => createClient(), [])
  const [staff, setStaff] = useState<StaffLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [outletFilter, setOutletFilter] = useState('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [focusNonce, setFocusNonce] = useState(0)
  const [fitNonce, setFitNonce] = useState(0)
  const [showTrail, setShowTrail] = useState(false)
  const [trail, setTrail] = useState<TrailPoint[]>([])
  const [now, setNow] = useState(() => Date.now())

  // Dipakai handler realtime supaya tidak perlu ikut dependency state.
  const staffRef = useRef<StaffLocation[]>([])
  staffRef.current = staff

  // Jam internal: status offline & label "x menit lalu" ikut jalan tanpa data baru.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const loadInitial = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from('staff_live_locations')
      .select(LIVE_SELECT)
      .order('recorded_at', { ascending: false })

    if (loadError) {
      console.error('staff_live_locations', loadError)
      setError('Gagal memuat posisi staff. Cek koneksi atau hak akses Anda.')
      setLoading(false)
      return
    }
    const rows = (data ?? []) as unknown as LiveLocationJoinedRow[]
    setError(null)
    setStaff(rows.map(mapJoinedRow))
    setLoading(false)
  }, [supabase])

  /** Baris baru dari realtime belum punya nama staff — ambil sekali lalu simpan. */
  const hydrateRow = useCallback(
    async (staffId: string) => {
      const { data } = await supabase
        .from('staff_live_locations')
        .select(LIVE_SELECT)
        .eq('outlet_staff_id', staffId)
        .maybeSingle()
      if (!data) return
      const mapped = mapJoinedRow(data as unknown as LiveLocationJoinedRow)
      setStaff((current) => {
        const index = current.findIndex((item) => item.outletStaffId === staffId)
        if (index === -1) return [...current, mapped]
        const next = [...current]
        next[index] = mapped
        return next
      })
    },
    [supabase],
  )

  useEffect(() => {
    void loadInitial()
    const channel = supabase
      .channel(`staff-live-locations-${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'staff_live_locations' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const gone = payload.old as Partial<LiveLocationRow>
            if (!gone?.outlet_staff_id) return
            setStaff((current) => current.filter((item) => item.outletStaffId !== gone.outlet_staff_id))
            return
          }
          const row = payload.new as LiveLocationRow
          if (!row?.outlet_staff_id) return
          const known = staffRef.current.find((item) => item.outletStaffId === row.outlet_staff_id)
          if (!known) {
            void hydrateRow(row.outlet_staff_id)
            return
          }
          const merged = mapRow(row, known)
          setStaff((current) =>
            current.map((item) => (item.outletStaffId === merged.outletStaffId ? merged : item)),
          )
          setNow(Date.now())
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [hydrateRow, loadInitial, supabase])

  // Jejak staff terpilih (4 jam terakhir).
  useEffect(() => {
    if (!showTrail || !selectedId) {
      setTrail([])
      return
    }
    let cancelled = false
    const since = new Date(Date.now() - TRAIL_WINDOW_HOURS * 3600_000).toISOString()
    void (async () => {
      const { data, error: trailError } = await supabase
        .from('staff_location_trails')
        .select('lat, lng, recorded_at, accuracy_m, is_mock')
        .eq('outlet_staff_id', selectedId)
        .gte('recorded_at', since)
        .order('recorded_at', { ascending: true })
        .limit(2000)
      if (cancelled) return
      if (trailError) {
        console.error('staff_location_trails', trailError)
        setTrail([])
        return
      }
      const rows = (data ?? []) as unknown as TrailRow[]
      setTrail(
        rows.map((row) => ({
          lat: Number(row.lat),
          lng: Number(row.lng),
          recordedAt: row.recorded_at,
          accuracyM: row.accuracy_m === null ? null : Number(row.accuracy_m),
          isMock: Boolean(row.is_mock),
        })),
      )
    })()
    return () => {
      cancelled = true
    }
  }, [selectedId, showTrail, supabase])

  // Jejak mentah tidak pernah digambar langsung: satu fix Wi-Fi yang meleset 170 m sudah
  // cukup membuat garis melesat keluar jalan dan kembali lagi.
  const cleaned: TrailFilterResult = useMemo(() => cleanTrail(trail), [trail])

  const outlets = useMemo(() => {
    const seen = new Map<string, string>()
    for (const item of staff) {
      if (item.outletId && item.outletName) seen.set(item.outletId, item.outletName)
    }
    return [...seen.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'id'))
  }, [staff])

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return staff
      .filter((item) => outletFilter === 'all' || item.outletId === outletFilter)
      .filter((item) => {
        if (!keyword) return true
        return (
          item.staffName.toLowerCase().includes(keyword) ||
          (item.outletName ?? '').toLowerCase().includes(keyword)
        )
      })
      .sort((a, b) => a.staffName.localeCompare(b.staffName, 'id'))
  }, [outletFilter, query, staff])

  const onlineCount = useMemo(
    () => staff.filter((item) => statusOf(item, now) !== 'offline').length,
    [now, staff],
  )
  const mockCount = useMemo(
    () => staff.filter((item) => item.isMock && statusOf(item, now) !== 'offline').length,
    [now, staff],
  )

  const selected = staff.find((item) => item.outletStaffId === selectedId) ?? null

  function focusStaff(staffId: string) {
    setSelectedId(staffId)
    setFocusNonce((value) => value + 1)
  }

  return (
    <main className="monitor-grid min-h-screen px-4 py-6 sm:px-8 sm:py-9 lg:px-12">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-6 flex flex-col gap-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors duration-200 hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-300"
              aria-label="Kembali ke dashboard"
            >
              <ArrowLeft size={18} />
            </Link>
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-orange-50 text-orange-600">
              <MapPin size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">
                <Radio size={12} /> Suka Operations
              </div>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                Peta staff lapangan
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Posisi live dari aplikasi absensi. Update otomatis tanpa refresh.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {mockCount > 0 && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5">
                <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-rose-500">
                  <ShieldAlert size={11} /> Lokasi palsu
                </p>
                <p className="mt-0.5 text-xl font-extrabold text-rose-700">{mockCount}</p>
              </div>
            )}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Staff online</p>
              <p className="mt-0.5 text-xl font-extrabold text-slate-900">
                {onlineCount}
                <span className="ml-1 text-xs font-semibold text-slate-400">/ {staff.length}</span>
              </p>
            </div>
          </div>
        </header>

        {error && (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-5 lg:h-[calc(100vh-15rem)] lg:min-h-[540px] lg:flex-row">
          {/* Peta: di atas pada layar kecil, kanan pada desktop. */}
          <section className="order-1 h-[52vh] min-h-[320px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:order-2 lg:h-full lg:flex-1">
            <div className="relative h-full w-full">
              <div className="absolute inset-0 z-0">
                <LiveLocationMap
                  staff={filtered}
                  now={now}
                  focusedId={selectedId}
                  focusNonce={focusNonce}
                  fitNonce={fitNonce}
                  trail={cleaned.points}
                  showTrail={showTrail}
                  onSelect={setSelectedId}
                />
              </div>
              <div className="pointer-events-none absolute right-3 top-3 z-[500] flex flex-col items-end gap-2">
                <button
                  type="button"
                  onClick={() => setFitNonce((value) => value + 1)}
                  className="pointer-events-auto flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition-colors duration-200 hover:bg-orange-50 hover:text-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-300"
                >
                  <Crosshair size={14} /> Fit semua
                </button>
                <button
                  type="button"
                  onClick={() => setShowTrail((value) => !value)}
                  disabled={!selectedId}
                  className={`pointer-events-auto flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold shadow-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-orange-300 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-white disabled:text-slate-300 ${
                    showTrail
                      ? 'border-orange-200 bg-orange-600 text-white hover:bg-orange-700'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-orange-50 hover:text-orange-600'
                  }`}
                >
                  <Route size={14} /> Tampilkan jejak
                </button>
                {showTrail && selected && (
                  <span className="pointer-events-none rounded-lg bg-slate-900/85 px-2.5 py-1 text-[10px] font-semibold text-white">
                    {cleaned.points.length > 1
                      ? `${cleaned.points.length} titik · ${TRAIL_WINDOW_HOURS} jam terakhir` +
                        (droppedTotal(cleaned.dropped) > 0 ? ` · ${droppedTotal(cleaned.dropped)} disaring` : '')
                      : trail.length > 0
                        ? `Staff tidak berpindah · ${trail.length} titik di satu tempat`
                        : `Belum ada jejak ${TRAIL_WINDOW_HOURS} jam terakhir`}
                  </span>
                )}
              </div>
            </div>
          </section>

          {/* Daftar staff: di bawah pada layar kecil, sidebar kiri pada desktop. */}
          <aside className="order-2 flex min-h-0 flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:order-1 lg:w-[360px] lg:shrink-0">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.18em] text-slate-400">Staff</p>
              <h2 className="mt-1 text-lg font-extrabold text-slate-900">Daftar posisi</h2>
            </div>

            <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-400">
              <Search size={16} />
              <input
                aria-label="Cari staff atau outlet"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full bg-transparent text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400"
                placeholder="Cari nama staff / outlet"
              />
            </label>

            <select
              aria-label="Filter outlet"
              value={outletFilter}
              onChange={(event) => setOutletFilter(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-orange-300"
            >
              <option value="all">Semua outlet ({staff.length})</option>
              {outlets.map((outlet) => (
                <option key={outlet.id} value={outlet.id}>
                  {outlet.name}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR.bergerak }} /> Bergerak
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR.diam }} /> Diam
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR.offline }} /> Offline
              </span>
            </div>

            <div className="-mr-1.5 flex-1 space-y-2 overflow-y-auto pr-1.5 lg:min-h-0">
              {loading &&
                Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="h-[74px] animate-pulse rounded-2xl bg-slate-100" />
                ))}

              {!loading && filtered.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-300 py-14 text-center text-sm font-medium text-slate-500">
                  <Users className="mx-auto mb-3" />
                  Belum ada posisi staff.
                </div>
              )}

              {!loading &&
                filtered.map((item) => {
                  const status = statusOf(item, now)
                  const active = item.outletStaffId === selectedId
                  return (
                    <button
                      key={item.outletStaffId}
                      type="button"
                      onClick={() => focusStaff(item.outletStaffId)}
                      className={`w-full rounded-2xl border p-3.5 text-left transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-orange-300 ${
                        active
                          ? 'border-orange-300 bg-orange-50'
                          : 'border-slate-200 bg-white hover:border-orange-200 hover:bg-orange-50/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-extrabold text-slate-900">{item.staffName}</p>
                          <p className="truncate text-[11px] font-semibold text-slate-500">
                            {roleLabel(item.role)} · {item.outletName ?? 'Tanpa outlet'}
                          </p>
                        </div>
                        <span
                          className="flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-[9px] font-bold tracking-wider text-white"
                          style={{ background: STATUS_COLOR[status] }}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full bg-white ${status === 'bergerak' ? 'status-pulse' : ''}`}
                          />
                          {STATUS_LABEL[status].toUpperCase()}
                        </span>
                      </div>
                      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-500">
                        <span className="flex items-center gap-1">
                          <Gauge size={11} /> {speedKmh(item.speedMps)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Battery size={11} /> {batteryText(item.batteryPct, item.isCharging)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Crosshair size={11} /> {accuracyText(item.accuracyM)}
                        </span>
                        <span className="text-slate-400">{relativeTime(item.recordedAt, now)}</span>
                        {item.isMock && (
                          <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                            Lokasi palsu
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}
