'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AlertOctagon, Plus, ShieldAlert, AlertTriangle } from 'lucide-react'
import { Button, Spinner } from '@suka/design-system'
import { PageHeader } from '@/components/ui/PageHeader'
import { useDiscipline } from '@/hooks/useDiscipline'
import { DisciplineTable } from '@/components/modules/DisciplineTable'
import { DisciplineFormModal } from '@/components/modules/DisciplineFormModal'
import type { DisciplineRecord } from '@/lib/types'
import { Pagination, clampPage } from '@/components/ui/Pagination'
import { DEFAULT_PAGE_SIZE } from '@/lib/paging'

export default function DisciplinePage() {
  const [showModal, setShowModal] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'resolved'>('all')

  const [page, setPage] = useState(1)
  const { data, isLoading, isFetching, issueWarning, resolveWarning } = useDiscipline(statusFilter, page)
  const rows = data?.rows ?? []
  const total = data?.total ?? 0
  // Ringkasan dihitung di database atas SEMUA catatan (bukan hanya halaman ini)
  const summary = data?.summary ?? { active: 0, sp1: 0, sp2: 0, sp3: 0, total: 0 }

  useEffect(() => {
    const clamped = clampPage(page, total, DEFAULT_PAGE_SIZE)
    if (clamped !== page) setPage(clamped)
  }, [page, total])

  const changeFilter = (f: typeof statusFilter) => {
    setStatusFilter(f)
    setPage(1)
  }

  const handleIssueWarning = (data: Omit<DisciplineRecord, 'id'>) => {
    issueWarning.mutate(data, {
      onSuccess: () => {
        toast.success(`Surat Peringatan (${data.warning_level}) berhasil diterbitkan!`)
        setShowModal(false)
      },
      onError: (err: any) => toast.error(err.message || 'Gagal menerbitkan SP'),
    })
  }

  const handleResolveWarning = (id: string) => {
    if (!confirm('Tandai sanksi / masa berlaku SP ini telah selesai?')) return
    resolveWarning.mutate(id, {
      onSuccess: () => toast.success('Status SP berhasil ditandai selesai'),
      onError: (err: any) => toast.error(err.message || 'Gagal menyelesaikan SP'),
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Catatan Surat Peringatan (SP) &amp; Disiplin"
        description="Dokumentasi penegakan tata tertib operasional, surat teguran lisan, SP1, SP2, SP3, dan skorsing kerja."
      >
        <Button
          type="button"
          onClick={() => setShowModal(true)}
          className="rounded-xl font-bold bg-red-600 hover:bg-red-700 text-white flex items-center gap-1.5"
        >
          <Plus size={16} /> Terbitkan SP Baru
        </Button>
      </PageHeader>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-suka-gray-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-700 flex items-center justify-center font-bold">
            <AlertOctagon size={20} />
          </div>
          <div>
            <p className="text-xs font-bold text-suka-gray-500 uppercase">SP Aktif</p>
            <p className="text-2xl font-black text-red-700 mt-0.5">{summary.active}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200 bg-amber-50/40 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
            <AlertTriangle size={20} />
          </div>
          <div>
            <p className="text-xs font-bold text-amber-800 uppercase">Tingkat SP1</p>
            <p className="text-2xl font-black text-amber-900 mt-0.5">{summary.sp1}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-orange-200 bg-orange-50/40 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-800 flex items-center justify-center font-bold">
            <AlertTriangle size={20} />
          </div>
          <div>
            <p className="text-xs font-bold text-orange-800 uppercase">Tingkat SP2</p>
            <p className="text-2xl font-black text-orange-900 mt-0.5">{summary.sp2}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-red-200 bg-red-50/40 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-200 text-red-900 flex items-center justify-center font-bold">
            <ShieldAlert size={20} />
          </div>
          <div>
            <p className="text-xs font-bold text-red-900 uppercase">SP3 / Skorsing</p>
            <p className="text-2xl font-black text-red-900 mt-0.5">{summary.sp3}</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1.5 bg-white p-1.5 rounded-2xl border border-suka-gray-200 shadow-sm w-fit">
        <button
          onClick={() => changeFilter('all')}
          className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer ${
            statusFilter === 'all'
              ? 'bg-suka-brown text-white shadow-xs'
              : 'text-suka-gray-500 hover:text-suka-ink'
          }`}
        >
          Semua Catatan ({summary.total})
        </button>
        <button
          onClick={() => changeFilter('active')}
          className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer ${
            statusFilter === 'active'
              ? 'bg-red-600 text-white shadow-xs'
              : 'text-red-700 hover:text-red-900'
          }`}
        >
          Sanksi Aktif ({summary.active})
        </button>
        <button
          onClick={() => changeFilter('resolved')}
          className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer ${
            statusFilter === 'resolved'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-emerald-700 hover:text-emerald-900'
          }`}
        >
          Selesai / Sanksi Berakhir
        </button>
      </div>

      {/* Discipline Table */}
      {isLoading ? (
        <div className="flex justify-center p-12">
          <Spinner />
        </div>
      ) : (
        <div className={isFetching ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          <DisciplineTable rows={rows} onResolve={handleResolveWarning} />
          <Pagination page={page} pageSize={DEFAULT_PAGE_SIZE} total={total} onPageChange={setPage} />
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <DisciplineFormModal
          onClose={() => setShowModal(false)}
          onSubmit={handleIssueWarning}
        />
      )}
    </div>
  )
}
