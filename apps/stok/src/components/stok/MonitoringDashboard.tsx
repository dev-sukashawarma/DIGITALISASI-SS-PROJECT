'use client'
import { useMemo } from 'react'
import { Card, Button } from '@suka/design-system'
import { useBahanBaku } from '@/hooks/useBahanBaku'
import { useStokBalance } from '@/hooks/useStokBalance'
import { stokStatus } from '@/lib/stok/status'
import { StokStatusBadge } from './StokStatusBadge'
import type { StokLevel } from '@/types/stok'

const ORDER: Record<StokLevel, number> = { kritis: 0, menipis: 1, unknown: 2, aman: 3 }

export function MonitoringDashboard({ outletId }: { outletId: string }) {
  const { bahanBaku } = useBahanBaku()
  const { balances, loading, refresh } = useStokBalance(outletId)

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
        <Button variant={'secondary' as any} onClick={refresh}>↻ Refresh</Button>
      </div>
      {loading ? <p>Memuat…</p> : (
        <div className="space-y-2">
          {rows.map(({ b, saldo, level }) => (
            <Card key={b.id} className="p-3 flex justify-between items-center">
              <div>
                <p className="font-medium">{b.nama}</p>
                <p className="text-xs text-gray-500">
                  {saldo} {b.satuan} · batas {b.default_reorder_point || '—'}
                </p>
              </div>
              <StokStatusBadge level={level} />
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
