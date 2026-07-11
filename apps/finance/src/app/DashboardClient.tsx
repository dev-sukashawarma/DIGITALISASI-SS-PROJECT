'use client'

import { Wallet, Landmark, Banknote, Clock } from 'lucide-react'
import { Spinner, EmptyState } from '@suka/design-system'
import { useCashOverview, useCashTransactions } from '@/hooks/useCashData'
import { usePettyCashRequests } from '@/hooks/usePettyCash'
import { summarizeBalances, countPendingApproval } from '@/lib/cashSummary'
import { rupiah, tanggal } from '@/lib/format'
import { StatCard, SectionCard, TxStatusBadge } from '@/components/ui'

export default function DashboardPage() {
  const { locations, isLoading, error } = useCashOverview()
  const { data: txs = [], isLoading: loadingTx } = useCashTransactions(100)
  const { data: pettyCashRequests } = usePettyCashRequests('forwarded_to_finance')

  const summary = summarizeBalances(locations)
  const pending = countPendingApproval(txs)

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
        Gagal memuat data: {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-suka-brown">Net Cash Dashboard</h1>
        <p className="text-suka-gray-500">Saldo riil kas &amp; bank, disandingkan dengan aktivitas terbaru.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Kas" value={rupiah(summary.total)} icon={<Wallet size={22} />} tone="green" />
        <StatCard label="Saldo Bank" value={rupiah(summary.totalBank)} icon={<Landmark size={22} />} tone="blue" />
        <StatCard
          label="Kas Tunai (mengendap)"
          value={rupiah(summary.totalCash)}
          icon={<Banknote size={22} />}
          tone="orange"
          hint="Belum disetor ke bank"
        />
        <div className="flex flex-col gap-4">
          <StatCard label="Menunggu Approval Tx" value={pending} icon={<Clock size={22} />} tone="red" />
          <StatCard 
            label="Petty Cash Menunggu" 
            value={pettyCashRequests?.length || 0} 
            icon={<Clock size={22} />} 
            tone="orange" 
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="Saldo per Lokasi">
          {isLoading ? (
            <div className="flex justify-center py-8"><Spinner size={28} /></div>
          ) : locations.length === 0 ? (
            <EmptyState title="Belum ada rekening/kas" description="Tambahkan di menu Rekening & Kas." />
          ) : (
            <ul className="divide-y divide-suka-gray-100">
              {locations.map((l) => (
                <li key={l.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <span className={`rounded-lg px-2 py-1 text-xs font-bold ${l.kind === 'bank' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-suka-orange'}`}>
                      {l.kind === 'bank' ? 'BANK' : 'TUNAI'}
                    </span>
                    <div>
                      <p className="font-semibold text-suka-ink">{l.label}</p>
                      {l.bank_name && <p className="text-xs text-suka-gray-400">{l.bank_name} · {l.account_no}</p>}
                    </div>
                  </div>
                  <span className={`font-bold ${l.saldo < 0 ? 'text-red-600' : 'text-suka-ink'}`}>{rupiah(l.saldo)}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Aktivitas Terbaru">
          {loadingTx ? (
            <div className="flex justify-center py-8"><Spinner size={28} /></div>
          ) : txs.length === 0 ? (
            <EmptyState title="Belum ada transaksi" />
          ) : (
            <ul className="divide-y divide-suka-gray-100">
              {txs.slice(0, 8).map((t) => (
                <li key={t.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-suka-ink">
                      {t.cash_location?.label ?? '—'} · <span className="text-suka-gray-500">{t.category ?? t.source_type}</span>
                    </p>
                    <p className="text-xs text-suka-gray-400">{tanggal(t.occurred_at)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-bold ${t.direction === 'in' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {t.direction === 'in' ? '+' : '−'}{rupiah(t.amount)}
                    </span>
                    <TxStatusBadge status={t.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
