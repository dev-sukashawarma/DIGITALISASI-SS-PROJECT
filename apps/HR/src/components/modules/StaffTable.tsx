'use client'

import { useState } from 'react'
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
} from 'lucide-react'
import { StatusToggle } from './StatusToggle'
import type { StaffRow, StaffStatus, StaffSortKey, SortOrder } from '@/lib/types'
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

export function StaffTable({
  rows,
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
                      <span className="font-semibold text-xs text-suka-brown uppercase">
                        {s.role.replace('_', ' ')}
                      </span>
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
                  <td className="px-4 py-3 text-xs font-semibold text-suka-ink">
                    {s.outlets?.name ?? '-'}
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
                  <td colSpan={6} className="px-4 py-12 text-center text-suka-gray-500 font-medium">
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
                    <span className="text-suka-gray-500 block">Jabatan / Role</span>
                    <span className="font-bold uppercase text-suka-brown mt-0.5 block">
                      {selectedStaff.role.replace('_', ' ')}
                    </span>
                  </div>
                  <div>
                    <span className="text-suka-gray-500 block">Outlet Home</span>
                    <span className="font-semibold text-suka-ink mt-0.5 block">
                      {selectedStaff.outlets?.name ?? '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-suka-gray-500 block">Jenis Kontrak</span>
                    <span className="font-medium text-suka-ink mt-0.5 block">
                      {formatContract(selectedStaff.contract_type)}
                    </span>
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
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-[#FDF9F3] p-2 rounded-xl border border-suka-brown/10 text-center">
                        <span className="text-[9px] uppercase font-bold text-suka-gray-500 block">Gaji Pokok</span>
                        <span className="text-xs font-bold text-suka-brown mt-0.5 block">
                          {formatRupiah(selectedStaff.financials.basic_salary)}
                        </span>
                      </div>
                      <div className="bg-[#FDF9F3] p-2 rounded-xl border border-suka-brown/10 text-center">
                        <span className="text-[9px] uppercase font-bold text-suka-gray-500 block">Tunj. Jabatan</span>
                        <span className="text-xs font-bold text-suka-brown mt-0.5 block">
                          {formatRupiah(selectedStaff.financials.allowance_position)}
                        </span>
                      </div>
                      <div className="bg-[#FDF9F3] p-2 rounded-xl border border-suka-brown/10 text-center">
                        <span className="text-[9px] uppercase font-bold text-suka-gray-500 block">Tunj. Hadir</span>
                        <span className="text-xs font-bold text-suka-brown mt-0.5 block">
                          {formatRupiah(selectedStaff.financials.allowance_presence)}
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
