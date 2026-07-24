'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/ui'
import { PeriodFilter } from '@/components/PeriodFilter'
import { PettyCashReportView, type PettyCashTransaction, type DailyPettyCashSummary } from '@/components/owner/PettyCashReportView'
import type { PeriodFilterValue, Outlet } from '@/lib/types'
import { Printer } from 'lucide-react'

interface PettyCashPageClientProps {
  filter: PeriodFilterValue
  outlets: Outlet[]
  lockedOutletId: string | null
  pettyCashTransactions: PettyCashTransaction[]
  dailySummaries?: DailyPettyCashSummary[]
}

export default function PettyCashPageClient({
  filter,
  outlets,
  lockedOutletId,
  pettyCashTransactions,
  dailySummaries = [],
}: PettyCashPageClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleFilterChange = (newFilter: PeriodFilterValue) => {
    const params = new URLSearchParams()
    if (newFilter.from) params.set('from', newFilter.from)
    if (newFilter.to) params.set('to', newFilter.to)
    if (newFilter.outletId !== 'all') params.set('outletId', newFilter.outletId)
    startTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false })
    })
  }

  const handleOutletSelect = (outletId: string) => {
    handleFilterChange({
      ...filter,
      outletId,
    })
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Laporan Petty Cash (Khusus)"
        description="Laporan rincian mutasi kas kecil, pengeluaran operasional, rekap saldo harian, dan bukti nota transaksi"
      >
        <div className="flex flex-col sm:flex-row items-center gap-2">
          <PeriodFilter
            value={filter}
            onChange={handleFilterChange}
            outlets={outlets}
            lockedOutletId={lockedOutletId}
            hideSource={true}
          />
          <button
            onClick={() => window.print()}
            className="w-full sm:w-auto px-4 py-2 bg-suka-orange hover:bg-suka-orange/90 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm"
          >
            <Printer size={15} /> Cetak PDF
          </button>
        </div>
      </PageHeader>

      {isPending && (
        <div className="flex justify-center items-center py-8 bg-white/50 rounded-2xl animate-pulse border border-suka-orange/20">
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-3 border-suka-orange border-t-transparent rounded-full animate-spin"></div>
            <p className="text-suka-brown font-bold text-xs">Memuat data Petty Cash...</p>
          </div>
        </div>
      )}

      <div className={isPending ? 'opacity-50 pointer-events-none transition-opacity' : 'transition-opacity'}>
        <PettyCashReportView
          outlets={outlets}
          transactions={pettyCashTransactions}
          dailySummaries={dailySummaries}
          selectedOutletId={filter.outletId}
          onOutletChange={handleOutletSelect}
          dateFrom={filter.from}
          dateTo={filter.to}
        />
      </div>
    </div>
  )
}
