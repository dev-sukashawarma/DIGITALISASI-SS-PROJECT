'use client'

import { useState, useMemo } from 'react'
import { X, AlertCircle, ArrowRight, ShieldCheck, Check, Sparkles, Building2, User, Calendar } from 'lucide-react'
import { Button, Spinner } from '@suka/design-system'
import { useEligibleRegularCrews, useEmergencyOutlets, useEmergencyMutations } from '@/hooks/useEmergencyBackup'
import { toast } from 'sonner'

interface EmergencyAssignmentModalProps {
  isOpen: boolean
  onClose: () => void
  defaultDate?: string
}

const QUICK_REASONS = [
  'Kru Utama Sakit / Izin Mendadak',
  'Kekurangan Personil Shift',
  'Lonjakan Pesanan / Event',
  'Tukar Shift Lapangan',
  'Bantuan Operasional Khusus',
]

export function EmergencyAssignmentModal({ isOpen, onClose, defaultDate }: EmergencyAssignmentModalProps) {
  const todayWib = useMemo(
    () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date()),
    []
  )

  const [staffId, setStaffId] = useState('')
  const [targetOutletId, setTargetOutletId] = useState('')
  const [assignmentDate, setAssignmentDate] = useState(defaultDate || todayWib)
  const [reason, setReason] = useState('')
  const [staffSearch, setStaffSearch] = useState('')

  const { data: crews = [], isLoading: isLoadingCrews } = useEligibleRegularCrews(staffSearch)
  const { data: outlets = [], isLoading: isLoadingOutlets } = useEmergencyOutlets()
  const { create } = useEmergencyMutations()

  // Selected crew object
  const selectedCrew = useMemo(() => crews.find((c) => c.id === staffId), [crews, staffId])

  // Filter available target outlets (cannot choose the crew's home outlet)
  const availableTargetOutlets = useMemo(() => {
    if (!selectedCrew?.outlet_id) return outlets
    return outlets.filter((o) => o.id !== selectedCrew.outlet_id)
  }, [outlets, selectedCrew])

  const filteredCrews = useMemo(() => {
    if (!staffSearch.trim()) return crews.slice(0, 50)
    const q = staffSearch.toLowerCase()
    return crews.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.nik && c.nik.toLowerCase().includes(q))
    )
  }, [crews, staffSearch])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!staffId) {
      toast.error('Pilih kru reguler terlebih dahulu')
      return
    }

    if (!targetOutletId) {
      toast.error('Pilih outlet tujuan BKO darurat')
      return
    }

    if (!assignmentDate) {
      toast.error('Tentukan tanggal penugasan')
      return
    }

    try {
      await create.mutateAsync({
        staff_id: staffId,
        target_outlet_id: targetOutletId,
        assignment_date: assignmentDate,
        reason: reason.trim() || undefined,
      })

      const targetOutletName = outlets.find((o) => o.id === targetOutletId)?.name || 'outlet tujuan'
      toast.success(
        `Penugasan BKO darurat untuk ${selectedCrew?.name} di ${targetOutletName} berhasil dibuat!`
      )
      onClose()
      // Reset form
      setStaffId('')
      setTargetOutletId('')
      setReason('')
    } catch (err: any) {
      toast.error(err.message || 'Gagal membuat penugasan darurat')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-suka-gray-100 overflow-hidden my-8 animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-suka-gray-100 bg-[#FAF7F2]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-suka-orange/10 flex items-center justify-center text-suka-orange">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#4A1713] tracking-tight">
                Buat Penugasan Darurat (BKO)
              </h3>
              <p className="text-xs text-suka-gray-500 font-medium">
                Perbantukan kru reguler ke cabang lain selama 1 hari
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-suka-gray-400 hover:text-suka-gray-600 hover:bg-suka-gray-200/50 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Info Banner */}
          <div className="rounded-xl bg-amber-50/80 border border-amber-200/60 p-3.5 flex items-start gap-2.5 text-xs text-amber-900 leading-relaxed">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <b>Ketentuan BKO Darurat:</b> Akses Kiosk Absensi, POS Kasir, dan Ceklist Harian di outlet tujuan akan aktif otomatis dan berakhir pada pukul 23:59 WIB. Home outlet di Database Karyawan tetap tidak berubah.
            </div>
          </div>

          {/* 1. Pilih Kru Reguler */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[#4A1713] uppercase tracking-wider flex items-center gap-1.5">
              <User size={13} className="text-suka-orange" />
              1. Pilih Kru Reguler
            </label>
            <div className="space-y-2">
              <input
                type="text"
                value={staffSearch}
                onChange={(e) => setStaffSearch(e.target.value)}
                placeholder="Ketik untuk mencari nama kru / NIK..."
                className="w-full text-xs rounded-xl border border-suka-gray-200 px-3 py-2 outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange bg-white text-suka-ink"
              />

              <div className="max-h-40 overflow-y-auto rounded-xl border border-suka-gray-200 divide-y divide-suka-gray-100 bg-white">
                {isLoadingCrews ? (
                  <div className="p-4 text-center text-xs text-suka-gray-400 flex items-center justify-center gap-2">
                    <Spinner size="sm" /> Memuat daftar kru...
                  </div>
                ) : filteredCrews.length === 0 ? (
                  <div className="p-4 text-center text-xs text-suka-gray-400">
                    Tidak ada kru reguler yang cocok.
                  </div>
                ) : (
                  filteredCrews.map((c) => {
                    const isSelected = c.id === staffId
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setStaffId(c.id)
                          // Clear target outlet if it matches new selected crew's home outlet
                          if (targetOutletId === c.outlet_id) {
                            setTargetOutletId('')
                          }
                        }}
                        className={`w-full text-left px-3 py-2 flex items-center justify-between text-xs transition-colors ${
                          isSelected
                            ? 'bg-suka-orange/10 font-bold text-suka-orange'
                            : 'hover:bg-suka-gray-50 text-suka-ink'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="font-semibold truncate">{c.name}</div>
                          <div className="text-[11px] text-suka-gray-500 flex items-center gap-1.5 mt-0.5">
                            <span className="bg-suka-gray-100 text-suka-gray-600 px-1.5 py-0.2 rounded font-medium">
                              Home: {c.outlet_name}
                            </span>
                            {c.nik && <span>NIK: {c.nik}</span>}
                          </div>
                        </div>
                        {isSelected && <Check size={16} className="text-suka-orange shrink-0" />}
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          {/* Selected Preview Box */}
          {selectedCrew && (
            <div className="rounded-xl bg-[#FAF7F2] border border-suka-orange/20 p-3 flex items-center justify-between text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-suka-gray-400 block">Kru Terpilih</span>
                <span className="font-extrabold text-[#4A1713]">{selectedCrew.name}</span>
                <span className="text-suka-gray-500 block text-[11px]">Home Outlet: {selectedCrew.outlet_name}</span>
              </div>
              <ArrowRight size={18} className="text-suka-orange shrink-0 mx-2" />
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-suka-gray-400 block">Tujuan BKO</span>
                <span className="font-extrabold text-suka-orange">
                  {outlets.find((o) => o.id === targetOutletId)?.name || 'Pilih di bawah'}
                </span>
              </div>
            </div>
          )}

          {/* 2. Outlet Tujuan BKO */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[#4A1713] uppercase tracking-wider flex items-center gap-1.5">
              <Building2 size={13} className="text-suka-orange" />
              2. Outlet Tujuan BKO Sementara
            </label>
            <select
              value={targetOutletId}
              onChange={(e) => setTargetOutletId(e.target.value)}
              disabled={!staffId || isLoadingOutlets}
              className="w-full rounded-xl border border-suka-gray-200 px-3 py-2.5 text-xs outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange bg-white text-suka-ink disabled:bg-suka-gray-100 disabled:text-suka-gray-400 transition-all font-medium"
            >
              <option value="">
                {!staffId ? '-- Pilih Kru Terlebih Dahulu --' : '-- Pilih Outlet Cabang Tujuan --'}
              </option>
              {availableTargetOutlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Tanggal Penugasan */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[#4A1713] uppercase tracking-wider flex items-center gap-1.5">
              <Calendar size={13} className="text-suka-orange" />
              3. Tanggal Penugasan (1 Hari)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={assignmentDate}
                onChange={(e) => setAssignmentDate(e.target.value)}
                className="w-full rounded-xl border border-suka-gray-200 px-3 py-2 text-xs outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange bg-white text-suka-ink font-semibold"
              />
              <button
                type="button"
                onClick={() => setAssignmentDate(todayWib)}
                className={`px-3 py-2 rounded-xl text-xs font-bold shrink-0 border transition-all ${
                  assignmentDate === todayWib
                    ? 'bg-suka-orange text-white border-suka-orange shadow-sm'
                    : 'bg-suka-gray-50 text-suka-gray-600 border-suka-gray-200 hover:bg-suka-gray-100'
                }`}
              >
                Hari Ini
              </button>
            </div>
          </div>

          {/* 4. Alasan / Kebutuhan BKO */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-[#4A1713] uppercase tracking-wider">
              4. Alasan / Kebutuhan BKO
            </label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
                    reason === r
                      ? 'bg-suka-orange/10 border-suka-orange text-suka-orange font-bold'
                      : 'bg-white border-suka-gray-200 text-suka-gray-600 hover:border-suka-gray-300'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Catatan tambahan keperluan BKO (opsional)..."
              rows={2}
              className="w-full rounded-xl border border-suka-gray-200 px-3 py-2 text-xs outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange bg-white text-suka-ink resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-suka-gray-100">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={create.isPending}
              className="text-xs"
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={create.isPending || !staffId || !targetOutletId}
              className="bg-suka-orange text-white hover:bg-suka-orange/90 text-xs font-bold gap-2"
            >
              {create.isPending ? (
                <>
                  <Spinner size="sm" /> Menyimpan...
                </>
              ) : (
                <>
                  <ShieldCheck size={15} /> Aktifkan Penugasan BKO
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
