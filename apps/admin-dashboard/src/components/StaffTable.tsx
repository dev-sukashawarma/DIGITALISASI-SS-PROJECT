'use client'
import { useState } from 'react'
import { Avatar, Button } from '@suka/design-system'
import { useAuth } from '@suka/auth'
import { Edit, KeyRound, Trash2, Eye, X, Wallet, User, PhoneCall, FileText } from 'lucide-react'
import { StatusToggle } from './StatusToggle'
import type { StaffRow, StaffStatus } from '@/lib/types'

function statusBadge(status: StaffStatus) {
  const map: Record<StaffStatus, string> = {
    active: 'bg-[#e1f5ee] text-[#085041] border border-[#a2ebd2]',
    inactive: 'bg-[#fcebeb] text-[#a32d2d] border border-[#f5c2c2]',
    on_leave: 'bg-amber-50 text-amber-700 border border-amber-200',
  }
  const label: Record<StaffStatus, string> = { active: 'Aktif', inactive: 'Nonaktif', on_leave: 'Cuti' }
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${map[status]}`}>{label[status]}</span>
}

export function StaffTable({
  rows, onEdit, onResetPassword, onToggleStatus, onDelete,
}: {
  rows: StaffRow[]
  onEdit: (s: StaffRow) => void
  onResetPassword: (s: StaffRow) => void
  onToggleStatus: (s: StaffRow, next: StaffStatus) => void
  onDelete: (s: StaffRow) => void
}) {
  const [selectedStaff, setSelectedStaff] = useState<StaffRow | null>(null)

  // Auth privilege check
  let isPrivileged = true
  try {
    const auth = useAuth()
    if (auth.outletStaff?.role) {
      isPrivileged = ['owner', 'admin_hr', 'admin'].includes(auth.outletStaff.role)
    }
  } catch (e) {
    isPrivileged = true
  }

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val)
  }

  const formatGender = (g?: 'male' | 'female' | null) => {
    if (g === 'male') return 'Laki-laki'
    if (g === 'female') return 'Perempuan'
    return '-'
  }

  const formatContract = (c?: string | null) => {
    const map: Record<string, string> = {
      permanent: 'Karyawan Tetap',
      contract: 'Karyawan Kontrak',
      intern: 'Magang / Internship',
      daily: 'Harian / Freelance'
    }
    return c ? (map[c] || c) : '-'
  }

  return (
    <div className="relative">
      <div className="overflow-hidden rounded-2xl border border-suka-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-suka-gray-200 bg-suka-gray-50/60 text-gray-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Nama</th>
              <th className="px-4 py-3 font-semibold">Role</th>
              <th className="px-4 py-3 font-semibold">Outlet Home</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-suka-gray-200/70">
            {rows.map((s) => (
              <tr key={s.id} className="hover:bg-suka-gray-50/40 transition-colors">
                <td className="px-4 py-3 font-semibold text-suka-ink">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={s.name} size={32} />
                    <div>
                      <button 
                        type="button" 
                        onClick={() => setSelectedStaff(s)}
                        className="text-left font-semibold hover:text-suka-orange transition-colors cursor-pointer block"
                      >
                        {s.name}
                      </button>
                      <div className="text-xs text-gray-400">@{s.username ?? '-'}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 capitalize text-gray-600">{s.role.replace('_', ' ')}</td>
                <td className="px-4 py-3 text-gray-600">{s.outlets?.name ?? '-'}</td>
                <td className="px-4 py-3">{statusBadge(s.status)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => setSelectedStaff(s)} className="rounded-lg p-2 text-gray-600 hover:bg-gray-100" title="Detail Profile"><Eye size={16} /></button>
                    <button onClick={() => onEdit(s)} className="rounded-lg p-2 text-blue-600 hover:bg-blue-50" title="Edit"><Edit size={16} /></button>
                    <button onClick={() => onResetPassword(s)} className="rounded-lg p-2 text-suka-brown hover:bg-suka-cream" title="Reset Password"><KeyRound size={16} /></button>
                    <StatusToggle status={s.status} onToggle={(next) => onToggleStatus(s, next)} />
                    <button onClick={() => onDelete(s)} className="rounded-lg p-2 text-red-600 hover:bg-red-50" title="Hapus Permanen"><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Tidak ada staff yang cocok.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Side Slide-Over Drawer for Employee Detail */}
      {selectedStaff && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-suka-ink/40 backdrop-blur-xs transition-opacity duration-300"
            onClick={() => setSelectedStaff(null)}
          />

          {/* Drawer Panel */}
          <div className="relative w-full max-w-lg bg-white shadow-2xl flex flex-col h-full z-10 animate-slide-in border-l border-suka-gray-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-suka-brown text-white">
              <div className="flex items-center gap-3">
                <Avatar name={selectedStaff.name} size={40} />
                <div>
                  <h3 className="font-bold text-lg leading-tight">{selectedStaff.name}</h3>
                  <div className="text-xs text-suka-cream/80 font-medium">NIP: {selectedStaff.nip || '-'}</div>
                </div>
              </div>
              <button 
                onClick={() => setSelectedStaff(null)} 
                className="rounded-lg p-1.5 hover:bg-white/10 text-white transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Section 1: Core Info */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-suka-brown font-bold border-b border-suka-gray-200 pb-1.5">
                  <FileText size={18} />
                  <span>Informasi Pekerjaan</span>
                </div>
                <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                  <div>
                    <span className="text-xs text-gray-400 block">Status Akun</span>
                    <div className="mt-0.5">{statusBadge(selectedStaff.status)}</div>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block">Role Keamanan</span>
                    <span className="font-semibold capitalize mt-0.5 block">{selectedStaff.role.replace('_', ' ')}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block">Outlet Utama</span>
                    <span className="font-semibold text-suka-ink mt-0.5 block">{selectedStaff.outlets?.name ?? '-'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block">Username</span>
                    <span className="font-mono text-suka-orange mt-0.5 block">@{selectedStaff.username ?? '-'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block">Jenis Kontrak</span>
                    <span className="font-medium text-gray-700 mt-0.5 block">{formatContract(selectedStaff.contract_type)}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block">Cuti Tahunan</span>
                    <span className="font-medium text-gray-700 mt-0.5 block">{selectedStaff.leave_quota ?? 12} Hari / Tahun</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block">Tanggal Join</span>
                    <span className="font-medium text-gray-700 mt-0.5 block">{selectedStaff.join_date ?? '-'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block">Tanggal Resign</span>
                    <span className="font-medium text-gray-700 mt-0.5 block">{selectedStaff.resign_date ?? '-'}</span>
                  </div>
                </div>
              </div>

              {/* Section 2: Personal Profile */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-suka-brown font-bold border-b border-suka-gray-200 pb-1.5">
                  <User size={18} />
                  <span>Data Pribadi</span>
                </div>
                <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                  <div className="col-span-2">
                    <span className="text-xs text-gray-400 block">NIK KTP</span>
                    <span className="font-mono font-medium text-suka-ink mt-0.5 block">{selectedStaff.nik || '-'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block">Email Pribadi</span>
                    <span className="font-medium text-gray-700 mt-0.5 block break-all">{selectedStaff.email || '-'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block">Nomor Telepon / WA</span>
                    <span className="font-medium text-gray-700 mt-0.5 block">{selectedStaff.phone || '-'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block">Jenis Kelamin</span>
                    <span className="font-medium text-gray-700 mt-0.5 block">{formatGender(selectedStaff.gender)}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block">Agama</span>
                    <span className="font-medium text-gray-700 mt-0.5 block">{selectedStaff.religion || '-'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-xs text-gray-400 block">Tempat & Tanggal Lahir</span>
                    <span className="font-medium text-gray-700 mt-0.5 block">
                      {selectedStaff.birth_place || '-'}, {selectedStaff.birth_date || '-'}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-xs text-gray-400 block">Alamat KTP</span>
                    <span className="font-medium text-gray-700 mt-0.5 block bg-suka-cream/40 p-2 rounded-lg border border-suka-gray-100 whitespace-pre-line text-xs">
                      {selectedStaff.address_ktp || '-'}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-xs text-gray-400 block">Alamat Domisili</span>
                    <span className="font-medium text-gray-700 mt-0.5 block bg-suka-cream/40 p-2 rounded-lg border border-suka-gray-100 whitespace-pre-line text-xs">
                      {selectedStaff.address_domicile || '-'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 3: Emergency Contacts */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-suka-brown font-bold border-b border-suka-gray-200 pb-1.5">
                  <PhoneCall size={18} />
                  <span>Kontak Darurat</span>
                </div>
                {selectedStaff.emergency_name ? (
                  <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm bg-red-50/50 p-3.5 rounded-xl border border-red-100">
                    <div>
                      <span className="text-xs text-red-800 font-semibold block">Nama Kontak</span>
                      <span className="font-semibold text-suka-ink mt-0.5 block">{selectedStaff.emergency_name}</span>
                    </div>
                    <div>
                      <span className="text-xs text-red-800 font-semibold block">Hubungan</span>
                      <span className="font-medium text-gray-700 mt-0.5 block capitalize">{selectedStaff.emergency_relationship}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-xs text-red-800 font-semibold block">Nomor Telepon</span>
                      <span className="font-mono font-semibold text-suka-brown mt-0.5 block">{selectedStaff.emergency_phone}</span>
                    </div>
                  </div>
                ) : (
                  <span className="text-sm text-gray-500 italic">Belum diisi.</span>
                )}
              </div>

              {/* Section 4: Sensitive Financial Data (Enforced RLS visibility check) */}
              {isPrivileged && (
                <div className="space-y-4 pb-4">
                  <div className="flex items-center gap-2 text-suka-brown font-bold border-b border-suka-gray-200 pb-1.5">
                    <Wallet size={18} />
                    <span>Keuangan & Rekening Bank</span>
                  </div>
                  {selectedStaff.financials ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-suka-cream p-2.5 rounded-xl border border-suka-orange/20 text-center">
                          <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-wider">Gapok</span>
                          <span className="text-xs font-bold text-suka-brown mt-0.5 block">{formatRupiah(selectedStaff.financials.basic_salary)}</span>
                        </div>
                        <div className="bg-suka-cream p-2.5 rounded-xl border border-suka-orange/20 text-center">
                          <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-wider">Tunj. Jabatan</span>
                          <span className="text-xs font-bold text-suka-brown mt-0.5 block">{formatRupiah(selectedStaff.financials.allowance_position)}</span>
                        </div>
                        <div className="bg-suka-cream p-2.5 rounded-xl border border-suka-orange/20 text-center">
                          <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-wider">Tunj. Hadir</span>
                          <span className="text-xs font-bold text-suka-brown mt-0.5 block">{formatRupiah(selectedStaff.financials.allowance_presence)}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm bg-suka-cream/30 p-3.5 rounded-xl border border-suka-gray-100">
                        <div>
                          <span className="text-xs text-gray-400 block">Bank</span>
                          <span className="font-semibold text-suka-ink mt-0.5 block">{selectedStaff.financials.bank_name || '-'}</span>
                        </div>
                        <div>
                          <span className="text-xs text-gray-400 block">No. Rekening</span>
                          <span className="font-mono font-semibold text-suka-ink mt-0.5 block">{selectedStaff.financials.bank_account_number || '-'}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-xs text-gray-400 block">Nama Pemilik Rekening</span>
                          <span className="font-semibold text-suka-ink mt-0.5 block">{selectedStaff.financials.bank_account_name || '-'}</span>
                        </div>
                        <div className="col-span-2 border-t border-suka-gray-100 my-1 pt-1"></div>
                        <div>
                          <span className="text-xs text-gray-400 block">NPWP</span>
                          <span className="font-mono text-xs text-gray-700 mt-0.5 block">{selectedStaff.financials.npwp || '-'}</span>
                        </div>
                        <div>
                          <span className="text-xs text-gray-400 block">BPJS TK</span>
                          <span className="font-mono text-xs text-gray-700 mt-0.5 block">{selectedStaff.financials.bpjs_ketenagakerjaan || '-'}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-xs text-gray-400 block">BPJS Kesehatan</span>
                          <span className="font-mono text-xs text-gray-700 mt-0.5 block">{selectedStaff.financials.bpjs_kesehatan || '-'}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-500 italic">Data keuangan belum diisi atau tidak dapat dimuat.</span>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-suka-gray-200 bg-suka-gray-50 flex justify-end gap-2">
              <Button onClick={() => setSelectedStaff(null)} className="rounded-xl bg-white text-suka-ink border border-suka-gray-300 font-semibold hover:bg-suka-gray-100">Tutup</Button>
              <Button onClick={() => { onEdit(selectedStaff); setSelectedStaff(null) }} className="rounded-xl font-semibold">Edit Profil</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
