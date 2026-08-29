'use client'

import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import { FileCheck, AlertTriangle, AlertCircle, CheckCircle2, Download } from 'lucide-react'
import { Button, Spinner } from '@suka/design-system'
import { PageHeader } from '@/components/ui/PageHeader'
import { useContracts } from '@/hooks/useContracts'
import { useOutlets } from '@/hooks/useOutlets'
import { ContractTable } from '@/components/modules/ContractTable'
import { exportCsv } from '@/lib/exportCsv'

export default function ContractsPage() {
  const [outletFilter, setOutletFilter] = useState('all')
  const [statusTab, setStatusTab] = useState<'all' | 'expiring_soon' | 'expired' | 'active'>('all')

  const { data: contracts = [], isLoading, updateContract } = useContracts(outletFilter)
  const { data: outlets = [] } = useOutlets()

  // Summary counts
  const summary = useMemo(() => {
    let active = 0
    let expiringSoon = 0
    let expired = 0
    let permanent = 0

    contracts.forEach((c) => {
      if (c.contract_type === 'Tetap') permanent++
      if (c.status === 'expiring_soon') expiringSoon++
      else if (c.status === 'expired') expired++
      else active++
    })

    return { active, expiringSoon, expired, permanent, total: contracts.length }
  }, [contracts])

  // Filtered rows
  const filteredContracts = useMemo(() => {
    if (statusTab === 'all') return contracts
    return contracts.filter((c) => c.status === statusTab)
  }, [contracts, statusTab])

  const handleSaveContract = (values: {
    staff_id: string
    contract_type: string
    join_date: string
    resign_date: string | null
  }) => {
    updateContract.mutate(values, {
      onSuccess: () => toast.success('Perjanjian kontrak kerja staf berhasil diperbarui!'),
      onError: (err: any) => toast.error(err.message || 'Gagal menyimpan kontrak'),
    })
  }

  const handleExportCsv = () => {
    if (!filteredContracts.length) {
      toast.error('Tidak ada data untuk diexport')
      return
    }

    const flat = filteredContracts.map((c) => ({
      nama: c.outlet_staff?.name || '-',
      outlet: c.outlet_staff?.outlets?.name || 'Pusat',
      role: c.outlet_staff?.role || '-',
      kontrak: c.contract_type,
      mulai: c.start_date || '-',
      berakhir: c.end_date || 'Tetap',
      status: c.status,
    }))

    exportCsv(
      flat,
      [
        { key: 'nama', label: 'Nama Staf' },
        { key: 'outlet', label: 'Outlet' },
        { key: 'role', label: 'Jabatan' },
        { key: 'kontrak', label: 'Jenis Kontrak' },
        { key: 'mulai', label: 'Mulai Kerja' },
        { key: 'berakhir', label: 'Habis Kontrak' },
        { key: 'status', label: 'Status' },
      ],
      `Monitoring_Kontrak_SukaHR_${new Date().toISOString().split('T')[0]}`
    )
    toast.success('Laporan kontrak berhasil di-export ke CSV')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Monitoring Masa Berlaku Kontrak"
        description="Pantau jatuh tempo masa kerja PKWT, evaluasi perpanjangan kontrak, dan status karyawan tetap."
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
        </div>
      </PageHeader>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-suka-gray-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="text-xs font-bold text-suka-gray-500 uppercase">Kontrak Aktif</p>
            <p className="text-2xl font-black text-suka-ink mt-0.5">{summary.active}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200 bg-amber-50/40 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
            <AlertTriangle size={20} />
          </div>
          <div>
            <p className="text-xs font-bold text-amber-800 uppercase">Segera Habis (&le;30H)</p>
            <p className="text-2xl font-black text-amber-900 mt-0.5">{summary.expiringSoon}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-red-200 bg-red-50/40 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center font-bold">
            <AlertCircle size={20} />
          </div>
          <div>
            <p className="text-xs font-bold text-red-800 uppercase">Habis Kontrak</p>
            <p className="text-2xl font-black text-red-900 mt-0.5">{summary.expired}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-suka-gray-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <FileCheck size={20} />
          </div>
          <div>
            <p className="text-xs font-bold text-suka-gray-500 uppercase">Karyawan Tetap</p>
            <p className="text-2xl font-black text-suka-ink mt-0.5">{summary.permanent}</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Outlet Select */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-suka-gray-200 shadow-sm">
        <div className="flex gap-1.5 bg-[#FDF9F3] p-1 rounded-xl border border-suka-brown/10">
          <button
            onClick={() => setStatusTab('all')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              statusTab === 'all' ? 'bg-suka-brown text-white shadow-xs' : 'text-suka-brown hover:bg-amber-100'
            }`}
          >
            Semua ({summary.total})
          </button>
          <button
            onClick={() => setStatusTab('expiring_soon')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              statusTab === 'expiring_soon'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-amber-800 hover:bg-amber-100'
            }`}
          >
            Segera Habis ({summary.expiringSoon})
          </button>
          <button
            onClick={() => setStatusTab('expired')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              statusTab === 'expired'
                ? 'bg-red-600 text-white shadow-xs'
                : 'text-red-800 hover:bg-red-100'
            }`}
          >
            Habis ({summary.expired})
          </button>
        </div>

        <select
          value={outletFilter}
          onChange={(e) => setOutletFilter(e.target.value)}
          className="rounded-xl border border-suka-gray-200 px-3 py-2 text-xs sm:text-sm font-semibold outline-none focus:border-suka-orange bg-white text-suka-ink shadow-xs"
        >
          <option value="all">Semua Outlet</option>
          {outlets.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>

      {/* Contract Table */}
      {isLoading ? (
        <div className="flex justify-center p-12">
          <Spinner />
        </div>
      ) : (
        <ContractTable rows={filteredContracts} onSaveContract={handleSaveContract} />
      )}
    </div>
  )
}
