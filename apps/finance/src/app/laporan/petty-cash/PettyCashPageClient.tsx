'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/ui'
import { PeriodFilter } from '@/components/PeriodFilter'
import { PettyCashReportView, type PettyCashTransaction, type DailyPettyCashSummary } from '@/components/owner/PettyCashReportView'
import type { PeriodFilterValue, Outlet } from '@/lib/types'
import type { SaldoOutlet } from '@/lib/pettyCash/laporan'
import { Printer, Wallet } from 'lucide-react'

interface PettyCashPageClientProps {
  filter: PeriodFilterValue
  outlets: Outlet[]
  lockedOutletId: string | null
  pettyCashTransactions: PettyCashTransaction[]
  dailySummaries?: DailyPettyCashSummary[]
  saldoOutlet?: SaldoOutlet[]
}

export default function PettyCashPageClient({
  filter,
  outlets,
  lockedOutletId,
  pettyCashTransactions,
  dailySummaries = [],
  saldoOutlet = [],
}: PettyCashPageClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleFilterChange = (newFilter: Pick<PeriodFilterValue, 'from' | 'to' | 'outletId'>) => {
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

  const outletTerpilih = filter.outletId !== 'all' ? outlets.find((o) => o.id === filter.outletId) : null

  return (
    <div className="space-y-5">
      <PageHeader
        title="Laporan Petty Cash"
        description="Kas masuk dan keluar outlet per hari, lengkap dengan bukti nota."
        icon={Wallet}
      >
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center print:hidden">
          <PeriodFilter
            value={filter}
            onChange={handleFilterChange}
            outlets={outlets}
            lockedOutletId={lockedOutletId}
            hideSource={true}
          />
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-suka-brown/15 bg-white px-3.5 py-2 text-xs font-semibold text-suka-brown hover:border-suka-brown/40"
          >
            <Printer size={15} aria-hidden="true" /> Cetak
          </button>
        </div>
      </PageHeader>

      {outletTerpilih && (
        <div className="flex flex-wrap items-center gap-2 text-sm print:hidden">
          <span className="text-suka-gray-500">Menampilkan</span>
          <span className="font-semibold text-suka-ink">{outletTerpilih.name}</span>
          <button
            type="button"
            onClick={() => handleOutletSelect('all')}
            className="text-xs font-semibold text-suka-orange hover:underline"
          >
            Lihat semua cabang
          </button>
        </div>
      )}

      <div
        className={isPending ? 'pointer-events-none opacity-50 transition-opacity' : 'transition-opacity'}
        aria-busy={isPending}
      >
        <PettyCashReportView
          outlets={outlets}
          transactions={pettyCashTransactions}
          dailySummaries={dailySummaries}
          saldoOutlet={saldoOutlet}
          selectedOutletId={filter.outletId}
          onOutletChange={handleOutletSelect}
          dateFrom={filter.from}
          dateTo={filter.to}
        />
      </div>
    </div>
  )
}
