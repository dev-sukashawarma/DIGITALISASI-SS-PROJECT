'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Button, Input } from '@suka/design-system'
import { useBahanBaku } from '@/hooks/useBahanBaku'
import { useLedgerActions } from '@/hooks/useLedger'
import { useStokBalance } from '@/hooks/useStokBalance'
import { createClient } from '@/lib/supabase'
import { submitWasteReport } from '@/app/actions/waste'
import { formatTriUnitSaldo } from '@/lib/format/compositeUnit'

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
  adjBesar?: string
  adjTengah?: string
  adjKecil?: string
  targetSaldo?: number
  existingSaldo?: number
  delta?: number
  qtyInput?: string
  selectedUnitType?: 'besar' | 'tengah' | 'kecil'
  finalQty?: number
  file?: File | null
  catatanItem?: string
  summaryText: string
}

function breakdownSaldoToUnits(
  qty: number,
  b?: {
    satuan: string
    satuan_tengah?: string | null
    faktor_tengah?: number | null
    satuan_kecil?: string | null
    faktor_tampilan?: number | null
  }
) {
  if (!b) return { besar: 0, tengah: 0, kecil: 0 }

  const isNegative = qty < 0
  const absQty = Math.abs(qty)

  const hasTengah = Boolean(b.satuan_tengah && b.faktor_tengah && b.faktor_tengah > 0)
  const hasKecil = Boolean(b.satuan_kecil && b.faktor_tampilan && b.faktor_tampilan > 0)

  if (hasTengah && hasKecil) {
    const fTengah = b.faktor_tengah!
    const fKecil = b.faktor_tampilan!
    const fKecilPerTengah = fKecil / fTengah

    let besar = Math.trunc(absQty)
    let sisaTengahRaw = Math.round((absQty - besar) * fTengah * 1e6) / 1e6
    let tengah = Math.trunc(sisaTengahRaw)
    let sisaKecilRaw = Math.round((sisaTengahRaw - tengah) * fKecilPerTengah * 1e6) / 1e6
    let kecil = Math.round(sisaKecilRaw * 100) / 100

    if (Math.abs(kecil) >= fKecilPerTengah) {
      tengah += Math.sign(kecil || 1) * Math.floor(Math.abs(kecil) / fKecilPerTengah)
      kecil = Math.round((kecil % fKecilPerTengah) * 100) / 100
    }
    if (Math.abs(tengah) >= fTengah) {
      besar += Math.sign(tengah || 1) * Math.floor(Math.abs(tengah) / fTengah)
      tengah = tengah % fTengah
    }

    return {
      besar: isNegative ? -besar : besar,
      tengah: isNegative ? -tengah : tengah,
      kecil: isNegative ? -kecil : kecil,
    }
  }

  if (hasTengah) {
    const fTengah = b.faktor_tengah!
    let besar = Math.trunc(absQty)
    let tengah = Math.round((absQty - besar) * fTengah * 100) / 100

    if (Math.abs(tengah) >= fTengah) {
      besar += Math.sign(tengah || 1) * Math.floor(Math.abs(tengah) / fTengah)
      tengah = Math.round((tengah % fTengah) * 100) / 100
    }

    return {
      besar: isNegative ? -besar : besar,
      tengah: isNegative ? -tengah : tengah,
      kecil: 0,
    }
  }

  if (hasKecil) {
    const fKecil = b.faktor_tampilan!
    let besar = Math.trunc(absQty)
    let kecil = Math.round((absQty - besar) * fKecil * 100) / 100

    if (Math.abs(kecil) >= fKecil) {
      besar += Math.sign(kecil || 1) * Math.floor(Math.abs(kecil) / fKecil)
      kecil = Math.round((kecil % fKecil) * 100) / 100
    }

    return {
      besar: isNegative ? -besar : besar,
      tengah: 0,
      kecil: isNegative ? -kecil : kecil,
    }
  }

  return {
    besar: qty,
    tengah: 0,
    kecil: 0,
  }
}

