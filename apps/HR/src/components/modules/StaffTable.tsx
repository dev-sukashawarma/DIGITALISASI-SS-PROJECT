'use client'

import { useState, useMemo } from 'react'
import { Avatar, Button } from '@suka/design-system'
import {
  Edit,
  KeyRound,
  Trash2,
  Eye,
  X,
  Wallet,
  User,
  PhoneCall,
  FileText,
  Sparkles,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Clock,
  CheckCircle2,
  AlertCircle,
  Users,
  Building2,
} from 'lucide-react'
import { StatusToggle } from './StatusToggle'
import type { StaffRow, StaffStatus, StaffSortKey, SortOrder, AccountCategory, Outlet } from '@/lib/types'
import { ACCOUNT_CATEGORY_LABELS } from '@/lib/types'
import { formatRupiah } from '@/lib/format'

function statusBadge(status: StaffStatus) {
  const map: Record<StaffStatus, string> = {
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    inactive: 'bg-red-50 text-red-700 border-red-200',
    on_leave: 'bg-amber-50 text-amber-700 border-amber-200',
  }
  const label: Record<StaffStatus, string> = { active: 'Aktif', inactive: 'Nonaktif', on_leave: 'Cuti' }
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-bold ${map[status]}`}>
      {label[status]}
    </span>
  )
}

function flagStatusBadge(s: StaffRow) {
  const stage = s.onboarding_stage || 'regular'

  return (
    <div className="flex flex-col gap-1 items-start">
      {stage === 'training_7_days' && (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-0.5 text-[10px] font-extrabold animate-pulse">
          <Clock size={11} className="text-amber-700 shrink-0" />
          Training (7 Hari)
        </span>
      )}
      {stage === 'ojt' && (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-900 border border-blue-300 px-2.5 py-0.5 text-[10px] font-extrabold">
          <Users size={11} className="text-blue-700 shrink-0" />
          Masa OJT
        </span>
      )}
      {stage === 'graduated' && (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 px-2.5 py-0.5 text-[10px] font-extrabold">
          <CheckCircle2 size={11} className="text-emerald-700 shrink-0" />
          Lulus PKWT
        </span>
      )}
      {stage === 'failed' && (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 text-rose-900 border border-rose-300 px-2.5 py-0.5 text-[10px] font-extrabold">
          <AlertCircle size={11} className="text-rose-700 shrink-0" />
          Gugur
        </span>
      )}
      {stage === 'regular' && (
        <span className="inline-flex items-center rounded-full bg-stone-100 text-stone-700 border border-stone-200 px-2 py-0.5 text-[10px] font-bold">
          Reguler
        </span>
      )}

      {s.role === 'crew' && s.sub_role === 'crew_backup' && (
        <span className="inline-flex items-center gap-1 rounded-md bg-purple-100 text-purple-800 border border-purple-300 px-1.5 py-0.5 text-[9px] font-extrabold">
          Crew Backup
        </span>
      )}
      {s.role === 'crew' && s.sub_role === 'crew_trainee' && (
        <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.5 text-[9px] font-extrabold">
          Trainee
        </span>
      )}
      {s.role === 'crew' && s.sub_role === 'crew_regular' && stage !== 'regular' && (
        <span className="inline-flex items-center text-[9px] font-semibold text-stone-500">
          Crew Reguler
        </span>
      )}
    </div>
  )
}

function categoryBadge(category?: AccountCategory) {
  const cat = category || 'employee'
  if (cat === 'employee') return null

  const map: Record<AccountCategory, { bg: string; label: string }> = {
    employee: { bg: 'bg-stone-100 text-stone-700 border-stone-200', label: 'Karyawan' },
    system_bot: { bg: 'bg-purple-50 text-purple-700 border-purple-200', label: 'Bot / AI' },
    kiosk: { bg: 'bg-cyan-50 text-cyan-700 border-cyan-200', label: 'Kiosk' },
    mitra_owner: { bg: 'bg-indigo-50 text-indigo-700 border-indigo-200', label: 'Mitra Owner' },
    testing: { bg: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Testing' },
  }

  const info = map[cat] || { bg: 'bg-stone-100 text-stone-600 border-stone-200', label: cat }
  return (
    <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${info.bg}`}>
      {info.label}
    </span>
  )
}

