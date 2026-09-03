'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Button, Input } from '@suka/design-system'
import { useBahanBaku } from '@/hooks/useBahanBaku'
import { useLedgerActions } from '@/hooks/useLedger'
import { useStokBalance } from '@/hooks/useStokBalance'
import { createClient } from '@/lib/supabase'
import { submitWasteReport } from '@/app/actions/waste'
import { formatTriUnitSaldoAdaptive, convertBesarToGram } from '@/lib/format/compositeUnit'

const TIPE_OPTIONS = [
  { value: 'waste', label: 'Waste (buang)' },
  { value: 'adjustment', label: 'Penyesuaian' },
  { value: 'transfer_keluar', label: 'Transfer Keluar' },
] as const

export interface DraftItem {
  id: string
  bahanBakuId: string
  bahanBakuNama: string
  satuan: string
  tipe: 'waste' | 'adjustment' | 'transfer_keluar'
  targetSaldo?: number
  existingSaldo?: number
  delta?: number
  qtyInput?: string
  selectedUnitType?: 'besar' | 'tengah' | 'kecil'
  finalQty?: number
  file?: File | null
  catatanItem?: string
  summaryText: string
  adjDirection?: 'in' | 'out'
}

export function ManualEntryForm({ outletId, createdBy }: { outletId: string; createdBy: string }) {
  const router = useRouter()
  const { bahanBaku } = useBahanBaku()
  const { addManualBatch } = useLedgerActions()
  const { balances } = useStokBalance(outletId)

  // Current selector state
  const [bahanBakuId, setBahanBakuId] = useState('')
  const [tipe, setTipe] = useState<'waste'|'adjustment'|'transfer_keluar'>('adjustment')
  const [qty, setQty] = useState('')
  const [catatan, setCatatan] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [selectedUnitType, setSelectedUnitType] = useState<'besar'|'tengah'|'kecil'>('besar')
  const [adjDirection, setAdjDirection] = useState<'in'|'out'>('in')

  // Draft list for multiple items
  const [draftItems, setDraftItems] = useState<DraftItem[]>([])

  const selectedBahan = bahanBaku.find(b => b.id === bahanBakuId)
  const bal = balances.find(b => b.bahan_baku_id === bahanBakuId)
  const existingSaldo = bal?.saldo ?? 0

  const needsReason = tipe === 'adjustment' || tipe === 'waste'
  const qtyNum = Number(qty)

  const isCurrentValid = Boolean(bahanBakuId) && qty !== '' && !isNaN(qtyNum) && qtyNum > 0

  const isFormSubmittable = draftItems.length > 0 || (Boolean(bahanBakuId) && isCurrentValid && (!needsReason || catatan.trim() !== ''))

  function createDraftItemFromCurrentState(): DraftItem | null {
    if (!bahanBakuId || !selectedBahan) return null

    let finalQty = Number(qty)
    if (isNaN(finalQty) || finalQty <= 0) return null

    let unitName = selectedBahan.satuan as string
    if (selectedUnitType === 'kecil' && selectedBahan.faktor_tampilan) {
      finalQty = finalQty / selectedBahan.faktor_tampilan
      unitName = (selectedBahan.satuan_kecil ?? selectedBahan.satuan) as string
    } else if (selectedUnitType === 'tengah' && selectedBahan.faktor_tengah) {
      finalQty = finalQty / selectedBahan.faktor_tengah
      unitName = (selectedBahan.satuan_tengah ?? selectedBahan.satuan) as string
    }

    // finalQty di atas SELALU besar-scale (dibagi faktor_tampilan/faktor_tengah
    // bila kecil/tengah dipilih). existingSaldo = bal?.saldo mentah -- kalau
    // baris ini sudah "meloncat" ke gram (bal.saldo_is_gram=true), delta yang
    // ditulis ke ledger_stok (dan dijumlahkan ke existingSaldo untuk preview
    // "Target") HARUS ikut dikonversi ke gram-scale dulu, atau tersimpan
    // dengan besaran salah faktor konversi (mis. "+350 Pack" tersimpan
    // sebagai +350 baris gram = +350 Lembar, bukan +7000 Lembar).
    const finalQtyLedgerScale = (bal?.saldo_is_gram)
      ? convertBesarToGram(finalQty, selectedBahan)
      : finalQty

    if (tipe === 'adjustment') {
      const delta = adjDirection === 'in' ? finalQtyLedgerScale : -finalQtyLedgerScale
      const targetSaldo = existingSaldo + delta

      const text = `Penyesuaian: ${adjDirection === 'in' ? 'Penambahan' : 'Pengurangan'} ${qty} ${unitName} -> Target: ${formatTriUnitSaldoAdaptive(
        targetSaldo,
        bal?.saldo_is_gram ?? false,
        selectedBahan.satuan,
        selectedBahan.satuan_tengah,
        selectedBahan.faktor_tengah,
        selectedBahan.satuan_kecil,
        selectedBahan.faktor_tampilan
      )}`

      return {
        id: Math.random().toString(36).slice(2),
        bahanBakuId,
        bahanBakuNama: selectedBahan.nama,
        satuan: selectedBahan.satuan,
        tipe: 'adjustment',
        targetSaldo,
        existingSaldo,
        delta,
        qtyInput: qty,
        selectedUnitType,
        finalQty,
        summaryText: text,
        catatanItem: catatan,
        adjDirection
      }
    } else {
      // Waste/transfer_keluar sama-sama butuh finalQtyLedgerScale (bukan
      // finalQty besar-scale mentah) sebagai qty yang benar-benar dikurangi --
      // finalQty tetap dipakai apa adanya di teks ringkasan (murni tampilan).
      const text = `${qty} ${unitName} (${finalQty} ${selectedBahan.satuan})`

      return {
        id: Math.random().toString(36).slice(2),
        bahanBakuId,
        bahanBakuNama: selectedBahan.nama,
        satuan: selectedBahan.satuan,
        tipe,
        qtyInput: qty,
        selectedUnitType,
        finalQty,
        delta: finalQtyLedgerScale,
        file,
        summaryText: text,
        catatanItem: catatan,
      }
    }
  }

  function handleAddItem() {
    const newItem = createDraftItemFromCurrentState()
    if (!newItem) {
      setErrorMsg('Pilih bahan baku dan ubah kuantitas / penyesuaian terlebih dahulu.')
      return
    }

    setDraftItems(prev => [...prev, newItem])
    setBahanBakuId('')
    setQty('')
    setFile(null)
    setErrorMsg(null)
  }

  function handleRemoveItem(id: string) {
    setDraftItems(prev => prev.filter(item => item.id !== id))
  }

  async function submit() {
    setBusy(true)
    setErrorMsg(null)

    const itemsToSubmit: DraftItem[] = [...draftItems]

    if (bahanBakuId && isCurrentValid) {
      const currentItem = createDraftItemFromCurrentState()
      if (currentItem) {
        itemsToSubmit.push(currentItem)
      }
    }

    if (itemsToSubmit.length === 0) {
      setErrorMsg('Pilih bahan baku dan tentukan kuantitas / penyesuaian terlebih dahulu.')
      setBusy(false)
      return
    }

    const wasteWithoutFile = itemsToSubmit.find(i => i.tipe === 'waste' && !i.file)
    if (wasteWithoutFile) {
      setErrorMsg(`Foto bukti harus diunggah untuk laporan waste item: ${wasteWithoutFile.bahanBakuNama}`)
      setBusy(false)
      return
    }

    try {
      const wasteItems = itemsToSubmit.filter(i => i.tipe === 'waste')
      const nonWasteItems = itemsToSubmit.filter(i => i.tipe !== 'waste')

      for (const w of wasteItems) {
        if (w.file) {
          const supabase = createClient()
          const ext = w.file.name.split('.').pop()
          const fileName = `${outletId}/${w.bahanBakuId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('waste_evidence')
            .upload(fileName, w.file)

          if (uploadError) throw new Error('Gagal mengunggah foto waste: ' + uploadError.message)

          const photoUrl = supabase.storage.from('waste_evidence').getPublicUrl(uploadData.path).data.publicUrl

          // qty SELALU besar-scale mentah (bukan w.delta) -- stok_waste_reports
          // punya SATU-SATUNYA jalur ke ledger_stok (process_waste_report_approval
          // trigger saat admin approve), dan WasteModal.tsx (jalur laporan waste
          // lain, tak lewat form ini) JUGA mengirim besar-scale mentah tanpa
          // konversi apa pun. Konversi skala HARUS terjadi sekali di trigger DB
          // itu (titik temu kedua jalur), bukan di sini -- kalau di sini JUGA
          // dikonversi, entri dari form ini akan dikonversi dua kali begitu
          // trigger diperbaiki (2026-08-04 §4).
          const wasteRes = await submitWasteReport({
            outlet_id: outletId,
            bahan_baku_id: w.bahanBakuId,
            qty: w.finalQty ?? 0,
            reason: w.catatanItem || catatan || 'Waste',
            photo_url: photoUrl
          })
          if (!wasteRes.success) {
            throw new Error(wasteRes.error || 'Gagal menyimpan laporan waste')
          }
        }
      }

      if (nonWasteItems.length > 0) {
        const batchPayload = nonWasteItems.map(item => ({
          bahanBakuId: item.bahanBakuId,
          tipe: item.tipe,
          qtyAbs: Math.abs(item.delta ?? item.finalQty ?? 0),
          catatan: item.catatanItem || catatan,
          signedOverride: item.tipe === 'adjustment' ? item.delta : undefined
        }))

        await addManualBatch(outletId, createdBy, catatan, batchPayload)
      }

      router.push('/stok/ledger')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
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
        <label className="text-xs font-bold text-[#544437]/75 uppercase tracking-wide">Pilih Bahan Baku</label>
        <select
          className="w-full border border-[#d9c2b2]/40 rounded-xl px-4 py-2.5 bg-white focus:outline-none focus:ring-1 focus:ring-[#f29744] focus:border-[#f29744] text-xs text-[#1e1b15] font-medium transition-all shadow-sm cursor-pointer"
          value={bahanBakuId}
          onChange={e => {
            const newId = e.target.value
            setBahanBakuId(newId)
            setSelectedUnitType('besar')
          }}
        >
          <option value="">— Pilih bahan baku —</option>
          {bahanBaku.map(b => <option key={b.id} value={b.id}>{b.nama} ({b.satuan})</option>)}
        </select>
      </div>

      {bahanBakuId && selectedBahan && (
        <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl border text-xs font-bold ${existingSaldo <= 0 ? 'bg-[#ffdad6] border-[#ba1a1a]/20 text-[#ba1a1a]' : 'bg-[#e8f5e9] border-[#93f997]/40 text-[#006e24]'}`}>
          <span>Stok Existing System</span>
          <span>
            {formatTriUnitSaldoAdaptive(
              existingSaldo,
              bal?.saldo_is_gram ?? false,
              selectedBahan.satuan,
              selectedBahan.satuan_tengah,
              selectedBahan.faktor_tengah,
              selectedBahan.satuan_kecil,
              selectedBahan.faktor_tampilan
            )}
          </span>
        </div>
      )}

      {bahanBakuId && tipe === 'adjustment' && selectedBahan && (
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-[#544437]/75 uppercase tracking-wide">Arah Penyesuaian</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAdjDirection('in')}
              className={`py-2 px-3 rounded-xl font-bold text-[10px] uppercase tracking-wider text-center transition-all duration-150 cursor-pointer shadow-sm active:scale-95 ${
                adjDirection === 'in'
                  ? 'bg-emerald-600 border border-emerald-600 text-white'
                  : 'bg-white border border-[#d9c2b2]/40 text-[#544437]/80 hover:bg-emerald-50'
              }`}
            >
              + Penambahan Stok
            </button>
            <button
              type="button"
              onClick={() => setAdjDirection('out')}
              className={`py-2 px-3 rounded-xl font-bold text-[10px] uppercase tracking-wider text-center transition-all duration-150 cursor-pointer shadow-sm active:scale-95 ${
                adjDirection === 'out'
                  ? 'bg-rose-600 border border-rose-600 text-white'
                  : 'bg-white border border-[#d9c2b2]/40 text-[#544437]/80 hover:bg-rose-50'
              }`}
            >
              - Pengurangan Stok
            </button>
          </div>
        </div>
      )}

      {bahanBakuId && (
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-[#544437]/75 uppercase tracking-wide">Kuantitas</label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              inputMode="decimal"
              placeholder="Qty"
              value={qty}
              onChange={e => setQty(e.target.value)}
              className="flex-1 px-4 py-2.5 border border-[#d9c2b2]/40 rounded-xl bg-white text-xs text-[#1e1b15] placeholder-[#544437]/40 focus:outline-none focus:ring-1 focus:ring-[#f29744] focus:border-[#f29744] transition-all shadow-sm"
            />
            {selectedBahan && (
              <select
                value={selectedUnitType}
                onChange={e => setSelectedUnitType(e.target.value as 'besar'|'tengah'|'kecil')}
                className="px-4 py-2.5 border border-[#d9c2b2]/40 rounded-xl bg-white text-xs text-[#1e1b15] font-bold focus:outline-none focus:ring-1 focus:ring-[#f29744] focus:border-[#f29744] transition-all shadow-sm cursor-pointer min-w-[80px]"
              >
                <option value="besar">{selectedBahan.satuan}</option>
                {selectedBahan.satuan_tengah && selectedBahan.faktor_tengah ? (
                  <option value="tengah">{selectedBahan.satuan_tengah}</option>
                ) : null}
                {selectedBahan.satuan_kecil && selectedBahan.faktor_tampilan ? (
                  <option value="kecil">{selectedBahan.satuan_kecil}</option>
                ) : null}
              </select>
            )}
          </div>
        </div>
      )}

      {tipe === 'waste' && bahanBakuId && (
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-[#544437]/75 uppercase tracking-wide">Foto Bukti</label>
          <Input 
            type="file" 
            accept="image/*"
            capture="environment"
            onChange={e => setFile(e.target.files?.[0] || null)}
            className="px-4 py-2.5 border border-[#d9c2b2]/40 rounded-xl bg-white text-xs text-[#1e1b15] placeholder-[#544437]/40 focus:outline-none focus:ring-1 focus:ring-[#f29744] focus:border-[#f29744] transition-all shadow-sm cursor-pointer"
            required
          />
          <p className="text-[10px] font-medium text-[#544437]/60">Upload foto fisik barang yang rusak/terbuang.</p>
        </div>
      )}

      {/* Button to add item to draft list */}
      {bahanBakuId && (
        <button
          type="button"
          disabled={!isCurrentValid}
          onClick={handleAddItem}
          className="w-full py-3 bg-[#f29744] hover:bg-orange-600 active:scale-95 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
        >
          + Tambah ke Daftar Item
        </button>
      )}

      {/* Draft Items List */}
      {draftItems.length > 0 && (
        <div className="border-t border-[#d9c2b2]/40 pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#701604] uppercase tracking-wide">
              Daftar Item Entri ({draftItems.length})
            </h3>
            <button
              type="button"
              onClick={() => setDraftItems([])}
              className="text-[10px] font-bold text-[#ba1a1a] hover:underline cursor-pointer"
            >
              Hapus Semua
            </button>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {draftItems.map((item, idx) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 bg-[#fff8f1] border border-[#d9c2b2]/40 rounded-xl text-xs"
              >
                <div className="space-y-0.5 min-w-0 pr-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#1e1b15] truncate">{idx + 1}. {item.bahanBakuNama}</span>
                    <span
                      className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md ${
                        item.tipe === 'adjustment'
                          ? 'bg-amber-100 text-amber-800'
                          : item.tipe === 'waste'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {item.tipe === 'adjustment' ? 'Penyesuaian' : item.tipe === 'waste' ? 'Waste' : 'Transfer'}
                    </span>
                  </div>
                  <p className="text-[11px] font-medium text-[#544437]/80 truncate">{item.summaryText}</p>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveItem(item.id)}
                  className="shrink-0 text-gray-400 hover:text-[#ba1a1a] p-1 font-bold transition-colors cursor-pointer text-sm"
                  title="Hapus Item"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold text-[#544437]/75 uppercase tracking-wide">
          {tipe === 'waste' ? 'Alasan Waste' : 'Keterangan'}
        </label>
        {tipe === 'waste' ? (
          <select
            value={catatan}
            onChange={e => setCatatan(e.target.value)}
            className="px-4 py-2.5 border border-[#d9c2b2]/40 rounded-xl bg-white text-xs text-[#1e1b15] placeholder-[#544437]/40 focus:outline-none focus:ring-1 focus:ring-[#f29744] focus:border-[#f29744] transition-all shadow-sm"
          >
            <option value="" disabled>Pilih alasan...</option>
            <option value="Basi / Expired">Basi / Expired</option>
            <option value="Jatuh / Tumpah">Jatuh / Tumpah</option>
            <option value="Gosong / Rusak Masak">Gosong / Rusak Masak</option>
            <option value="Kualitas Buruk (dari supplier)">Kualitas Buruk (dari supplier)</option>
            <option value="Lainnya">Lainnya</option>
          </select>
        ) : (
          <Input
            placeholder={needsReason ? 'Alasan penyesuaian (wajib)' : 'Catatan tambahan'}
            value={catatan}
            onChange={e => setCatatan(e.target.value)}
            className="px-4 py-2.5 border border-[#d9c2b2]/40 rounded-xl bg-white text-xs text-[#1e1b15] placeholder-[#544437]/40 focus:outline-none focus:ring-1 focus:ring-[#f29744] focus:border-[#f29744] transition-all shadow-sm"
          />
        )}
      </div>

      {errorMsg && <p className="text-xs font-bold text-[#ba1a1a] bg-[#ffdad6] border border-[#ba1a1a]/20 p-3 rounded-xl">{errorMsg}</p>}

      <Button
        disabled={!isFormSubmittable || busy}
        onClick={submit}
        className="w-full bg-[#f29744] hover:bg-orange-600 active:bg-orange-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-sm text-xs uppercase tracking-wider active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
      >
        {busy
          ? 'Menyimpan…'
          : draftItems.length > 0
          ? `Simpan Semua Entri (${draftItems.length + (bahanBakuId && isCurrentValid ? 1 : 0)} Item)`
          : 'Simpan Entri'}
      </Button>
    </Card>
  )
}