function computeTargetSaldo(
  adjBesar: string,
  adjTengah: string,
  adjKecil: string,
  b?: {
    satuan: string
    satuan_tengah?: string | null
    faktor_tengah?: number | null
    satuan_kecil?: string | null
    faktor_tampilan?: number | null
  }
): number {
  if (!b) return 0
  const vBesar = Number(adjBesar) || 0
  const vTengah = Number(adjTengah) || 0
  const vKecil = Number(adjKecil) || 0

  const hasTengah = Boolean(b.satuan_tengah && b.faktor_tengah && b.faktor_tengah > 0)
  const hasKecil = Boolean(b.satuan_kecil && b.faktor_tampilan && b.faktor_tampilan > 0)

  let total = vBesar
  if (hasTengah) {
    total += vTengah / b.faktor_tengah!
  }
  if (hasKecil) {
    total += vKecil / b.faktor_tampilan!
  }

  return Math.round(total * 1e6) / 1e6
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

  // Adjustment multi-unit inputs state
  const [adjBesar, setAdjBesar] = useState('')
  const [adjTengah, setAdjTengah] = useState('')
  const [adjKecil, setAdjKecil] = useState('')

  // Draft list for multiple items
  const [draftItems, setDraftItems] = useState<DraftItem[]>([])

  const selectedBahan = bahanBaku.find(b => b.id === bahanBakuId)
  const bal = balances.find(b => b.bahan_baku_id === bahanBakuId)
  const existingSaldo = bal?.saldo ?? 0

  const targetSaldo = computeTargetSaldo(adjBesar, adjTengah, adjKecil, selectedBahan)
  const delta = Math.round((targetSaldo - existingSaldo) * 1e6) / 1e6

  const lastInitKeyRef = useRef<string>('')

  useEffect(() => {
    const key = `${bahanBakuId}_${tipe}_${existingSaldo}`
    if (tipe === 'adjustment' && bahanBakuId && lastInitKeyRef.current !== key) {
      lastInitKeyRef.current = key
      const breakdown = breakdownSaldoToUnits(existingSaldo, selectedBahan)
      setAdjBesar(String(breakdown.besar))
      setAdjTengah(String(breakdown.tengah))
      setAdjKecil(String(breakdown.kecil))
    }
  }, [bahanBakuId, tipe, existingSaldo, selectedBahan])

  const needsReason = tipe === 'adjustment' || tipe === 'waste'
  const qtyNum = Number(qty)

  const isCurrentValid = tipe === 'adjustment'
    ? Boolean(bahanBakuId) && !isNaN(targetSaldo)
    : Boolean(bahanBakuId) && qty !== '' && !isNaN(qtyNum) && qtyNum > 0

  const isFormSubmittable = draftItems.length > 0 || (Boolean(bahanBakuId) && isCurrentValid && (!needsReason || catatan.trim() !== ''))

  function createDraftItemFromCurrentState(): DraftItem | null {
    if (!bahanBakuId || !selectedBahan) return null

    if (tipe === 'adjustment') {
      if (isNaN(targetSaldo)) return null
      const selisihLabel = delta === 0 ? 'Selisih: 0 (Existing)' : `Selisih: ${delta > 0 ? '+' : ''}${delta} ${selectedBahan.satuan}`
      const text = `Target: ${formatTriUnitSaldo(
        targetSaldo,
        selectedBahan.satuan,
        selectedBahan.satuan_tengah,
        selectedBahan.faktor_tengah,
        selectedBahan.satuan_kecil,
        selectedBahan.faktor_tampilan
      )} (${selisihLabel})`

      return {
        id: Math.random().toString(36).slice(2),
        bahanBakuId,
        bahanBakuNama: selectedBahan.nama,
        satuan: selectedBahan.satuan,
        tipe: 'adjustment',
        adjBesar,
        adjTengah,
        adjKecil,
        targetSaldo,
        existingSaldo,
        delta,
        summaryText: text,
        catatanItem: catatan,
      }
    } else {
      let finalQty = Number(qty)
      if (isNaN(finalQty) || finalQty <= 0) return null

      let unitName = selectedBahan.satuan as Satuan
      if (selectedUnitType === 'kecil' && selectedBahan.faktor_tampilan) {
        finalQty = finalQty / selectedBahan.faktor_tampilan
        unitName = (selectedBahan.satuan_kecil ?? selectedBahan.satuan) as Satuan
      } else if (selectedUnitType === 'tengah' && selectedBahan.faktor_tengah) {
        finalQty = finalQty / selectedBahan.faktor_tengah
        unitName = (selectedBahan.satuan_tengah ?? selectedBahan.satuan) as Satuan
      }

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
    setAdjBesar('')
    setAdjTengah('')
    setAdjKecil('')
    setFile(null)
    setErrorMsg(null)
    lastInitKeyRef.current = ''
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

          await submitWasteReport({
            outlet_id: outletId,
            bahan_baku_id: w.bahanBakuId,
            qty: w.finalQty ?? 0,
            reason: w.catatanItem || catatan || 'Waste',
            photo_url: photoUrl
          })
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
                onClick={() => {
                  setTipe(o.value)
                  if (o.value === 'adjustment' && bahanBakuId) {
                    lastInitKeyRef.current = ''
                  }
                }}
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
            if (tipe === 'adjustment' && newId) {
              lastInitKeyRef.current = ''
            }
          }}
        >
          <option value="">— Pilih bahan baku —</option>
          {bahanBaku.map(b => <option key={b.id} value={b.id}>{b.nama} ({b.satuan})</option>)}
        </select>
      </div>

      {bahanBakuId && tipe !== 'adjustment' && (() => {
        const satuan = selectedBahan?.satuan ?? ''
        const isLow = existingSaldo <= 0
        return (
          <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl border text-xs font-bold ${isLow ? 'bg-[#ffdad6] border-[#ba1a1a]/20 text-[#ba1a1a]' : 'bg-[#e8f5e9] border-[#93f997]/40 text-[#006e24]'}`}>
            <span>Stok tersedia</span>
            <span>{existingSaldo} {satuan}</span>
          </div>
        )
      })()}

      {tipe === 'adjustment' && selectedBahan ? (
        <div className="bg-[#fff8f1] border border-[#d9c2b2]/50 rounded-2xl p-4 space-y-3 shadow-inner">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-[#701604] uppercase tracking-wide">
              Stok & Tingkatan Satuan
            </label>
            <button
              type="button"
              onClick={() => {
                const breakdown = breakdownSaldoToUnits(existingSaldo, selectedBahan)
                setAdjBesar(String(breakdown.besar))
                setAdjTengah(String(breakdown.tengah))
                setAdjKecil(String(breakdown.kecil))
              }}
              className="text-[10px] font-bold text-[#f29744] hover:underline cursor-pointer"
            >
              Reset ke Existing
            </button>
          </div>

          <p className="text-[11px] text-[#544437]/80 leading-snug">
            Angka existing otomatis terisi. Silakan edit nilai di tiap satuan sesuai kondisi stok fisik:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Satuan Utama / Besar */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-[#544437]/75 uppercase">
                {selectedBahan.satuan} (Utama)
              </span>
              <Input
                type="number"
                inputMode="decimal"
                value={adjBesar}
                onChange={e => setAdjBesar(e.target.value)}
                className="px-3 py-2 border border-[#d9c2b2]/40 rounded-xl bg-white text-xs text-[#1e1b15] font-bold focus:outline-none focus:ring-1 focus:ring-[#f29744]"
                placeholder="0"
              />
            </div>

            {/* Satuan Tengah */}
            {selectedBahan.satuan_tengah && selectedBahan.faktor_tengah ? (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-[#544437]/75 uppercase">
                  {selectedBahan.satuan_tengah} (Tengah)
                </span>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={adjTengah}
                  onChange={e => setAdjTengah(e.target.value)}
                  className="px-3 py-2 border border-[#d9c2b2]/40 rounded-xl bg-white text-xs text-[#1e1b15] font-bold focus:outline-none focus:ring-1 focus:ring-[#f29744]"
                  placeholder="0"
                />
              </div>
            ) : null}

            {/* Satuan Kecil */}
            {selectedBahan.satuan_kecil && selectedBahan.faktor_tampilan ? (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-[#544437]/75 uppercase">
                  {selectedBahan.satuan_kecil} (Kecil)
                </span>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={adjKecil}
                  onChange={e => setAdjKecil(e.target.value)}
                  className="px-3 py-2 border border-[#d9c2b2]/40 rounded-xl bg-white text-xs text-[#1e1b15] font-bold focus:outline-none focus:ring-1 focus:ring-[#f29744]"
                  placeholder="0"
                />
              </div>
            ) : null}
          </div>

          {/* Live Summary Calculation */}
          <div className="pt-2 border-t border-[#d9c2b2]/40 text-xs space-y-1.5 font-medium">
            <div className="flex justify-between text-[#544437]">
              <span>Stok Existing System:</span>
              <span className="font-bold">
                {formatTriUnitSaldo(
                  existingSaldo,
                  selectedBahan.satuan,
                  selectedBahan.satuan_tengah,
                  selectedBahan.faktor_tengah,
                  selectedBahan.satuan_kecil,
                  selectedBahan.faktor_tampilan
                )}
              </span>
            </div>
            <div className="flex justify-between text-[#1e1b15]">
              <span>Target Stok Baru:</span>
              <span className="font-bold text-[#701604]">
                {formatTriUnitSaldo(
                  targetSaldo,
                  selectedBahan.satuan,
                  selectedBahan.satuan_tengah,
                  selectedBahan.faktor_tengah,
                  selectedBahan.satuan_kecil,
                  selectedBahan.faktor_tampilan
                )}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs font-bold pt-1">
              <span>Selisih Penyesuaian:</span>
              <span
                className={`px-2 py-0.5 rounded-md ${
                  delta > 0
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : delta < 0
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : 'bg-gray-100 text-gray-600 border border-gray-200'
                }`}
              >
                {delta > 0 ? `+${delta}` : delta} {selectedBahan.satuan}
              </span>
            </div>
          </div>
        </div>
      ) : tipe !== 'adjustment' && (
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
            {bahanBakuId && (() => {
              if (!selectedBahan) return null
              return (
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
              )
            })()}
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
