'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Card, Button, Input } from '@suka/design-system'
import { useSuratJalanActions } from '@/hooks/useSuratJalan'
import { useBahanBaku, type BahanBaku } from '@/hooks/useBahanBaku'
import type { CreateSuratJalanPayload } from '@/types/distribusi'

export function SuratJalanForm({ outletId }: { outletId: string }) {
  const router = useRouter()
  const { create } = useSuratJalanActions()
  const { bahanBaku } = useBahanBaku()
  const [busy, setBusy] = useState(false)
  const [items, setItems] = useState<Array<{ bahan_baku_id: string; qty_dikirim: string }>>([])

  const addItem = () => {
    setItems([...items, { bahan_baku_id: '', qty_dikirim: '' }])
  }

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx))
  }

  const updateItem = (idx: number, field: string, value: string) => {
    const updated = [...items]
    updated[idx] = { ...updated[idx], [field]: value }
    setItems(updated)
  }

  const canSubmit = items.length > 0 && items.every(it => it.bahan_baku_id && it.qty_dikirim)

  const submit = async () => {
    setBusy(true)
    try {
      const payload: CreateSuratJalanPayload = {
        outlet_id: outletId,
        items: items.map(it => ({
          bahan_baku_id: it.bahan_baku_id,
          qty_dikirim: Number(it.qty_dikirim),
        })),
      }
      const sj = await create(payload.outlet_id, payload.items)
      router.push(`/distribusi/surat-jalan/${sj.id}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <Card className="p-4 space-y-3">
        <h3 className="font-semibold">Item yang dikirim</h3>
        {items.map((it, idx) => (
          <div key={idx} className="flex gap-3">
            <select
              className="flex-1 border rounded p-2"
              value={it.bahan_baku_id}
              onChange={e => updateItem(idx, 'bahan_baku_id', e.target.value)}
            >
              <option value="">— Pilih bahan baku —</option>
              {bahanBaku.map((b: BahanBaku) => (
                <option key={b.id} value={b.id}>
                  {b.nama}
                </option>
              ))}
            </select>
            <Input
              type="number"
              className="w-28"
              placeholder="Qty"
              value={it.qty_dikirim}
              onChange={e => updateItem(idx, 'qty_dikirim', e.target.value)}
            />
            <Button variant="secondary" onClick={() => removeItem(idx)}>
              Hapus
            </Button>
          </div>
        ))}
        <Button variant="secondary" onClick={addItem}>
          + Tambah Item
        </Button>
      </Card>

      <Button disabled={!canSubmit || busy} onClick={submit} className="w-full">
        {busy ? 'Menyimpan…' : 'Buat Surat Jalan'}
      </Button>
    </div>
  )
}
