'use client'
import { useEffect, useState } from 'react'
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
  current_qty?: number
  threshold?: number
}

export function PermintaanForm({ outletId, onSubmitSuccess }: { outletId: string; onSubmitSuccess?: () => void }) {
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
          bahan_baku_id: s.bahan_baku_id,
          nama: s.item_name,
          satuan: s.satuan,
          qty: String(def),
          checked: true,
          source: 'saran',
          current_qty: s.current_qty,
          threshold: s.threshold,
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
        bahan_baku_id: bb.id,
        nama: bb.nama,
        satuan: bb.satuan,
        qty: '1',
        checked: true,
        source: 'manual',
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

  const handleDismissSuccess = () => {
    setSuccessMsg(null)
  }

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

      // Trigger callback untuk refresh list
      if (onSubmitSuccess) {
        onSubmitSuccess()
      }

      // Scroll ke atas agar user lihat form yang ter-reset dan bisa tambah lagi
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }

  function renderRow(r: Row) {
    const handleMinus = () => {
      const currentVal = Number(r.qty) || 0
      if (currentVal > 0) {
        setRow(r.bahan_baku_id, { qty: String(currentVal - 1) })
      }
    }

    const handlePlus = () => {
      const currentVal = Number(r.qty) || 0
      setRow(r.bahan_baku_id, { qty: String(currentVal + 1) })
    }

    return (
      <div key={r.bahan_baku_id} className="bg-white border border-[#d9c2b2]/60 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex gap-4">
            <input
              type="checkbox"
              checked={r.checked}
              onChange={e => setRow(r.bahan_baku_id, { checked: e.target.checked })}
              className="mt-1 w-6 h-6 rounded-md border-[#d9c2b2] text-[#f29744] focus:ring-[#f29744]"
              aria-label={`Request ${r.nama}`}
            />
            <div className="space-y-1">
              <p className="font-bold text-[#1e1b15] text-base">{r.nama}</p>
              {r.current_qty !== undefined && r.threshold !== undefined && (
                <div className="flex gap-3 text-[12px] font-medium tracking-tight">
                  <span className="text-[#544437]">
                    Sisa: <span className="text-[#ba1a1a] font-bold">{r.current_qty} {r.satuan}</span>
                  </span>
                  <span className="text-[#544437]/60">Threshold: {r.threshold} {r.satuan}</span>
                </div>
              )}
            </div>
          </div>
          {r.source === 'manual' && (
            <button
              type="button"
              onClick={() => removeRow(r.bahan_baku_id)}
              className="text-[#ba1a1a] text-lg font-bold hover:opacity-80 transition"
              aria-label={`Hapus ${r.nama}`}
            >
              ×
            </button>
          )}
        </div>
        
        <div className="flex items-center justify-between border-t border-[#d9c2b2]/20 pt-4">
          <span className="text-xs font-semibold text-[#544437]">Jumlah Permintaan ({r.satuan})</span>
          <div className="flex items-center bg-[#faf2e9] border border-[#d9c2b2]/30 rounded-xl px-1 py-1">
            <button
              type="button"
              onClick={handleMinus}
              className="w-10 h-10 flex items-center justify-center text-[#904d00] hover:bg-[#efe7dd] rounded-lg transition-colors font-bold text-xl"
            >
              -
            </button>
            <input
              type="number"
              inputMode="decimal"
              value={r.qty}
              onChange={e => setRow(r.bahan_baku_id, { qty: e.target.value })}
              className="w-14 bg-transparent border-none text-center font-bold text-[#1e1b15] focus:ring-0 p-0 text-base"
              aria-label={`Qty ${r.nama}`}
            />
            <button
              type="button"
              onClick={handlePlus}
              className="w-10 h-10 flex items-center justify-center text-[#904d00] hover:bg-[#efe7dd] rounded-lg transition-colors font-bold text-xl"
            >
              +
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Item Kritis Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-[#544437] flex items-center gap-2 tracking-wide uppercase">
            <svg className="w-4 h-4 text-[#ba1a1a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            ITEM MENIPIS / KRITIS
          </h2>
          {saranRows.length > 0 && (
            <span className="text-[10px] bg-[#ffdad6] text-[#ba1a1a] px-2.5 py-0.5 rounded-full font-bold uppercase">
              {saranRows.length} PERLU DIISI
            </span>
          )}
        </div>

        {saranRows.length === 0 ? (
          <div className="bg-white border border-[#d9c2b2]/40 rounded-2xl p-5 text-center shadow-sm">
            <p className="text-xs text-[#544437]/60">Tidak ada item di bawah threshold. Stok aman.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {saranRows.map(renderRow)}
          </div>
        )}
      </section>

      {/* Tambah item lain secara manual */}
      <section className="space-y-3 pt-4 border-t border-[#d9c2b2]/20">
        <h2 className="text-xs font-bold text-[#544437]/75 uppercase tracking-wide">Tambah Item Lain</h2>
        {manualRows.length > 0 && <div className="space-y-3">{manualRows.map(renderRow)}</div>}
        <div className="flex items-center gap-2">
          <select
            value={pickId}
            onChange={e => setPickId(e.target.value)}
            className="flex-1 px-3 py-3 border border-[#d9c2b2]/40 rounded-xl text-xs bg-white text-[#1e1b15] focus:ring-2 focus:ring-[#f29744]/50 focus:border-[#f29744]"
            aria-label="Pilih bahan baku"
          >
            <option value="">— Pilih bahan baku —</option>
            {available.map(b => (
              <option key={b.id} value={b.id}>{b.nama} ({b.satuan})</option>
            ))}
          </select>
          <button
            type="button"
            disabled={!pickId}
            onClick={addManual}
            className="bg-[#544437] hover:bg-[#3a2f26] active:scale-95 transition-all text-white font-bold px-4 py-3 rounded-xl text-xs uppercase tracking-wider disabled:opacity-40 disabled:pointer-events-none"
          >
            Tambah
          </button>
        </div>
      </section>

      {successMsg && (
        <div className="text-xs font-bold text-[#1e6b3a] bg-[#d6f5e3] border border-[#1e6b3a]/20 p-3 rounded-xl flex items-center justify-between gap-3">
          <span>✅ {successMsg}</span>
          <button
            type="button"
            onClick={handleDismissSuccess}
            className="text-[#1e6b3a] hover:opacity-70 transition flex-shrink-0"
            aria-label="Tutup pesan sukses"
          >
            ✕
          </button>
        </div>
      )}
      {errorMsg && (
        <div className="text-xs font-bold text-[#ba1a1a] bg-[#ffdad6] border border-[#ba1a1a]/20 p-3 rounded-xl flex items-center justify-between gap-3">
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-[#ba1a1a] hover:opacity-70 transition flex-shrink-0"
            aria-label="Tutup pesan error"
          >
            ✕
          </button>
        </div>
      )}

      {/* Kirim Button */}
      <div className="pt-2">
        <button
          disabled={!valid}
          onClick={submit}
          className="w-full bg-[#f29744] hover:bg-[#e0873a] active:scale-[0.98] transition-all duration-150 text-white py-4 px-6 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-md shadow-orange-200 disabled:opacity-40 disabled:pointer-events-none h-14 text-xs uppercase tracking-wider"
        >
          <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
          {busy ? 'Mengirim…' : `Kirim Permintaan (${selected.length} item)`}
        </button>
      </div>
    </div>
  )
}
