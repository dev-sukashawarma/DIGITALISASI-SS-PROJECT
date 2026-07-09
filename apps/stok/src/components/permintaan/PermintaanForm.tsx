'use client'
import { useEffect, useState } from 'react'
import type { SaranItem } from '@/hooks/usePermintaan'
import { useSaranItem, usePermintaanActions, usePermintaanList } from '@/hooks/usePermintaan'
import { useBahanBaku } from '@/hooks/useBahanBaku'
import { TargetMenuCalculator } from './TargetMenuCalculator'
import type { CalculatedBahan } from '@/app/actions/permintaan_target'

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
  const { permintaan: existingList, refresh: refreshExisting } = usePermintaanList(outletId)
  const [rows, setRows] = useState<Record<string, Row>>({})
  const [pickId, setPickId] = useState('')
  const [busy, setBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  
  const [activeTab, setActiveTab] = useState<'target' | 'manual'>('target')

  const pendingItemIds = new Set(
    existingList
      .filter(p => p.status === 'menunggu')
      .flatMap(p => p.items.map(it => it.bahan_baku_id))
  )

  useEffect(() => {
    if (saran.length === 0) return
    setRows(prev => {
      let changed = false
      const next = { ...prev }
      saran.forEach((s: SaranItem) => {
        if (next[s.bahan_baku_id]) return
        if (pendingItemIds.has(s.bahan_baku_id)) return
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
      return changed ? next : prev
    })
  }, [saran])

  function handleCalculated(items: CalculatedBahan[]) {
    if (items.length === 0) return
    setRows(prev => {
      const next = { ...prev }
      items.forEach(it => {
        if (pendingItemIds.has(it.bahan_baku_id)) return
        const qty = it.saran_qty
        const shouldCheck = qty > 0
        if (!next[it.bahan_baku_id]) {
          next[it.bahan_baku_id] = {
            bahan_baku_id: it.bahan_baku_id,
            nama: it.nama_bahan,
            satuan: it.satuan,
            qty: String(qty),
            checked: shouldCheck,
            source: 'manual',
            current_qty: it.sisa_stok,
            threshold: undefined,
          }
        } else {
          next[it.bahan_baku_id].qty = String(Number(next[it.bahan_baku_id].qty) + qty)
          if (qty > 0) next[it.bahan_baku_id].checked = true
        }
      })
      return next
    })
    setActiveTab('manual')
  }

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
    if (!bb || rows[bb.id] || pendingItemIds.has(bb.id)) { setPickId(''); return }
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

  const available = bahanBaku.filter(b => !rows[b.id] && !pendingItemIds.has(b.id))

  const handleDismissSuccess = () => {
    setSuccessMsg(null)
  }

  async function submit() {
    setBusy(true); setErrorMsg(null); setSuccessMsg(null)
    try {
      await buat(outletId, selected.map(r => ({
        bahan_baku_id: r.bahan_baku_id, qty_diminta: Number(r.qty),
      })))
      setRows({})
      setSuccessMsg(`Permintaan berhasil dikirim (${selected.length} item). Menunggu persetujuan.`)
      refreshExisting()
      if (onSubmitSuccess) onSubmitSuccess()
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
              {r.current_qty !== undefined && (
                <div className="flex gap-3 text-[12px] font-medium tracking-tight">
                  <span className="text-[#544437]">
                    Sisa: <span className="text-[#ba1a1a] font-bold">{r.current_qty} {r.satuan}</span>
                  </span>
                  {r.threshold !== undefined && (
                    <span className="text-[#544437]/60">Threshold: {r.threshold} {r.satuan}</span>
                  )}
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
      {pendingItemIds.size > 0 && (
        <div className="text-xs font-bold text-[#6d3900] bg-[#ffdcc2] border border-[#6d3900]/20 p-3 rounded-xl">
          ⏳ {pendingItemIds.size} item sudah punya permintaan yang menunggu persetujuan SPV — tidak ditampilkan lagi di sini sampai disetujui/ditolak.
        </div>
      )}

      {/* TABS */}
      <div className="flex bg-[#efe7dd] p-1 rounded-xl">
        <button
          className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg transition-all ${activeTab === 'target' ? 'bg-white shadow-sm text-[#701604]' : 'text-[#544437]/60'}`}
          onClick={() => setActiveTab('target')}
        >
          Target Menu
        </button>
        <button
          className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg transition-all ${activeTab === 'manual' ? 'bg-white shadow-sm text-[#701604]' : 'text-[#544437]/60'}`}
          onClick={() => setActiveTab('manual')}
        >
          Draft / Manual
        </button>
      </div>

      {activeTab === 'target' ? (
        <TargetMenuCalculator outletId={outletId} onCalculated={handleCalculated} />
      ) : (
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
            <h2 className="text-xs font-bold text-[#544437]/75 uppercase tracking-wide">Draft Request & Manual</h2>
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
      )}
    </div>
  )
}
