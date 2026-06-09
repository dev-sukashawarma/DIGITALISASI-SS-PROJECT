'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Button, Input } from '@suka/design-system'
import { useBahanBaku } from '@/hooks/useBahanBaku'
import { useStokBalance } from '@/hooks/useStokBalance'
import { useOpnameActions } from '@/hooks/useOpname'
import { computeSelisih, isSelisihFlagged } from '@/lib/stok/selisih'

export function OpnameForm({ outletId, createdBy }: { outletId: string; createdBy: string }) {
  const router = useRouter()
  const { bahanBaku } = useBahanBaku()
  const { balances } = useStokBalance(outletId)
  const { createDraft, upsertItems, finalize } = useOpnameActions()
  const [tipe, setTipe] = useState('harian')
  const [fisik, setFisik] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  const saldoOf = useMemo(() => {
    const m: Record<string, number> = {}
    for (const b of balances) m[b.bahan_baku_id] = b.saldo
    return m
  }, [balances])

  async function handleFinalize() {
    setBusy(true)
    try {
      const opname = await createDraft(outletId, tipe, createdBy)
      const items = bahanBaku
        .filter(b => fisik[b.id] !== undefined && fisik[b.id] !== '')
        .map(b => {
          const qtyFisik = Number(fisik[b.id])
          const qtySystem = saldoOf[b.id] ?? 0
          const selisih = computeSelisih(qtyFisik, qtySystem)
          return {
            opname_id: opname.id, bahan_baku_id: b.id,
            qty_fisik: qtyFisik, qty_system: qtySystem,
            flagged: isSelisihFlagged(selisih, qtySystem),
          }
        })
      await upsertItems(items)
      const res = await finalize(opname.id)
      alert(res.queued ? 'Tersimpan, akan disinkron saat online' : 'Opname selesai disimpan')
      router.push('/stok/opname')
    } finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {['harian','mingguan','ad_hoc'].map(t => (
          <Button key={t} variant={tipe===t?'primary' as any:'secondary' as any}
            onClick={() => setTipe(t)}>{t}</Button>
        ))}
      </div>
      <div className="space-y-2">
        {bahanBaku.map(b => {
          const qtySystem = saldoOf[b.id] ?? 0
          const val = fisik[b.id] ?? ''
          const selisih = val === '' ? null : computeSelisih(Number(val), qtySystem)
          const flagged = selisih !== null && isSelisihFlagged(selisih, qtySystem)
          return (
            <Card key={b.id} className={`p-3 ${flagged ? 'border-2 border-red-400' : ''}`}>
              <div className="flex justify-between items-center gap-3">
                <div className="flex-1">
                  <p className="font-medium">{b.nama}</p>
                  <p className="text-xs text-gray-500">Sistem: {qtySystem} {b.satuan}</p>
                </div>
                <Input type="number" inputMode="decimal" className="w-24" placeholder="fisik"
                  value={val} onChange={e => setFisik(p => ({ ...p, [b.id]: e.target.value }))} />
                <div className="w-20 text-right text-sm">
                  {selisih !== null && (
                    <span className={flagged ? 'text-red-600 font-bold' : 'text-gray-600'}>
                      {selisih > 0 ? '+' : ''}{selisih}
                    </span>
                  )}
                </div>
              </div>
            </Card>
          )
        })}
      </div>
      <Input placeholder="Catatan (opsional)" value={notes} onChange={e => setNotes(e.target.value)} />
      <Button disabled={busy} onClick={handleFinalize} className="w-full">
        {busy ? 'Menyimpan…' : 'Finalisasi Opname'}
      </Button>
    </div>
  )
}
