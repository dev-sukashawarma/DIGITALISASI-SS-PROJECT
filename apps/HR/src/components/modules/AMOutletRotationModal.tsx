'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  ArrowLeftRight,
  Building2,
  History,
  Users,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Search,
  X,
  Briefcase,
} from 'lucide-react'
import { Button, Spinner } from '@suka/design-system'
import type { StaffRow, Outlet } from '@/lib/types'
import {
  getAMOutletDataAction,
  rotateAMOutletsAction,
  type AMOutletAssignmentRecord,
  type AMOutletRotationRecord,
} from '@/app/actions/users'
import { KANTOR_PUSAT_ID } from '@/lib/staffFilters'

interface AMOutletRotationModalProps {
  staffList: StaffRow[]
  outlets: Outlet[]
  initialSelectedAmId?: string | null
  onClose: () => void
  onSuccess: (message: string) => void
}

const ROTATION_REASONS = [
  'Pergeseran Wilayah Binaan Bulanan',
  'Penyeimbangan Beban Supervisi Outlet',
  'Pembukaan / Penambahan Cabang Baru',
  'Rotasi Berkala Area Manager',
  'Penutupan / Nonaktif Cabang Sementara',
  'Penugasan Khusus Manajemen',
  'Lainnya',
]

function cleanOutletName(name: string) {
  return name.replace('SUKA SHAWARMA ', '').replace('MITRA SUKA ', 'MITRA ')
}

