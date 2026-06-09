'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Button, Input } from '@suka/design-system'
import { useBahanBaku } from '@/hooks/useBahanBaku'
import { useLedgerActions } from '@/hooks/useLedger'

const TIPE_OPTIONS = [
  { value: 'waste', label: 'Waste (buang)' },
  { value: 'adjustment', label: 'Penyesuaian' },
  { value: 'transfer_keluar', label: 'Transfer Keluar' },
] as const

export function ManualEntryForm({ outletId, createdBy }: { outletId: string; createdBy: string }) {
  const router = useRouter()
  const { bahanBaku } = useBahanBaku()
  const { addManual } = useLedgerActions()
  const [bahanBakuId, setBahanBakuId] = useState('')
  const [tipe, setTipe] = useState<'waste'|'adjustment'|'transfer_keluar'>('waste')
  const [qty, setQty] = useState('')
  const [catatan, setCatatan] = useState('')
  const [busy, setBusy] = useState(false)

  const needsReason = tipe === 'adjustment'
  const isValidQty = qty !== '' && !isNaN(Number(qty)) && Number(qty) > 0
  const valid = bahanBakuId && isValidQty && (!needsReason || catatan.trim() !== '')

  async function submit() {
    setBusy(true)
    try {
      await addManual({
        outletId, bahanBakuId, tipe,
        qtyAbs: Math.abs(Number(qty)),
        catatan, createdBy,
      }, tipe === 'adjustment' ? Number(qty) : undefined)
      router.push('/stok/ledger')
    } finally { setBusy(false) }
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex gap-2">
        {TIPE_OPTIONS.map(o => (
          <Button key={o.value} variant={tipe===o.value?'primary' as any:'secondary' as any}
            onClick={()=>setTipe(o.value)}>{o.label}</Button>
        ))}
      </div>
      <select className="w-full border rounded p-2" value={bahanBakuId}
        onChange={e=>setBahanBakuId(e.target.value)}>
        <option value="">— Pilih bahan baku —</option>
        {bahanBaku.map(b => <option key={b.id} value={b.id}>{b.nama} ({b.satuan})</option>)}
      </select>
      <Input type="number" inputMode="decimal"
        placeholder={tipe==='adjustment'?'Qty (boleh negatif)':'Qty'}
        value={qty} onChange={e=>setQty(e.target.value)} />
      <Input placeholder={needsReason?'Alasan (wajib)':'Catatan'}
        value={catatan} onChange={e=>setCatatan(e.target.value)} />
      <Button disabled={!valid || busy} onClick={submit} className="w-full">
        {busy?'Menyimpan…':'Simpan Entri'}
      </Button>
    </Card>
  )
}
