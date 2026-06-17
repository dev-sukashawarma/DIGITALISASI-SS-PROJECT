'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Button, Input } from '@suka/design-system'
import type { SaranItem } from '@/hooks/usePermintaan'
import { useSaranItem, usePermintaanActions } from '@/hooks/usePermintaan'
import { useBahanBaku } from '@/hooks/useBahanBaku'

interface Row {
  bahan_baku_id: string
  nama: string
  satuan: string
  qty: string
  checked: boolean
  source: 'saran' | 'manual'
}

export function PermintaanForm({ outletId }: { outletId: string }) {
  const router = useRouter()
  const { saran } = useSaranItem(outletId)
  const { bahanBaku } = useBahanBaku()
  const { buat } = usePermintaanActions()
  const [rows, setRows] = useState<Record<string, Row>>({})
  const [pickId, setPickId] = useState('')
  const [busy, setBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Seed baris dari saran (qty default = kekurangan ke threshold). Tidak menimpa
  // baris yang sudah diutak-atik user atau baris manual.
  useEffect(() => {
    if (saran.length === 0) return
    setRows(prev => {
      let changed = false
      const next = { ...prev }
      saran.forEach((s: SaranItem) => {
        if (next[s.bahan_baku_id]) return
        const def = Math.max(1, Math.ceil(s.threshold - s.current_qty))
        next[s.bahan_baku_id] = {
          bahan_baku_id: s.bahan_baku_id, nama: s.item_name, satuan: s.satuan,
          qty: String(def), checked: true, source: 'saran',
        }
        changed = true
      })
      // Penting: kembalikan ref lama bila tak ada item baru, agar tidak memicu
      // re-render → effect jalan lagi (saran kerap punya ref array baru tiap render).
      return changed ? next : prev
    })
  }, [saran])

  function setRow(id: string, patch: Partial<Row>) {
    setRows(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  function removeRow(id: string) {
    setRows(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  function addManual() {
    if (!pickId) return
    const bb = bahanBaku.find(b => b.id === pickId)
    if (!bb || rows[bb.id]) { setPickId(''); return }
    setRows(prev => ({
      ...prev,
      [bb.id]: {
        bahan_baku_id: bb.id, nama: bb.nama, satuan: bb.satuan,
        qty: '1', checked: true, source: 'manual',
      },
    }))
    setPickId('')
  }

  const allRows = Object.values(rows)
  const saranRows = allRows.filter(r => r.source === 'saran')
  const manualRows = allRows.filter(r => r.source === 'manual')
  const selected = allRows.filter(r => r.checked && Number(r.qty) > 0)
  const valid = selected.length > 0 && !busy

  // Item yang belum ada di form, untuk dropdown tambah manual
  const available = bahanBaku.filter(b => !rows[b.id])

  async function submit() {
    setBusy(true); setErrorMsg(null); setSuccessMsg(null)
    try {
      await buat(outletId, selected.map(r => ({
        bahan_baku_id: r.bahan_baku_id, qty_diminta: Number(r.qty),
      })))
      // eslint-disable-next-line no-console
      console.log('[buat_permintaan] SUKSES, mereset form...')
      // Reset form & tampilkan notif sukses
      setRows({})
      setSuccessMsg(`Permintaan berhasil dikirim (${selected.length} item). Menunggu persetujuan.`)
      router.refresh() // paksa server components refresh agar list terupdate
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }

  function renderRow(r: Row) {
    return (
      <label key={r.bahan_baku_id} className="flex items-center gap-3 border border-[#d9c2b2]/40 rounded-xl px-3 py-2 cursor-pointer">
        <input
          type="checkbox"
          checked={r.checked}
          onChange={e => setRow(r.bahan_baku_id, { checked: e.target.checked })}
          aria-label={`Request ${r.nama}`}
        />
        <span className="flex-1 text-xs font-semibold text-[#1e1b15]">{r.nama}</span>
        <Input
          type="number"
          inputMode="decimal"
          value={r.qty}
          onChange={e => setRow(r.bahan_baku_id, { qty: e.target.value })}
          className="w-24 px-3 py-1.5 border border-[#d9c2b2]/40 rounded-lg text-xs"
          aria-label={`Qty ${r.nama}`}
        />
        <span className="text-[10px] text-[#544437]/60 w-8">{r.satuan}</span>
        {r.source === 'manual' && (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); removeRow(r.bahan_baku_id) }}
            className="text-[#ba1a1a] text-sm font-bold px-1 leading-none"
            aria-label={`Hapus ${r.nama}`}
          >
            ×
          </button>
        )}
      </label>
    )
  }

  return (
    <Card className="p-6 border border-[#d9c2b2]/45 rounded-2xl shadow-sm space-y-4 bg-white">
      <h2 className="text-xs font-bold text-[#544437]/75 uppercase tracking-wide">Item Menipis / Kritis</h2>
      {saranRows.length === 0 && (
        <p className="text-xs text-[#544437]/60">Tidak ada item di bawah threshold. Stok aman.</p>
      )}
      <div className="space-y-2">
        {saranRows.map(renderRow)}
      </div>

      {/* Tambah item lain secara manual */}
      <div className="space-y-2 pt-2 border-t border-[#d9c2b2]/40">
        <h2 className="text-xs font-bold text-[#544437]/75 uppercase tracking-wide">Tambah Item Lain</h2>
        {manualRows.length > 0 && <div className="space-y-2">{manualRows.map(renderRow)}</div>}
        <div className="flex items-center gap-2">
          <select
            value={pickId}
            onChange={e => setPickId(e.target.value)}
            className="flex-1 px-3 py-2 border border-[#d9c2b2]/40 rounded-lg text-xs bg-white text-[#1e1b15]"
            aria-label="Pilih bahan baku"
          >
            <option value="">— Pilih bahan baku —</option>
            {available.map(b => (
              <option key={b.id} value={b.id}>{b.nama} ({b.satuan})</option>
            ))}
          </select>
          <Button
            type="button"
            disabled={!pickId}
            onClick={addManual}
            className="bg-[#544437] hover:bg-[#3a2f26] text-white font-bold px-4 py-2 rounded-lg text-xs uppercase tracking-wider disabled:opacity-40"
          >
            Tambah
          </Button>
        </div>
      </div>

      {successMsg && (
        <p className="text-xs font-bold text-[#1e6b3a] bg-[#d6f5e3] border border-[#1e6b3a]/20 p-3 rounded-xl">
          ✅ {successMsg}
        </p>
      )}
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
