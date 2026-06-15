'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Button, Input } from '@suka/design-system'
import type { SaranItem } from '@/hooks/usePermintaan'
import { useSaranItem, usePermintaanActions } from '@/hooks/usePermintaan'
import { useBahanBaku } from '@/hooks/useBahanBaku'

interface Row { bahan_baku_id: string; nama: string; satuan: string; qty: string; checked: boolean }

export function PermintaanForm({ outletId }: { outletId: string }) {
  const router = useRouter()
  const { saran } = useSaranItem(outletId)
  // bahanBaku reserved for future manual add-item picker
  const { bahanBaku: _bahanBaku } = useBahanBaku()
  const { buat } = usePermintaanActions()
  const [rows, setRows] = useState<Record<string, Row>>({})
  const [busy, setBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Inisialisasi baris dari saran (qty default = kekurangan ke threshold)
  const saranRows: Row[] = saran.map((s: SaranItem) => {
    const existing = rows[s.bahan_baku_id]
    const def = Math.max(1, Math.ceil(s.threshold - s.current_qty))
    return existing ?? {
      bahan_baku_id: s.bahan_baku_id, nama: s.item_name, satuan: s.satuan,
      qty: String(def), checked: true,
    }
  })

  function setRow(id: string, patch: Partial<Row>, base?: Row) {
    setRows(prev => ({ ...prev, [id]: { ...(prev[id] ?? base!), ...patch } }))
  }

  const selected = saranRows.filter(r => r.checked && Number(r.qty) > 0)
  const valid = selected.length > 0 && !busy

  async function submit() {
    setBusy(true); setErrorMsg(null)
    try {
      await buat(outletId, selected.map(r => ({
        bahan_baku_id: r.bahan_baku_id, qty_diminta: Number(r.qty),
      })))
      router.push('/stok/permintaan')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }

  return (
    <Card className="p-6 border border-[#d9c2b2]/45 rounded-2xl shadow-sm space-y-4 bg-white">
      <h2 className="text-xs font-bold text-[#544437]/75 uppercase tracking-wide">Item Menipis / Kritis</h2>
      {saranRows.length === 0 && (
        <p className="text-xs text-[#544437]/60">Tidak ada item di bawah threshold. Stok aman.</p>
      )}
      <div className="space-y-2">
        {saranRows.map(r => (
          <label key={r.bahan_baku_id} className="flex items-center gap-3 border border-[#d9c2b2]/40 rounded-xl px-3 py-2 cursor-pointer">
            <input
              type="checkbox"
              checked={r.checked}
              onChange={e => setRow(r.bahan_baku_id, { checked: e.target.checked }, r)}
              aria-label={`Request ${r.nama}`}
            />
            <span className="flex-1 text-xs font-semibold text-[#1e1b15]">{r.nama}</span>
            <Input
              type="number"
              inputMode="decimal"
              value={r.qty}
              onChange={e => setRow(r.bahan_baku_id, { qty: e.target.value }, r)}
              className="w-24 px-3 py-1.5 border border-[#d9c2b2]/40 rounded-lg text-xs"
              aria-label={`Qty ${r.nama}`}
            />
            <span className="text-[10px] text-[#544437]/60 w-8">{r.satuan}</span>
          </label>
        ))}
      </div>

      {errorMsg && <p className="text-xs font-bold text-[#ba1a1a] bg-[#ffdad6] border border-[#ba1a1a]/20 p-3 rounded-xl">{errorMsg}</p>}

      <Button
        disabled={!valid}
        onClick={submit}
        className="w-full bg-[#f29744] hover:bg-orange-600 text-white font-bold py-3.5 rounded-xl text-xs uppercase tracking-wider disabled:opacity-40"
      >
        {busy ? 'Mengirim…' : `Kirim Permintaan (${selected.length} item)`}
      </Button>
    </Card>
  )
}
