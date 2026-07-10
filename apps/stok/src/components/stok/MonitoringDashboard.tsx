'use client'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, Button } from '@suka/design-system'
import { useBahanBaku } from '@/hooks/useBahanBaku'
import { useStokBalance } from '@/hooks/useStokBalance'
import { stokStatus } from '@/lib/stok/status'
import { StokStatusBadge } from './StokStatusBadge'
import { WasteModal } from './WasteModal'
import { fetchPendingWasteReports } from '@/app/actions/waste'
import type { StokLevel, BahanBaku } from '@/types/stok'

const ORDER: Record<StokLevel, number> = { kritis: 0, menipis: 1, unknown: 2, aman: 3 }

export function MonitoringDashboard({ outletId }: { outletId: string }) {
  const { bahanBaku } = useBahanBaku()
  const { balances, loading, refresh } = useStokBalance(outletId)
  
  const [selectedBahan, setSelectedBahan] = useState<BahanBaku | null>(null)

  const { data: pendingWaste, refetch: refetchWaste } = useQuery({
    queryKey: ['waste_pending', outletId],
    queryFn: () => fetchPendingWasteReports(outletId),
    refetchInterval: 30000
  })

  const pendingWasteSet = useMemo(() => {
    const set = new Set<string>()
    if (pendingWaste) {
      pendingWaste.forEach(w => set.add(w.bahan_baku_id))
    }
    return set
  }, [pendingWaste])

  const rows = useMemo(() => {
    const saldoOf: Record<string, number> = {}
    for (const b of balances) saldoOf[b.bahan_baku_id] = b.saldo
    return bahanBaku
      .map(b => {
        const saldo = saldoOf[b.id] ?? 0
        const level = stokStatus(saldo, b.default_reorder_point)
        return { b, saldo, level }
      })
      .sort((x, y) => ORDER[x.level] - ORDER[y.level])
  }, [bahanBaku, balances])

  const kritisCount = rows.filter(r => r.level === 'kritis').length

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm">
          {kritisCount > 0
            ? <span className="text-red-600 font-bold">⚠️ {kritisCount} bahan kritis</span>
            : <span className="text-green-700">Semua stok aman</span>}
        </p>
        <Button variant={'secondary' as any} onClick={() => { refresh(); refetchWaste(); }}>↻ Refresh</Button>
      </div>
      {loading ? <p>Memuat…</p> : (
        <div className="space-y-2">
          {rows.map(({ b, saldo, level }) => {
            const isPendingWaste = pendingWasteSet.has(b.id)
            return (
              <Card key={b.id} className="p-3 flex justify-between items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{b.nama}</p>
                    {isPendingWaste && (
                      <span className="bg-yellow-100 text-yellow-800 text-xs font-semibold px-2 py-0.5 rounded border border-yellow-200">
                        Waste Pending
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    {saldo} {b.satuan} · batas {b.default_reorder_point || '—'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StokStatusBadge level={level} />
                  <Button variant="secondary" size="sm" onClick={() => setSelectedBahan(b)}>
                    Lapor Waste
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {selectedBahan && (
        <WasteModal
          outletId={outletId}
          bahanBaku={selectedBahan}
          onClose={() => setSelectedBahan(null)}
          onSuccess={() => {
            setSelectedBahan(null)
            refetchWaste()
          }}
        />
      )}
    </div>
  )
}