export function StaffTable({
  rows,
  outlets = [],
  onEdit,
  onResetPassword,
  onToggleStatus,
  onToggleBonus,
  onDelete,
  sortBy,
  sortOrder,
  onSort,
}: {
  rows: StaffRow[]
  outlets?: Outlet[]
  onEdit: (s: StaffRow) => void
  onResetPassword: (s: StaffRow) => void
  onToggleStatus: (s: StaffRow, next: StaffStatus) => void
  onToggleBonus?: (s: StaffRow) => void
  onDelete: (s: StaffRow) => void
  sortBy?: StaffSortKey
  sortOrder?: SortOrder
  onSort?: (key: StaffSortKey) => void
}) {
  const [selectedStaff, setSelectedStaff] = useState<StaffRow | null>(null)

  const outletMap = useMemo(() => {
    const map = new Map<string, string>()
    outlets?.forEach((o) => map.set(o.id, o.name))
    return map
  }, [outlets])

  const getStaffOutletNames = (s: StaffRow) => {
    const list: string[] = []
    if (s.outlets?.name && s.role !== 'regional_manager' && s.role !== 'area_manager') {
      list.push(s.outlets.name)
    }
    if (s.outlet_ids && s.outlet_ids.length > 0) {
      for (const id of s.outlet_ids) {
        const name = outletMap.get(id)
        if (name && !list.includes(name)) {
          list.push(name)
        }
      }
    }
    return list
  }

  const renderOutletCell = (s: StaffRow) => {
    if (s.role === 'regional_manager') {
      return (
        <div>
          <span className="font-bold text-xs text-suka-ink">KANTOR PUSAT</span>
          <div className="text-[10px] font-semibold text-emerald-700">
            Supervisi Seluruh Outlet
          </div>
        </div>
      )
    }

    if (s.role === 'area_manager') {
      const amOutlets = (s.outlet_ids || [])
        .map((id) => outletMap.get(id))
        .filter((n): n is string => Boolean(n))

      return (
        <div className="space-y-1">
          <span className="font-bold text-xs text-suka-ink block">KANTOR PUSAT</span>
          {amOutlets.length > 0 ? (
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-amber-800 block">
                Binaan ({amOutlets.length} outlet):
              </span>
              <div className="flex flex-col gap-0.5">
                {amOutlets.map((name, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[11px] font-medium text-stone-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                    <span>{name}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <span className="text-[10px] text-suka-gray-500 italic block">Belum ada outlet binaan</span>
          )}
        </div>
      )
    }

    if (s.role === 'crew' && s.sub_role === 'crew_backup') {
      const names = getStaffOutletNames(s)
      return (
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1 text-[10px] font-extrabold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
            <span>Floating ({names.length} outlet)</span>
          </div>
          <div className="flex flex-col gap-0.5">
            {names.map((name, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs font-semibold text-suka-ink">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                <span>{name}</span>
              </div>
            ))}
          </div>
        </div>
      )
    }

    if (s.outlet_ids && s.outlet_ids.length > 1) {
      const names = getStaffOutletNames(s)
      return (
        <div className="space-y-1">
          <div className="flex flex-col gap-0.5">
            {names.map((name, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs font-semibold text-suka-ink">
                <span className="w-1.5 h-1.5 rounded-full bg-suka-orange shrink-0" />
                <span>{name}</span>
              </div>
            ))}
          </div>
        </div>
      )
    }

    return <span>{s.outlets?.name ?? '-'}</span>
  }

  const formatContract = (c?: string | null) => {
    const map: Record<string, string> = {
      permanent: 'Karyawan Tetap',
      contract: 'Karyawan Kontrak (PKWT)',
      intern: 'Magang / Internship',
      daily: 'Harian / Freelance',
    }
    return c ? map[c] || c : '-'
  }

  const renderSortIcon = (columnKey: StaffSortKey) => {
    if (sortBy !== columnKey) {
      return <ArrowUpDown size={13} className="text-stone-400 group-hover:text-suka-orange transition-colors" />
    }
    return sortOrder === 'asc' ? (
      <ArrowUp size={13} className="text-suka-orange font-black" />
    ) : (
      <ArrowDown size={13} className="text-suka-orange font-black" />
    )
  }

  return (
    <div className="relative">
      <div className="overflow-hidden rounded-2xl border border-suka-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-suka-gray-200 bg-[#FDF9F3] text-suka-brown font-bold text-xs uppercase tracking-wider">
              <tr>
                <th
                  onClick={() => onSort?.('name')}
                  className="px-4 py-3.5 cursor-pointer select-none group hover:bg-stone-100/60 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Nama &amp; Username</span>
                    {renderSortIcon('name')}
                  </div>
                </th>
                <th
                  onClick={() => onSort?.('role')}
                  className="px-4 py-3.5 cursor-pointer select-none group hover:bg-stone-100/60 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Role / Jabatan</span>
                    {renderSortIcon('role')}
                  </div>
                </th>
                <th
                  onClick={() => onSort?.('flag_status')}
                  className="px-4 py-3.5 cursor-pointer select-none group hover:bg-stone-100/60 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Flag Status</span>
                    {renderSortIcon('flag_status')}
                  </div>
                </th>
                <th
                  onClick={() => onSort?.('outlet')}
                  className="px-4 py-3.5 cursor-pointer select-none group hover:bg-stone-100/60 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Outlet Penugasan</span>
                    {renderSortIcon('outlet')}
                  </div>
                </th>
                <th
                  onClick={() => onSort?.('salary')}
                  className="px-4 py-3.5 text-right cursor-pointer select-none group hover:bg-stone-100/60 transition-colors hidden sm:table-cell"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Gaji Pokok</span>
                    {renderSortIcon('salary')}
                  </div>
                </th>
                <th
                  onClick={() => onSort?.('status')}
                  className="px-4 py-3.5 cursor-pointer select-none group hover:bg-stone-100/60 transition-colors text-center"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>Status</span>
                    {renderSortIcon('status')}
                  </div>
                </th>
                <th className="px-4 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-suka-gray-100">
              {rows.map((s) => (
                <tr key={s.id} className="hover:bg-amber-50/30 transition-colors">
                  <td className="px-4 py-3 font-semibold text-suka-ink">
                    <div className="flex items-center gap-3">
                      <Avatar name={s.name} size={36} />
                      <div>
                        <button
                          type="button"
                          onClick={() => setSelectedStaff(s)}
                          className="text-left font-bold text-suka-ink hover:text-suka-orange transition-colors cursor-pointer block"
                        >
                          {s.name}
                        </button>
                        <div className="text-xs text-suka-gray-500 font-mono">@{s.username ?? '-'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    <div className="flex flex-col gap-1 items-start">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-xs text-suka-brown uppercase">
                          {s.role.replace('_', ' ')}
                        </span>
                        {categoryBadge(s.account_category)}
                      </div>
                      {onToggleBonus && (
                        <button
                          type="button"
                          onClick={() => onToggleBonus(s)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition-all cursor-pointer border ${
                            s.is_bonus_eligible === false
                              ? 'bg-stone-100 text-stone-600 border-stone-300 hover:bg-stone-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          }`}
                          title={
                            s.is_bonus_eligible === false
                              ? 'Akun Non-Bonus (Klik untuk aktifkan)'
                              : 'Bonus Aktif (Klik untuk jadikan Non-Bonus)'
                          }
                        >
                          <Sparkles
                            size={10}
                            className={s.is_bonus_eligible === false ? 'text-stone-400' : 'text-emerald-600'}
                          />
                          <span>{s.is_bonus_eligible === false ? 'Non-Bonus' : 'Bonus Aktif'}</span>
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {flagStatusBadge(s)}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-suka-ink">
                    {renderOutletCell(s)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-xs text-stone-800 hidden sm:table-cell">
                    {formatRupiah(s.financials?.basic_salary || 0)}
                  </td>
                  <td className="px-4 py-3 text-center">{statusBadge(s.status)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end items-center gap-1">
                      <button
                        onClick={() => setSelectedStaff(s)}
                        className="rounded-lg p-2 text-suka-gray-500 hover:bg-suka-cream hover:text-suka-brown transition-colors cursor-pointer"
                        title="Detail Profil Lengkap"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => onEdit(s)}
                        className="rounded-lg p-2 text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                        title="Edit Profil"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => onResetPassword(s)}
                        className="rounded-lg p-2 text-amber-700 hover:bg-amber-50 transition-colors cursor-pointer"
                        title="Reset Password"
                      >
                        <KeyRound size={16} />
                      </button>
                      <StatusToggle status={s.status} onToggle={(next) => onToggleStatus(s, next)} />
                      <button
                        onClick={() => onDelete(s)}
                        className="rounded-lg p-2 text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        title="Hapus Staf"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-suka-gray-500 font-medium">
                    Tidak ada data karyawan yang cocok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drawer Detail View */}
      {selectedStaff && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setSelectedStaff(null)}
          />

          <div className="relative w-full max-w-lg bg-white shadow-2xl flex flex-col h-full z-10 animate-in slide-in-from-right border-l border-suka-gray-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-suka-brown text-white">
              <div className="flex items-center gap-3">
                <Avatar name={selectedStaff.name} size={40} />
                <div>
                  <h3 className="font-bold text-base leading-tight">{selectedStaff.name}</h3>
                  <div className="text-xs text-suka-cream/80 font-medium">
                    NIP: {selectedStaff.nip || '-'} • @{selectedStaff.username || '-'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedStaff(null)}
                className="rounded-lg p-1.5 hover:bg-white/10 text-white transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Section 1: Pekerjaan */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-suka-brown font-bold text-sm border-b border-suka-gray-100 pb-1.5">
                  <FileText size={16} className="text-suka-orange" />
                  <span>Informasi Pekerjaan</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-suka-gray-500 block">Status Akun</span>
                    <div className="mt-0.5">{statusBadge(selectedStaff.status)}</div>
                  </div>
                  <div>
                    <span className="text-suka-gray-500 block">Flag Status / Tahapan</span>
                    <div className="mt-0.5">{flagStatusBadge(selectedStaff)}</div>
                  </div>
                  <div>
                    <span className="text-suka-gray-500 block">Jabatan / Role</span>
                    <span className="font-bold uppercase text-suka-brown mt-0.5 block">
                      {selectedStaff.role.replace('_', ' ')}
                    </span>
                  </div>
                  <div className={selectedStaff.role === 'crew' && selectedStaff.sub_role === 'crew_backup' ? 'col-span-2' : ''}>
                    <span className="text-suka-gray-500 block">
                      {selectedStaff.role === 'crew' && selectedStaff.sub_role === 'crew_backup'
                        ? 'Outlet Penugasan (Floating)'
                        : selectedStaff.role === 'area_manager'
                        ? 'Outlet Supervisi (Binaan)'
                        : 'Outlet Penugasan'}
                    </span>
                    {selectedStaff.role === 'crew' && selectedStaff.sub_role === 'crew_backup' ? (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {getStaffOutletNames(selectedStaff).map((name, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-900 border border-purple-200 text-xs font-bold"
                          >
                            <Building2 size={12} className="text-purple-600 shrink-0" />
                            {name}
                          </span>
                        ))}
                      </div>
                    ) : selectedStaff.role === 'area_manager' ? (
                      <div className="mt-1 space-y-1">
                        <span className="font-semibold text-suka-ink block">KANTOR PUSAT</span>
                        {(selectedStaff.outlet_ids || []).length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {(selectedStaff.outlet_ids || []).map((id) => (
                              <span
                                key={id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 text-[11px] font-medium"
                              >
                                <Building2 size={10} className="text-amber-600 shrink-0" />
                                {outletMap.get(id) || id}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : selectedStaff.role === 'regional_manager' ? (
                      <div className="mt-0.5">
                        <span className="font-bold text-suka-ink block">KANTOR PUSAT</span>
                        <span className="text-[10px] text-emerald-700 font-semibold block">Supervisi Seluruh Outlet</span>
                      </div>
                    ) : (
                      <span className="font-semibold text-suka-ink mt-0.5 block">
                        {selectedStaff.outlets?.name ?? '-'}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-suka-gray-500 block">Jenis Kontrak</span>
                    <span className="font-medium text-suka-ink mt-0.5 block">
                      {formatContract(selectedStaff.contract_type)}
                    </span>
                  </div>
                  <div>
                    <span className="text-suka-gray-500 block">Kategori Akun</span>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span className="font-semibold text-suka-ink">
                        {ACCOUNT_CATEGORY_LABELS[selectedStaff.account_category || 'employee'] || selectedStaff.account_category}
                      </span>
                      {categoryBadge(selectedStaff.account_category)}
                    </div>
                  </div>
                  <div>
                    <span className="text-suka-gray-500 block">Sisa Cuti Tahunan</span>
                    <span className="font-bold text-suka-brown mt-0.5 block">
                      {selectedStaff.leave_quota ?? 12} Hari
                    </span>
                  </div>
                  <div>
                    <span className="text-suka-gray-500 block">Tanggal Masuk</span>
                    <span className="font-medium text-suka-ink mt-0.5 block">
                      {selectedStaff.join_date ?? '-'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 2: Data Pribadi */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-suka-brown font-bold text-sm border-b border-suka-gray-100 pb-1.5">
                  <User size={16} className="text-suka-orange" />
                  <span>Data Pribadi &amp; Kontak</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="col-span-2">
                    <span className="text-suka-gray-500 block">NIK KTP</span>
                    <span className="font-mono font-bold text-suka-ink mt-0.5 block">
                      {selectedStaff.nik || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-suka-gray-500 block">No. WhatsApp</span>
                    <span className="font-semibold text-suka-ink mt-0.5 block">
                      {selectedStaff.phone || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-suka-gray-500 block">Email Pribadi</span>
                    <span className="font-medium text-suka-ink mt-0.5 block break-all">
                      {selectedStaff.email || '-'}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-suka-gray-500 block">Alamat KTP</span>
                    <span className="font-medium text-suka-ink mt-0.5 block bg-stone-50 p-2 rounded-lg border border-stone-200 whitespace-pre-line">
                      {selectedStaff.address_ktp || '-'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 3: Kontak Darurat */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-suka-brown font-bold text-sm border-b border-suka-gray-100 pb-1.5">
                  <PhoneCall size={16} className="text-suka-orange" />
                  <span>Kontak Darurat</span>
                </div>
                {selectedStaff.emergency_name ? (
                  <div className="bg-red-50/60 p-3 rounded-xl border border-red-100 text-xs space-y-1">
                    <div className="font-bold text-red-900">{selectedStaff.emergency_name}</div>
                    <div className="text-red-700">Hubungan: {selectedStaff.emergency_relationship || '-'}</div>
                    <div className="font-mono font-bold text-red-900">
                      Telp: {selectedStaff.emergency_phone || '-'}
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-suka-gray-500 italic">Belum diisi.</span>
                )}
              </div>

              {/* Section 4: Keuangan */}
              <div className="space-y-3 pb-4">
                <div className="flex items-center gap-2 text-suka-brown font-bold text-sm border-b border-suka-gray-100 pb-1.5">
                  <Wallet size={16} className="text-suka-orange" />
                  <span>Kompensasi &amp; Rekening Bank</span>
                </div>
                {selectedStaff.financials ? (
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <div className="bg-[#FDF9F3] p-2 rounded-xl border border-suka-brown/10 text-center">
                        <span className="text-[9px] uppercase font-bold text-suka-gray-500 block">Gaji Pokok</span>
                        <span className="text-xs font-bold text-suka-brown mt-0.5 block">
                          {formatRupiah(selectedStaff.financials.basic_salary)}
                        </span>
                      </div>
                      <div className="bg-[#FDF9F3] p-2 rounded-xl border border-suka-brown/10 text-center">
                        <span className="text-[9px] uppercase font-bold text-suka-gray-500 block">Tunj. Makan</span>
                        <span className="text-xs font-bold text-emerald-800 mt-0.5 block">
                          {formatRupiah(selectedStaff.financials.allowance_meal ?? selectedStaff.financials.allowance_presence ?? 0)}
                        </span>
                      </div>
                      <div className="bg-[#FDF9F3] p-2 rounded-xl border border-suka-brown/10 text-center">
                        <span className="text-[9px] uppercase font-bold text-suka-gray-500 block">Tunj. Transport</span>
                        <span className="text-xs font-bold text-emerald-800 mt-0.5 block">
                          {formatRupiah(selectedStaff.financials.allowance_transport ?? 0)}
                        </span>
                      </div>
                      <div className="bg-[#FDF9F3] p-2 rounded-xl border border-suka-brown/10 text-center">
                        <span className="text-[9px] uppercase font-bold text-suka-gray-500 block">Tunj. Komunikasi</span>
                        <span className="text-xs font-bold text-emerald-800 mt-0.5 block">
                          {formatRupiah(selectedStaff.financials.allowance_communication ?? 0)}
                        </span>
                      </div>
                      <div className="bg-[#FDF9F3] p-2 rounded-xl border border-suka-brown/10 text-center">
                        <span className="text-[9px] uppercase font-bold text-suka-gray-500 block">Sales Bonus</span>
                        <span className="text-xs font-bold text-amber-800 mt-0.5 block">
                          {formatRupiah(selectedStaff.financials.sales_bonus ?? 0)}
                        </span>
                      </div>
                      {Number(selectedStaff.financials.allowance_position) > 0 && (
                        <div className="bg-[#FDF9F3] p-2 rounded-xl border border-suka-brown/10 text-center">
                          <span className="text-[9px] uppercase font-bold text-suka-gray-500 block">Tunj. Jabatan</span>
                          <span className="text-xs font-bold text-suka-brown mt-0.5 block">
                            {formatRupiah(selectedStaff.financials.allowance_position)}
                          </span>
                        </div>
                      )}
                      <div className="bg-red-50/70 p-2 rounded-xl border border-red-200 text-center">
                        <span className="text-[9px] uppercase font-bold text-red-700 block">Pot. Kasbon</span>
                        <span className="text-xs font-bold text-red-600 mt-0.5 block">
                          -{formatRupiah(selectedStaff.financials.deduction_kasbon ?? 0)}
                        </span>
                      </div>
                      <div className="bg-red-50/70 p-2 rounded-xl border border-red-200 text-center">
                        <span className="text-[9px] uppercase font-bold text-red-700 block">Pot. BPJS</span>
                        <span className="text-xs font-bold text-red-600 mt-0.5 block">
                          -{formatRupiah(selectedStaff.financials.deduction_bpjs ?? 0)}
                        </span>
                      </div>
                    </div>
                    <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 text-xs space-y-1">
                      <div>
                        Bank: <strong className="text-suka-ink">{selectedStaff.financials.bank_name || '-'}</strong>
                      </div>
                      <div>
                        No. Rek: <strong className="font-mono text-suka-orange">{selectedStaff.financials.bank_account_number || '-'}</strong>
                      </div>
                      <div>
                        A.n: <strong className="text-suka-ink">{selectedStaff.financials.bank_account_name || '-'}</strong>
                      </div>
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-suka-gray-500 italic">Data gaji belum diatur.</span>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-suka-gray-200 bg-stone-50 flex justify-end gap-2">
              <Button
                onClick={() => setSelectedStaff(null)}
                variant="ghost"
                className="rounded-xl font-bold"
              >
                Tutup
              </Button>
              <Button
                onClick={() => {
                  onEdit(selectedStaff)
                  setSelectedStaff(null)
                }}
                className="rounded-xl font-bold bg-suka-orange hover:bg-suka-orange/90 text-white"
              >
                Edit Profil
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
