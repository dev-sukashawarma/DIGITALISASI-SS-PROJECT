'use client'

import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import { UserPlus, Download } from 'lucide-react'
import { Button, Spinner } from '@suka/design-system'
import { PageHeader } from '@/components/ui/PageHeader'
import { useStaff } from '@/hooks/useStaff'
import { useStaffMutations } from '@/hooks/useStaffMutations'
import { useOutlets } from '@/hooks/useOutlets'
import { StaffFilters } from '@/components/modules/StaffFilters'
import { StaffTable } from '@/components/modules/StaffTable'
import { StaffForm } from '@/components/modules/StaffForm'
import { ResetPasswordDialog } from '@/components/modules/ResetPasswordDialog'
import { filterStaff } from '@/lib/filterStaff'
import { exportCsv } from '@/lib/exportCsv'
import type { StaffRow, StaffFilterValues, StaffFormValues, StaffStatus } from '@/lib/types'

export default function StaffPage() {
  const [filter, setFilter] = useState<StaffFilterValues>({
    search: '',
    outletId: '',
    role: '',
    status: '',
  })

  const [formOpen, setFormOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState<StaffRow | null>(null)
  const [resetPwStaff, setResetPwStaff] = useState<StaffRow | null>(null)

  const { data: staffList = [], isLoading } = useStaff()
  const { data: outlets = [] } = useOutlets()
  const { create, update, remove, setStatus, toggleBonusEligibility, resetPassword } = useStaffMutations()

  const filteredStaff = useMemo(
    () => filterStaff(staffList, filter),
    [staffList, filter]
  )

  const handleCreate = (values: StaffFormValues) => {
    create.mutate(values, {
      onSuccess: () => {
        toast.success('Karyawan baru berhasil ditambahkan!')
        setFormOpen(false)
      },
      onError: (err: any) => toast.error(err.message || 'Gagal menambahkan staf'),
    })
  }

  const handleUpdate = (values: StaffFormValues) => {
    if (!editingStaff) return
    update.mutate(
      { staff_id: editingStaff.id, ...values },
      {
        onSuccess: () => {
          toast.success('Data profil karyawan berhasil diperbarui!')
          setEditingStaff(null)
          setFormOpen(false)
        },
        onError: (err: any) => toast.error(err.message || 'Gagal memperbarui staf'),
      }
    )
  }

  const handleDelete = (s: StaffRow) => {
    if (!window.confirm(`Hapus permanen karyawan "${s.name}"? Tindakan ini tidak dapat dibatalkan.`)) return
    remove.mutate(s.id, {
      onSuccess: () => toast.success(`Karyawan ${s.name} berhasil dihapus`),
      onError: (err: any) => toast.error(err.message || 'Gagal menghapus staf'),
    })
  }

  const handleToggleStatus = (s: StaffRow, next: StaffStatus) => {
    setStatus.mutate(
      { staff_id: s.id, status: next },
      {
        onSuccess: () => toast.success(`Status ${s.name} diubah menjadi ${next}`),
        onError: (err: any) => toast.error(err.message || 'Gagal mengubah status'),
      }
    )
  }

  const handleToggleBonus = (s: StaffRow) => {
    const nextBonus = s.is_bonus_eligible === false ? true : false
    toggleBonusEligibility.mutate(
      { staff_id: s.id, is_bonus_eligible: nextBonus },
      {
        onSuccess: () =>
          toast.success(
            nextBonus
              ? `Bonus diaktifkan untuk ${s.name}`
              : `Bonus dinonaktifkan (akun tester) untuk ${s.name}`
          ),
        onError: (err: any) => toast.error(err.message || 'Gagal mengubah status bonus'),
      }
    )
  }

  const handleResetPassword = (newPw: string) => {
    if (!resetPwStaff) return
    resetPassword.mutate(
      { staff_id: resetPwStaff.id, new_password: newPw },
      {
        onSuccess: () => {
          toast.success(`Password untuk ${resetPwStaff.name} berhasil direset`)
          setResetPwStaff(null)
        },
        onError: (err: any) => toast.error(err.message || 'Gagal mereset password'),
      }
    )
  }

  const handleExportCsv = () => {
    if (!filteredStaff.length) {
      toast.error('Tidak ada data untuk diexport')
      return
    }

    const flat = filteredStaff.map((s) => ({
      nip: s.nip || '-',
      nama: s.name,
      username: s.username || '-',
      role: s.role,
      outlet: s.outlets?.name || 'Pusat',
      status: s.status,
      tipe_kontrak: s.contract_type || '-',
      no_hp: s.phone || '-',
      email: s.email || '-',
      nik: s.nik || '-',
      gaji_pokok: s.financials?.basic_salary || 0,
      tunjangan_jabatan: s.financials?.allowance_position || 0,
      tunjangan_kehadiran: s.financials?.allowance_presence || 0,
      bank: s.financials?.bank_name || '-',
      no_rekening: s.financials?.bank_account_number || '-',
      atas_nama: s.financials?.bank_account_name || '-',
    }))

    exportCsv(
      flat,
      [
        { key: 'nip', label: 'NIP' },
        { key: 'nama', label: 'Nama Lengkap' },
        { key: 'username', label: 'Username' },
        { key: 'role', label: 'Role' },
        { key: 'outlet', label: 'Outlet Home' },
        { key: 'status', label: 'Status' },
        { key: 'tipe_kontrak', label: 'Kontrak' },
        { key: 'no_hp', label: 'No HP' },
        { key: 'email', label: 'Email' },
        { key: 'nik', label: 'NIK KTP' },
        { key: 'gaji_pokok', label: 'Gaji Pokok' },
        { key: 'tunjangan_jabatan', label: 'Tunjangan Jabatan' },
        { key: 'tunjangan_kehadiran', label: 'Tunjangan Kehadiran' },
        { key: 'bank', label: 'Bank' },
        { key: 'no_rekening', label: 'No Rekening' },
        { key: 'atas_nama', label: 'Nama Pemilik' },
      ],
      `Database_Staf_SukaHR_${new Date().toISOString().split('T')[0]}`
    )
    toast.success('Data karyawan berhasil diexport ke CSV')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Database Karyawan &amp; Personalia"
        description="Kelola seluruh berkas identitas, jabatan, outlet, dan hak akses staf Suka Shawarma."
      >
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={handleExportCsv}
            className="rounded-xl border border-suka-gray-200 gap-1.5 font-bold"
          >
            <Download size={15} /> Export CSV
          </Button>
          <Button
            type="button"
            onClick={() => {
              setEditingStaff(null)
              setFormOpen(true)
            }}
            className="rounded-xl font-bold bg-suka-orange hover:bg-suka-orange/90 text-white gap-1.5"
          >
            <UserPlus size={16} /> Tambah Karyawan
          </Button>
        </div>
      </PageHeader>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-suka-gray-200 shadow-sm flex flex-wrap justify-between items-center gap-3">
        <StaffFilters value={filter} onChange={setFilter} outlets={outlets} />
        <span className="text-xs text-suka-gray-500 font-medium">
          Menampilkan <strong>{filteredStaff.length}</strong> dari {staffList.length} karyawan
        </span>
      </div>

      {/* Staff Table */}
      {isLoading ? (
        <div className="flex justify-center p-12">
          <Spinner />
        </div>
      ) : (
        <StaffTable
          rows={filteredStaff}
          onEdit={(s) => {
            setEditingStaff(s)
            setFormOpen(true)
          }}
          onResetPassword={(s) => setResetPwStaff(s)}
          onToggleStatus={handleToggleStatus}
          onToggleBonus={handleToggleBonus}
          onDelete={handleDelete}
        />
      )}

      {/* Form Modal for Create & Edit */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white rounded-3xl p-6 shadow-2xl border border-suka-gray-200 animate-in zoom-in-95 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-suka-gray-100 mb-4">
              <div>
                <h3 className="font-extrabold text-suka-brown text-lg">
                  {editingStaff ? `Edit Profil: ${editingStaff.name}` : 'Tambah Karyawan Baru'}
                </h3>
                <p className="text-xs text-suka-gray-500 font-medium">
                  Isi formulir 4 langkah: data utama, kontak pribadi, darurat, dan kompensasi gaji.
                </p>
              </div>
              <button
                onClick={() => setFormOpen(false)}
                className="text-suka-gray-400 hover:text-suka-ink font-bold text-sm cursor-pointer"
              >
                &times;
              </button>
            </div>

            <StaffForm
              outlets={outlets}
              onSubmit={editingStaff ? handleUpdate : handleCreate}
              submitting={create.isPending || update.isPending}
              initial={
                editingStaff
                  ? {
                      name: editingStaff.name,
                      username: editingStaff.username || '',
                      role: editingStaff.role,
                      outlet_id: editingStaff.outlet_id || '',
                      outlet_ids: editingStaff.outlet_ids || [],
                      is_bonus_eligible: editingStaff.is_bonus_eligible !== false,
                      nip: editingStaff.nip || '',
                      contract_type: editingStaff.contract_type || 'contract',
                      join_date: editingStaff.join_date || '',
                      resign_date: editingStaff.resign_date || '',
                      leave_quota: editingStaff.leave_quota ?? 12,
                      nik: editingStaff.nik || '',
                      email: editingStaff.email || '',
                      phone: editingStaff.phone || '',
                      address_ktp: editingStaff.address_ktp || '',
                      address_domicile: editingStaff.address_domicile || '',
                      birth_place: editingStaff.birth_place || '',
                      birth_date: editingStaff.birth_date || '',
                      gender: editingStaff.gender || undefined,
                      religion: editingStaff.religion || '',
                      emergency_name: editingStaff.emergency_name || '',
                      emergency_relationship: editingStaff.emergency_relationship || '',
                      emergency_phone: editingStaff.emergency_phone || '',
                      basic_salary: editingStaff.financials?.basic_salary || 0,
                      allowance_position: editingStaff.financials?.allowance_position || 0,
                      allowance_presence: editingStaff.financials?.allowance_presence || 0,
                      bank_name: editingStaff.financials?.bank_name || '',
                      bank_account_number: editingStaff.financials?.bank_account_number || '',
                      bank_account_name: editingStaff.financials?.bank_account_name || '',
                      npwp: editingStaff.financials?.npwp || '',
                      bpjs_ketenagakerjaan: editingStaff.financials?.bpjs_ketenagakerjaan || '',
                      bpjs_kesehatan: editingStaff.financials?.bpjs_kesehatan || '',
                    }
                  : undefined
              }
            />
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetPwStaff && (
        <ResetPasswordDialog
          staffName={resetPwStaff.name}
          onSubmit={handleResetPassword}
          onClose={() => setResetPwStaff(null)}
          submitting={resetPassword.isPending}
        />
      )}
    </div>
  )
}