export function AMOutletRotationModal({
  staffList,
  outlets,
  initialSelectedAmId,
  onClose,
  onSuccess,
}: AMOutletRotationModalProps) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })

  const [tab, setTab] = useState<'formasi' | 'rotasi' | 'riwayat'>(
    initialSelectedAmId ? 'rotasi' : 'formasi'
  )
  const [loading, setLoading] = useState<boolean>(true)
  const [submitting, setSubmitting] = useState<boolean>(false)

  const [activeAssignments, setActiveAssignments] = useState<AMOutletAssignmentRecord[]>([])
  const [historyAssignments, setHistoryAssignments] = useState<AMOutletAssignmentRecord[]>([])
  const [rotations, setRotations] = useState<AMOutletRotationRecord[]>([])

  // Form states for rotation
  const [selectedOutletIds, setSelectedOutletIds] = useState<string[]>([])
  const [targetAmId, setTargetAmId] = useState<string>(initialSelectedAmId || '')
  const [effectiveDate, setEffectiveDate] = useState<string>(today)
  const [selectedReason, setSelectedReason] = useState<string>(ROTATION_REASONS[0])
  const [customReason, setCustomReason] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  const [outletSearch, setOutletSearch] = useState<string>('')
  const [filterAmSource, setFilterAmSource] = useState<string>('all')

  // Daftar Area Manager aktif
  const activeAMs = useMemo(
    () =>
      staffList
        .filter((s) => s.role === 'area_manager' && s.status === 'active')
        .sort((a, b) => a.name.localeCompare(b.name, 'id')),
    [staffList]
  )

  // Daftar Outlet Operasional (bukan Kantor Pusat, Gudang, Backup, atau Testing)
  const operationalOutlets = useMemo(
    () =>
      outlets
        .filter((o) => {
          if (o.id === KANTOR_PUSAT_ID || o.id === '00000000-0000-0000-0000-000000000000') return false
          const upper = o.name.toUpperCase()
          if (
            upper.includes('KANTOR PUSAT') ||
            upper.includes('GUDANG') ||
            upper === 'SS BACKUP' ||
            upper.includes('TES') ||
            upper === 'SHOPEE' ||
            upper === 'TIKTOK SHOP'
          ) {
            return false
          }
          return true
        })
        .sort((a, b) => a.name.localeCompare(b.name, 'id')),
    [outlets]
  )

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await getAMOutletDataAction()
      if (res.ok) {
        setActiveAssignments(res.activeAssignments || [])
        setHistoryAssignments(res.historyAssignments || [])
        setRotations(res.rotations || [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Peta outlet_id -> assignment aktif saat ini
  const currentHolderByOutlet = useMemo(() => {
    const map = new Map<string, AMOutletAssignmentRecord>()
    activeAssignments.forEach((a) => {
      map.set(a.outlet_id, a)
    })
    return map
  }, [activeAssignments])

  // Peta AM -> daftar outlet aktif yang dipegang
  const outletsByAm = useMemo(() => {
    const map = new Map<string, AMOutletAssignmentRecord[]>()
    activeAMs.forEach((am) => map.set(am.id, []))
    activeAssignments.forEach((a) => {
      if (!a.outlet || a.outlet.is_active === false) return
      const list = map.get(a.staff_id) || []
      list.push(a)
      map.set(a.staff_id, list)
    })
    return map
  }, [activeAMs, activeAssignments])

  // Outlet aktif yang belum punya AM
  const unassignedOutlets = useMemo(
    () =>
      operationalOutlets.filter(
        (o) => o.is_active !== false && !currentHolderByOutlet.has(o.id)
      ),
    [operationalOutlets, currentHolderByOutlet]
  )

  // Filter daftar outlet di tab Rotasi
  const filteredOutletsForRotation = useMemo(() => {
    const q = outletSearch.trim().toLowerCase()
    return operationalOutlets.filter((o) => {
      if (o.is_active === false && !currentHolderByOutlet.has(o.id)) return false
      const holder = currentHolderByOutlet.get(o.id)
      if (filterAmSource === 'unassigned' && holder) return false
      if (
        filterAmSource !== 'all' &&
        filterAmSource !== 'unassigned' &&
        holder?.staff_id !== filterAmSource
      ) {
        return false
      }
      if (q) {
        const amName = holder?.staff?.name?.toLowerCase() || ''
        if (!o.name.toLowerCase().includes(q) && !amName.includes(q)) return false
      }
      return true
    })
  }, [operationalOutlets, currentHolderByOutlet, filterAmSource, outletSearch])

  const toggleOutletSelection = (outletId: string) => {
    setSelectedOutletIds((prev) =>
      prev.includes(outletId) ? prev.filter((id) => id !== outletId) : [...prev, outletId]
    )
  }

  const finalReason = selectedReason === 'Lainnya' ? customReason.trim() : selectedReason

  const handleSubmitRotation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedOutletIds.length === 0) {
      alert('Pilih minimal 1 outlet yang ingin dipindahkan/dirotasi.')
      return
    }
    if (!targetAmId) {
      alert('Pilih Area Manager tujuan (atau pilih "Lepas dari Binaan AM").')
      return
    }
    if (!effectiveDate) {
      alert('Tanggal efektif pergeseran wajib diisi.')
      return
    }
    if (!finalReason) {
      alert('Alasan pergeseran binaan wajib diisi.')
      return
    }

    setSubmitting(true)
    try {
      const toStaffId = targetAmId === '__UNASSIGN__' ? null : targetAmId
      const res = await rotateAMOutletsAction({
        outletIds: selectedOutletIds,
        toStaffId,
        effectiveDate,
        reason: finalReason,
        notes: notes.trim() || undefined,
      })

      if (!res.ok) {
        throw new Error(res.error || res.message || 'Gagal menyimpan rotasi outlet binaan')
      }

      onSuccess(res.message)
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan saat memproses rotasi')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-4xl rounded-3xl bg-white p-6 shadow-2xl border border-suka-gray-200 animate-in zoom-in-95 my-6 max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-suka-gray-100 pb-4 shrink-0">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200">
              <Briefcase size={22} />
            </div>
            <div>
              <h3 className="font-extrabold text-suka-brown text-lg">
                Manajemen &amp; Rotasi Outlet Binaan Area Manager (AM)
              </h3>
              <p className="text-xs text-suka-gray-500 mt-0.5">
                Atur perpindahan cabang binaan antar AM secara eksklusif (1 AM per outlet) dengan tanggal efektif &amp; perhitungan bonus prorata tanggal.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-suka-gray-400 hover:bg-suka-gray-100 hover:text-suka-ink transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-suka-gray-100 py-3 shrink-0">
          <button
            type="button"
            onClick={() => setTab('formasi')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              tab === 'formasi'
                ? 'bg-suka-brown text-white shadow-sm'
                : 'bg-stone-100 text-suka-brown hover:bg-suka-cream'
            }`}
          >
            <Users size={15} className={tab === 'formasi' ? 'text-suka-orange' : 'text-stone-500'} />
            <span>Formasi Binaan Aktif ({activeAMs.length} AM)</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('rotasi')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              tab === 'rotasi'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100 border border-indigo-200'
            }`}
          >
            <ArrowLeftRight size={15} />
            <span>Pindahkan / Rotasi Outlet Binaan</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('riwayat')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              tab === 'riwayat'
                ? 'bg-suka-brown text-white shadow-sm'
                : 'bg-stone-100 text-suka-brown hover:bg-suka-cream'
            }`}
          >
            <History size={15} className={tab === 'riwayat' ? 'text-suka-orange' : 'text-stone-500'} />
            <span>Riwayat Pergeseran &amp; Periode ({rotations.length})</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto py-4 pr-1 space-y-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Spinner />
              <span className="text-xs font-bold text-suka-gray-500">
                Memuat pemetaan outlet binaan Area Manager...
              </span>
            </div>
          ) : tab === 'formasi' ? (
            /* ── TAB 1: FORMASI BINAAN AKTIF ── */
            <div className="space-y-4">
              <div className="rounded-2xl bg-amber-50/70 border border-amber-200 p-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-amber-900 space-y-0.5">
                  <div className="font-extrabold flex items-center gap-1.5">
                    <CheckCircle2 size={15} className="text-amber-700 shrink-0" />
                    <span>Sistem Penguncian Periode &amp; Prorata Tanggal Aktif</span>
                  </div>
                  <p className="text-[11px] text-amber-800/90">
                    Setiap pergeseran outlet binaan tercatat dengan rentang tanggal efektif (<code>effective_from</code> s/d <code>effective_to</code>), sehingga histori bonus bulan-bulan sebelumnya tetap terkunci aman dan perpindahan tengah bulan otomatis dihitung prorata sesuai tanggal transaksi.
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => setTab('rotasi')}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl gap-1.5 shrink-0"
                >
                  <ArrowLeftRight size={14} />
                  <span>Rotasi Outlet Sekarang</span>
                </Button>
              </div>

              {/* Grid Kartu per AM */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeAMs.map((am) => {
                  const amAssigns = outletsByAm.get(am.id) || []
                  return (
                    <div
                      key={am.id}
                      className="rounded-2xl border border-suka-gray-200 bg-[#FDF9F3]/60 p-4 flex flex-col justify-between gap-3 shadow-2xs"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between border-b border-suka-gray-200/80 pb-2.5">
                          <div>
                            <h4 className="font-extrabold text-sm text-suka-brown">{am.name}</h4>
                            <span className="text-[11px] text-suka-gray-500 font-medium">
                              Area Manager • Kantor Pusat
                            </span>
                          </div>
                          <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                            {amAssigns.length} Outlet
                          </span>
                        </div>

                        {amAssigns.length === 0 ? (
                          <p className="text-xs text-stone-400 italic py-2">
                            Belum ada cabang binaan aktif.
                          </p>
                        ) : (
                          <div className="space-y-1.5">
                            {amAssigns.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-center justify-between gap-2 bg-white px-3 py-2 rounded-xl border border-stone-200 text-xs"
                              >
                                <div className="flex items-center gap-2 font-bold text-stone-800 truncate">
                                  <Building2 size={13} className="text-amber-600 shrink-0" />
                                  <span className="truncate">
                                    {cleanOutletName(item.outlet?.name || 'Outlet')}
                                  </span>
                                </div>
                                <span
                                  className="text-[10px] font-mono text-stone-500 bg-stone-100 px-2 py-0.5 rounded-md shrink-0"
                                  title={`Mulai dibina sejak ${item.effective_from}`}
                                >
                                  sejak {item.effective_from}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t border-suka-gray-200/60 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setFilterAmSource(am.id)
                            setSelectedOutletIds([])
                            setTargetAmId('')
                            setTab('rotasi')
                          }}
                          className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-200 transition-colors cursor-pointer"
                        >
                          Pindahkan Outlet dari {am.name.split(' ')[0]} &rarr;
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Unassigned Outlets Warning if any */}
              {unassignedOutlets.length > 0 && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-extrabold text-rose-900">
                      <AlertCircle size={15} className="text-rose-600" />
                      <span>
                        Outlet Aktif Belum Memiliki Area Manager ({unassignedOutlets.length} Cabang)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFilterAmSource('unassigned')
                        setSelectedOutletIds(unassignedOutlets.map((o) => o.id))
                        setTab('rotasi')
                      }}
                      className="text-xs font-bold text-rose-800 bg-white px-3 py-1 rounded-lg border border-rose-300 hover:bg-rose-100 cursor-pointer"
                    >
                      Tugaskan ke AM Sekarang &rarr;
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {unassignedOutlets.map((o) => (
                      <span
                        key={o.id}
                        className="px-2.5 py-1 rounded-lg bg-white border border-rose-200 text-xs font-bold text-rose-900"
                      >
                        {o.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : tab === 'rotasi' ? (
            /* ── TAB 2: FORM ROTASI / PERGESERAN OUTLET BINAAN ── */
            <form onSubmit={handleSubmitRotation} className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Kolom Kiri: Pilih Outlet yang Akan Dipindahkan */}
                <div className="lg:col-span-7 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-extrabold text-suka-brown uppercase tracking-wider">
                      1. Pilih Outlet yang Akan Dirotasi ({selectedOutletIds.length} dipilih)
                    </label>
                    {selectedOutletIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedOutletIds([])}
                        className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                      >
                        Reset Pilihan
                      </button>
                    )}
                  </div>

                  {/* Filter bar outlet */}
                  <div className="flex flex-wrap gap-2">
                    <div className="relative flex-1 min-w-[160px]">
                      <Search
                        size={14}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
                      />
                      <input
                        type="text"
                        value={outletSearch}
                        onChange={(e) => setOutletSearch(e.target.value)}
                        placeholder="Cari nama outlet / AM..."
                        className="w-full pl-8 pr-3 py-2 rounded-xl border border-suka-gray-200 text-xs font-semibold outline-none focus:border-suka-orange"
                      />
                    </div>
                    <select
                      value={filterAmSource}
                      onChange={(e) => setFilterAmSource(e.target.value)}
                      className="rounded-xl border border-suka-gray-200 px-3 py-2 text-xs font-bold text-suka-brown bg-white outline-none focus:border-suka-orange"
                    >
                      <option value="all">Semua AM Asal</option>
                      {activeAMs.map((am) => (
                        <option key={am.id} value={am.id}>
                          Binaan: {am.name}
                        </option>
                      ))}
                      <option value="unassigned">Belum Ada AM</option>
                    </select>
                  </div>

                  {/* Daftar Outlet Checkbox */}
                  <div className="rounded-2xl border border-suka-gray-200 bg-stone-50/60 p-2.5 max-h-[340px] overflow-y-auto space-y-1.5">
                    {filteredOutletsForRotation.map((o) => {
                      const holder = currentHolderByOutlet.get(o.id)
                      const checked = selectedOutletIds.includes(o.id)
                      const isSameAsTarget = Boolean(targetAmId && holder?.staff_id === targetAmId)

                      return (
                        <label
                          key={o.id}
                          className={`flex items-center justify-between gap-3 p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                            checked
                              ? 'bg-indigo-50/90 border-indigo-400 shadow-2xs'
                              : 'bg-white border-stone-200 hover:border-suka-orange/50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleOutletSelection(o.id)}
                              className="w-4 h-4 rounded accent-indigo-600 cursor-pointer shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="font-extrabold text-xs text-suka-ink truncate flex items-center gap-1.5">
                                <span>{cleanOutletName(o.name)}</span>
                                {o.is_active === false && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-stone-200 text-stone-600 font-bold">
                                    Nonaktif
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-stone-500">
                                {holder ? (
                                  <span>
                                    AM Saat Ini:{' '}
                                    <strong className="text-suka-brown">
                                      {holder.staff?.name || 'AM'}
                                    </strong>{' '}
                                    (sejak {holder.effective_from})
                                  </span>
                                ) : (
                                  <span className="text-rose-600 font-semibold">
                                    Belum ada Area Manager
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {checked && isSameAsTarget ? (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full shrink-0">
                              Sudah di AM ini
                            </span>
                          ) : holder ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 border border-stone-200 shrink-0">
                              {holder.staff?.name?.split(' ')[0]}
                            </span>
                          ) : null}
                        </label>
                      )
                    })}
                    {filteredOutletsForRotation.length === 0 && (
                      <div className="text-center py-8 text-xs text-stone-400 italic">
                        Tidak ada outlet yang cocok dengan filter.
                      </div>
                    )}
                  </div>
                </div>

                {/* Kolom Kanan: Parameter Pergeseran */}
                <div className="lg:col-span-5 space-y-4 bg-[#FDF9F3] p-4 rounded-2xl border border-suka-brown/10">
                  <div className="text-xs font-extrabold text-suka-brown uppercase tracking-wider border-b border-suka-brown/10 pb-2">
                    2. Tujuan &amp; Tanggal Efektif Pergeseran
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-suka-brown mb-1.5">
                      Alihkan ke Area Manager Tujuan *
                    </label>
                    <select
                      value={targetAmId}
                      onChange={(e) => setTargetAmId(e.target.value)}
                      required
                      className="w-full rounded-xl border border-suka-gray-200 px-3 py-2.5 text-xs font-bold text-suka-ink bg-white outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange"
                    >
                      <option value="">— Pilih Area Manager Tujuan —</option>
                      {activeAMs.map((am) => (
                        <option key={am.id} value={am.id}>
                          {am.name} (Saat ini {(outletsByAm.get(am.id) || []).length} outlet)
                        </option>
                      ))}
                      <option value="__UNASSIGN__">
                        ❌ Lepas dari Binaan AM (Tanpa AM Sementara)
                      </option>
                    </select>
                    <span className="text-[10px] text-stone-500 mt-1 block">
                      Otomatis melepas outlet dari AM lama (eksklusif 1 AM per outlet).
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-suka-brown mb-1.5">
                      Tanggal Efektif Mulai Berlaku *
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        value={effectiveDate}
                        onChange={(e) => setEffectiveDate(e.target.value)}
                        required
                        className="w-full rounded-xl border border-suka-gray-200 px-3 py-2.5 text-xs font-bold text-suka-ink bg-white outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange"
                      />
                    </div>
                    <div className="mt-1.5 p-2.5 rounded-xl bg-indigo-50/80 border border-indigo-200 text-[11px] text-indigo-900 space-y-1">
                      <div className="font-bold flex items-center gap-1">
                        <Calendar size={12} className="text-indigo-700 shrink-0" />
                        <span>Cara Hitung Bonus Prorata Tanggal:</span>
                      </div>
                      <p className="text-[10px] leading-relaxed text-indigo-800">
                        • Penjualan s/d <strong>H-1 ({effectiveDate ? (() => {
                          const d = new Date(`${effectiveDate}T00:00:00Z`)
                          d.setUTCDate(d.getUTCDate() - 1)
                          return d.toISOString().slice(0, 10)
                        })() : '-'})</strong> tetap menjadi hak <strong>AM Lama</strong>.<br />
                        • Penjualan mulai <strong>{effectiveDate || '-'}</strong> dst. masuk ke <strong>AM Tujuan Baru</strong>.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-suka-brown mb-1.5">
                      Alasan Pergeseran Binaan *
                    </label>
                    <select
                      value={selectedReason}
                      onChange={(e) => setSelectedReason(e.target.value)}
                      className="w-full rounded-xl border border-suka-gray-200 px-3 py-2.5 text-xs font-semibold text-suka-ink bg-white outline-none focus:border-suka-orange"
                    >
                      {ROTATION_REASONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedReason === 'Lainnya' && (
                    <div>
                      <label className="block text-xs font-bold text-suka-brown mb-1.5">
                        Tuliskan Alasan *
                      </label>
                      <input
                        type="text"
                        value={customReason}
                        onChange={(e) => setCustomReason(e.target.value)}
                        placeholder="Masukkan alasan rotasi..."
                        required
                        className="w-full rounded-xl border border-suka-gray-200 px-3 py-2 text-xs bg-white outline-none focus:border-suka-orange"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-suka-brown mb-1.5">
                      Catatan Tambahan HR (Opsional)
                    </label>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Contoh: Sesuai keputusan rapat evaluasi operasional awal bulan."
                      className="w-full rounded-xl border border-suka-gray-200 px-3 py-2 text-xs bg-white outline-none focus:border-suka-orange"
                    />
                  </div>

                  <div className="pt-2">
                    <Button
                      type="submit"
                      disabled={submitting || selectedOutletIds.length === 0 || !targetAmId}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-sm"
                    >
                      <ArrowLeftRight size={15} />
                      <span>
                        {submitting
                          ? 'Memproses Pergeseran...'
                          : `Konfirmasi Rotasi (${selectedOutletIds.length} Outlet)`}
                      </span>
                    </Button>
                  </div>
                </div>
              </div>
            </form>
          ) : (
            /* ── TAB 3: RIWAYAT PERGESERAN & PERIODE PENUGASAN ── */
            <div className="space-y-5">
              {/* Tabel Log Perpindahan */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-extrabold text-suka-brown uppercase tracking-wider flex items-center gap-1.5">
                  <History size={14} className="text-suka-orange" />
                  <span>Log Perpindahan Outlet Binaan AM</span>
                </h4>

                {rotations.length === 0 ? (
                  <div className="rounded-2xl border border-stone-200 bg-stone-50 p-6 text-center text-xs text-stone-400">
                    Belum ada riwayat pergeseran outlet binaan.
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-suka-gray-200 bg-white">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-suka-gray-50 border-b border-suka-gray-200 text-[11px] font-bold uppercase text-suka-gray-500">
                          <tr>
                            <th className="px-4 py-3">Tgl Efektif</th>
                            <th className="px-4 py-3">Cabang Outlet</th>
                            <th className="px-4 py-3">AM Sebelumnya</th>
                            <th className="px-4 py-3">AM Tujuan Baru</th>
                            <th className="px-4 py-3">Alasan &amp; Catatan</th>
                            <th className="px-4 py-3">Diubah Oleh</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-suka-gray-100">
                          {rotations.map((r) => (
                            <tr key={r.id} className="hover:bg-amber-50/30">
                              <td className="px-4 py-2.5 font-mono font-bold text-indigo-700 whitespace-nowrap">
                                {r.effective_date}
                              </td>
                              <td className="px-4 py-2.5 font-bold text-suka-brown">
                                {cleanOutletName(r.outlet?.name || '-')}
                              </td>
                              <td className="px-4 py-2.5 text-stone-600">
                                {r.from_staff?.name || (
                                  <span className="italic text-stone-400">Belum Ada</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 font-bold text-emerald-800">
                                {r.to_staff?.name || (
                                  <span className="italic text-rose-600">Dilepas</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-stone-700">
                                <div className="font-semibold">{r.reason}</div>
                                {r.notes && (
                                  <div className="text-[11px] text-stone-500 italic">{r.notes}</div>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-stone-500 whitespace-nowrap">
                                {r.actor_name || 'HR Admin'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Tabel Rentang Periode Historis (am_outlet_assignments) */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-extrabold text-suka-brown uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar size={14} className="text-suka-orange" />
                  <span>Daftar Rentang Periode Kepemilikan Outlet (Acuan Hitung Bonus)</span>
                </h4>

                <div className="overflow-hidden rounded-2xl border border-suka-gray-200 bg-white">
                  <div className="overflow-x-auto max-h-72">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-suka-gray-50 border-b border-suka-gray-200 text-[11px] font-bold uppercase text-suka-gray-500 sticky top-0">
                        <tr>
                          <th className="px-4 py-2.5">Area Manager</th>
                          <th className="px-4 py-2.5">Cabang Outlet</th>
                          <th className="px-4 py-2.5">Mulai Tanggal</th>
                          <th className="px-4 py-2.5">Sampai Tanggal</th>
                          <th className="px-4 py-2.5">Status Periode</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-suka-gray-100">
                        {historyAssignments.map((a) => (
                          <tr key={a.id} className="hover:bg-stone-50">
                            <td className="px-4 py-2 font-bold text-suka-brown">
                              {a.staff?.name || '-'}
                            </td>
                            <td className="px-4 py-2 font-semibold text-stone-800">
                              {cleanOutletName(a.outlet?.name || '-')}
                            </td>
                            <td className="px-4 py-2 font-mono text-stone-600">
                              {a.effective_from}
                            </td>
                            <td className="px-4 py-2 font-mono text-stone-600">
                              {a.effective_to || 'Sekarang'}
                            </td>
                            <td className="px-4 py-2">
                              {a.effective_to === null ? (
                                <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Aktif Berjalan
                                </span>
                              ) : (
                                <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-600 border border-stone-200">
                                  Historis Terkunci
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end items-center border-t border-suka-gray-100 pt-3 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="text-xs font-bold rounded-xl"
          >
            Tutup
          </Button>
        </div>
      </div>
    </div>
  )
}
