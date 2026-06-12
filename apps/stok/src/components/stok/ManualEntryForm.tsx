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
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const needsReason = tipe === 'adjustment'
  const isValidQty = qty !== '' && !isNaN(Number(qty)) && Number(qty) > 0
  const valid = bahanBakuId && isValidQty && (!needsReason || catatan.trim() !== '')

  async function submit() {
    setBusy(true)
    setErrorMsg(null)
    try {
      await addManual({
        outletId, bahanBakuId, tipe,
        qtyAbs: Math.abs(Number(qty)),
        catatan, createdBy,
      }, tipe === 'adjustment' ? Number(qty) : undefined)
      router.push('/stok/ledger')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
    } finally { setBusy(false) }
  }

  return (
    <Card className="p-6 border border-[#d9c2b2]/45 rounded-2xl shadow-[0px_4px_12px_rgba(144,77,0,0.03)] space-y-5 bg-white">
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold text-[#544437]/75 uppercase tracking-wide">Tipe Transaksi</label>
        <div className="grid grid-cols-3 gap-2">
          {TIPE_OPTIONS.map(o => {
            const isActive = tipe === o.value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => setTipe(o.value)}
                className={`py-2 px-3 rounded-xl font-bold text-[10px] uppercase tracking-wider text-center transition-all duration-150 cursor-pointer shadow-sm active:scale-95 ${
                  isActive
                    ? 'bg-[#701604] border border-[#701604] text-white'
                    : 'bg-white border border-[#d9c2b2]/40 text-[#701604]/80 hover:bg-[#fff8f1]/50'
                }`}
              >
                {o.label.split(' ')[0]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold text-[#544437]/75 uppercase tracking-wide">Bahan Baku</label>
        <select
          className="w-full border border-[#d9c2b2]/40 rounded-xl px-4 py-2.5 bg-white focus:outline-none focus:ring-1 focus:ring-[#f29744] focus:border-[#f29744] text-xs text-[#1e1b15] font-medium transition-all shadow-sm cursor-pointer"
          value={bahanBakuId}
          onChange={e => setBahanBakuId(e.target.value)}
        >
          <option value="">— Pilih bahan baku —</option>
          {bahanBaku.map(b => <option key={b.id} value={b.id}>{b.nama} ({b.satuan})</option>)}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold text-[#544437]/75 uppercase tracking-wide">Kuantitas</label>
        <Input
          type="number"
          inputMode="decimal"
          placeholder={tipe === 'adjustment' ? 'Qty (boleh negatif)' : 'Qty'}
          value={qty}
          onChange={e => setQty(e.target.value)}
          className="px-4 py-2.5 border border-[#d9c2b2]/40 rounded-xl bg-white text-xs text-[#1e1b15] placeholder-[#544437]/40 focus:outline-none focus:ring-1 focus:ring-[#f29744] focus:border-[#f29744] transition-all shadow-sm"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold text-[#544437]/75 uppercase tracking-wide">Keterangan</label>
        <Input
          placeholder={needsReason ? 'Alasan penyesuaian (wajib)' : 'Catatan tambahan'}
          value={catatan}
          onChange={e => setCatatan(e.target.value)}
          className="px-4 py-2.5 border border-[#d9c2b2]/40 rounded-xl bg-white text-xs text-[#1e1b15] placeholder-[#544437]/40 focus:outline-none focus:ring-1 focus:ring-[#f29744] focus:border-[#f29744] transition-all shadow-sm"
        />
      </div>

      {errorMsg && <p className="text-xs font-bold text-[#ba1a1a] bg-[#ffdad6] border border-[#ba1a1a]/20 p-3 rounded-xl">{errorMsg}</p>}

      <Button
        disabled={!valid || busy}
        onClick={submit}
        className="w-full bg-[#f29744] hover:bg-orange-600 active:bg-orange-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-sm text-xs uppercase tracking-wider active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
      >
        {busy ? 'Menyimpan…' : 'Simpan Entri'}
      </Button>
    </Card>
  )
}
