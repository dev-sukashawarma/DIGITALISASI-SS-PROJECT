// @ts-nocheck
'use client'

import { useState, useRef, useEffect } from 'react'
import { X, CheckCircle, PackageCheck, AlertCircle, Camera, FileText, ShieldAlert } from 'lucide-react'
import { Spinner } from '@suka/design-system'
import type { PurchaseOrder } from '@/hooks/usePurchaseOrder'
import { useVerifikasiTerimaPO, useFinalisasiPO, useUploadInvoice, getInvoiceUrl } from '@/hooks/usePurchaseOrder'
import { rupiah } from '@/lib/format'
import { createClient } from '@/lib/supabase'
import { cekTerima, stokSetelahTerima, pesanWarning } from '@/lib/purchase/terimaGuard'

// GUDANG PUSAT (HQ) -- satu-satunya tujuan stok penerimaan PO
// (verifikasi_terima_po menulis ledger ke id ini, di-hardcode juga di sana).
const GUDANG_PUSAT_ID = 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b90'

type Props = {
  po: PurchaseOrder
  onClose: () => void
}

type ItemState = {
  id: string
  qty_pesan: number
  qty_terima_sebelumnya: number
  qty_datang: number
  harga_pesan: number
  harga_terima: number
  kondisi: 'baik' | 'rusak'
  catatan: string
}

export function VerifikasiTerimaModal({ po, onClose }: Props) {
  const verifikasi = useVerifikasiTerimaPO()
  const finalisasiPO = useFinalisasiPO()
  const uploadInvoice = useUploadInvoice()
  const fileRef = useRef<HTMLInputElement>(null)
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [isFinalisasiSisa, setIsFinalisasiSisa] = useState(false)
  const [alasanFinalisasi, setAlasanFinalisasi] = useState('')
  
  // Inisialisasi state sesuai default dari PO
  const [items, setItems] = useState<ItemState[]>(
    po.items.map(it => {
      const prevTerima = Number(it.qty_terima || 0)
      const qtyPesan = Number(it.qty_pesan || 0)
      const sisaBelumTiba = Math.max(0, qtyPesan - prevTerima)
      return {
        id: it.id,
        qty_pesan: qtyPesan,
        qty_terima_sebelumnya: prevTerima,
        qty_datang: sisaBelumTiba > 0 ? sisaBelumTiba : qtyPesan,
        harga_pesan: Number(it.harga_pesan || 0),
        harga_terima: Number(it.harga_terima ?? it.harga_pesan ?? 0),
        kondisi: 'baik',
        catatan: it.catatan || ''
      }
    })
  )

  // Stok berjalan Gudang Pusat, satuan besar. null = BELUM DIKETAHUI (query
  // gagal / bahan belum punya baris saldo) -- sengaja tidak dipukul rata jadi 0,
  // lihat terimaGuard.ts.
  const [stokGudang, setStokGudang] = useState<Record<string, number> | null>(null)

  useEffect(() => {
    let batal = false
    const ids = po.items.map(it => it.bahan_baku_id).filter(Boolean) as string[]
    if (ids.length === 0) { setStokGudang({}); return }
    ;(async () => {
      const { data, error } = await createClient()
        .from('stok_balance')
        .select('bahan_baku_id, saldo, saldo_is_gram, bahan_baku(faktor_tampilan, satuan_kecil)')
        .eq('outlet_id', GUDANG_PUSAT_ID)
        .in('bahan_baku_id', ids)
      if (batal) return
      if (error) { setStokGudang(null); return }
      const map: Record<string, number> = {}
      for (const row of (data ?? []) as any[]) {
        const b = row.bahan_baku ?? {}
        const saldo = Number(row.saldo || 0)
        map[row.bahan_baku_id] = row.saldo_is_gram && b.satuan_kecil && b.faktor_tampilan
          ? saldo / Number(b.faktor_tampilan)
          : saldo
      }
      setStokGudang(map)
    })()
    return () => { batal = true }
  }, [po.id])

  const stokBesar = (bahanBakuId?: string | null): number | null => {
    if (!bahanBakuId || !stokGudang) return null
    return bahanBakuId in stokGudang ? stokGudang[bahanBakuId] : null
  }

  const warningsUntuk = (poItem: any) => {
    const st = items.find(i => i.id === poItem.id)
    if (!st) return []
    return cekTerima({
      qtyDatang: Number(st.qty_datang || 0),
      qtyPesan: Number(st.qty_pesan || 0),
      qtyTerimaSebelumnya: Number(st.qty_terima_sebelumnya || 0),
      stokGudangBesar: stokBesar(poItem.bahan_baku_id)
    })
  }

  const updateItem = (id: string, field: keyof ItemState, value: any) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Gerbang konfirmasi. SATU dialog untuk semua baris: dua peringatan
    // beruntun melatih orang menekan "lanjut" (pelajaran gerbang nol opname).
    const bermasalah = po.items
      .map((poItem: any) => ({ poItem, warnings: warningsUntuk(poItem) }))
      .filter((x: any) => x.warnings.length > 0)
    if (bermasalah.length > 0) {
      const rincian = bermasalah
        .map((x: any) => {
          const st = items.find(i => i.id === x.poItem.id)
          const sat = x.poItem.bahan_baku?.satuan || x.poItem.satuan_ad_hoc || 'satuan'
          const nama = x.poItem.bahan_baku?.nama || x.poItem.item_description || 'Item'
          return `- ${nama}: ${st?.qty_datang} ${sat}` + '\n  ' +
            x.warnings.map((w: any) => pesanWarning(w, sat)).join('\n  ')
        })
        .join('\n\n')
      const lanjut = window.confirm(
        'PERIKSA LAGI SEBELUM DISIMPAN\n\n' + rincian +
          '\n\nPenerimaan yang sudah tersimpan TIDAK BISA dikurangi lewat aplikasi; koreksinya harus manual di database.\n\nTetap simpan?'
      )
      if (!lanjut) return
    }
    if (isFinalisasiSisa && !alasanFinalisasi.trim()) {
      alert('Alasan penutupan sisa PO wajib diisi.')
      return
    }
    setUploadingFile(true)
    try {
      if (invoiceFile) {
        await uploadInvoice.mutateAsync({ poId: po.id, file: invoiceFile })
      }
      const payloadItems = items.map(it => ({
        id: it.id,
        qty_datang: Number(it.qty_datang || 0),
        qty_terima: Number(it.qty_terima_sebelumnya) + Number(it.qty_datang || 0),
        harga_terima: Number(it.harga_terima || 0),
        kondisi: it.kondisi,
        catatan: it.catatan
      }))

      await verifikasi.mutateAsync({
        poId: po.id,
        items: payloadItems
      })

      if (isFinalisasiSisa) {
        await finalisasiPO.mutateAsync({
          poId: po.id,
          alasan: alasanFinalisasi.trim()
        })
      }

      onClose()
    } catch (err) {
      console.error('Error during verification submit:', err)
    } finally {
      setUploadingFile(false)
    }
  }

  const isSaving = verifikasi.isPending || uploadingFile || finalisasiPO.isPending

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans">
      <div className="bg-white/95 backdrop-blur-2xl rounded-3xl w-full max-w-5xl overflow-hidden shadow-2xl border border-suka-brown/10 animate-fade-in">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-suka-brown/5 flex items-center justify-between bg-suka-cream/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-suka-brown to-suka-ink text-white flex items-center justify-center shadow-xs">
              <PackageCheck className="w-5 h-5 text-suka-orange" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-suka-brown">Penerimaan &amp; Verifikasi Barang</h2>
              <p className="text-xs font-semibold text-suka-brown/60">Verifikasi fisik barang yang tiba untuk PO <span className="font-mono text-suka-brown">{po.nomor_po}</span></p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-suka-brown/40 hover:text-suka-brown hover:bg-suka-cream rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto bg-suka-cream/20">
          <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-4 flex gap-3 mb-5 shadow-2xs">
            <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 font-medium leading-relaxed">
              Pastikan mengecek kondisi fisik barang dan nota pengiriman. Jika ada barang rusak atau kurang, ubah kolom Kondisi. 
              Data kuantitas yang berstatus "Baik" akan secara otomatis menambah saldo stok Gudang Kitchen.
            </div>
          </div>

          <form id="verifikasi-form" onSubmit={handleSubmit} className="space-y-4">
            {po.items.map((poItem) => {
              const state = items.find(i => i.id === poItem.id)!
              const isAdhoc = !poItem.bahan_baku_id
              const totalAkumulasi = (Number(state?.qty_terima_sebelumnya || 0) + Number(state?.qty_datang || 0))
              const satuan = isAdhoc ? poItem.satuan_ad_hoc : (poItem.bahan_baku?.satuan || poItem.bahan_baku?.satuan_standar || 'satuan')
              const stokSekarang = stokBesar(poItem.bahan_baku_id)
              const stokNanti = stokSetelahTerima(stokSekarang, Number(state?.qty_datang || 0))
              const warnings = warningsUntuk(poItem)

              return (
                <div key={poItem.id} className="bg-white/95 border border-suka-brown/10 rounded-3xl p-5 shadow-sm flex flex-col gap-4">
                  
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-suka-brown text-sm sm:text-base">
                          {isAdhoc ? poItem.item_description : poItem.bahan_baku?.nama}
                        </h3>
                        {state?.qty_terima_sebelumnya > 0 && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-black rounded-lg border border-amber-200">
                            Sudah Tiba: {state.qty_terima_sebelumnya} {satuan}
                          </span>
                        )}
                      </div>
                      {isAdhoc && (
                        <span className="inline-block px-2 py-0.5 bg-suka-cream text-suka-brown text-[10px] font-bold rounded-lg border border-suka-brown/10 mt-1">
                          Ad-hoc (Non-Katalog)
                        </span>
                      )}
                      <p className="text-xs font-semibold text-suka-brown/60 mt-1">
                        Dipesan: <span className="text-suka-brown font-bold tabular-nums">{poItem.qty_pesan} {satuan}</span> &bull; 
                        Harga PO: <span className="text-suka-brown font-bold tabular-nums">{rupiah(poItem.harga_pesan)}</span>
                        {state?.qty_terima_sebelumnya > 0 && (
                          <span> &bull; Sisa Belum Tiba: <span className="font-bold text-amber-700">{Math.max(0, poItem.qty_pesan - state.qty_terima_sebelumnya)} {satuan}</span></span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-dashed border-suka-brown/10">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-suka-brown/70 uppercase tracking-wider">Fisik Tiba Hari Ini</label>
                        {state?.qty_terima_sebelumnya > 0 && (
                          <span className="text-[9px] font-bold text-suka-brown/50">
                            Total: {totalAkumulasi}/{poItem.qty_pesan}
                          </span>
                        )}
                      </div>
                      {/* Satuan ditempel di dalam kolom, bukan cuma disebut di
                          baris keterangan di atas -- mata orang yang sedang
                          mengetik ada di sini. */}
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          value={state.qty_datang}
                          onChange={e => updateItem(poItem.id, 'qty_datang', parseFloat(e.target.value) || 0)}
                          className="w-full pl-3.5 pr-16 py-2 bg-suka-cream/30 border border-suka-brown/15 rounded-xl focus:border-suka-orange outline-none transition-all font-bold text-xs tabular-nums"
                        />
                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-bold text-suka-brown/50 text-[10px] uppercase tracking-wider pointer-events-none">
                          {satuan}
                        </span>
                      </div>
                      {/* Akibat ke stok, ditampilkan SELALU -- bukan cuma saat
                          curiga. Form ini dulu tidak pernah menunjukkannya, dan
                          itu akar salah input 16 Sep 2026. */}
                      {!isAdhoc && (
                        <p className="text-[10px] font-bold text-suka-brown/60 tabular-nums leading-snug">
                          Stok Gudang:{' '}
                          {stokSekarang === null ? (
                            <span className="text-suka-brown/40">belum termuat</span>
                          ) : (
                            <>
                              {stokSekarang} &rarr;{' '}
                              <span className={warnings.length > 0 ? 'text-red-600 font-black' : 'text-suka-brown font-black'}>
                                {stokNanti}
                              </span>{' '}
                              {satuan}
                            </>
                          )}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      {/* "Harga Aktual" saja adalah akar kekeliruan yang berulang:
                          PLASTIK MERAH (satuan Ikat) diisi Rp18.000 -- harga per
                          PACK -- dua kali, Agustus dan September 2026. Guard di
                          verifikasi_terima_po menahan penulisan masternya, tapi
                          orang yang mengetik tak pernah diberi tahu kolom ini
                          meminta harga per apa. */}
                      <label className="text-[11px] font-bold text-suka-brown/70 uppercase tracking-wider">
                        Harga Aktual <span className="text-suka-orange">per {satuan}</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-suka-brown/40 text-xs">Rp</span>
                        <input
                          type="number"
                          min="0"
                          required
                          value={state.harga_terima}
                          onChange={e => updateItem(poItem.id, 'harga_terima', parseInt(e.target.value) || 0)}
                          className="w-full pl-9 pr-3.5 py-2 bg-suka-cream/30 border border-suka-brown/15 rounded-xl focus:border-suka-orange outline-none transition-all font-bold text-xs tabular-nums"
                        />
                      </div>
                      {state.qty_datang > 0 && state.harga_terima > 0 && (
                        <p className="text-[10px] font-bold text-suka-brown/60 tabular-nums leading-snug">
                          {state.qty_datang} {satuan} × {rupiah(state.harga_terima)} ={' '}
                          <span className="text-suka-brown">{rupiah(state.qty_datang * state.harga_terima)}</span>
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-suka-brown/70 uppercase tracking-wider">Kondisi</label>
                      <select 
                        value={state.kondisi}
                        onChange={e => updateItem(poItem.id, 'kondisi', e.target.value)}
                        className="w-full px-3.5 py-2 bg-suka-cream/30 border border-suka-brown/15 rounded-xl focus:border-suka-orange outline-none transition-all font-bold text-xs cursor-pointer"
                      >
                        <option value="baik">✅ Baik (Sesuai)</option>
                        <option value="rusak">❌ Rusak / Tolak</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-suka-brown/70 uppercase tracking-wider">Catatan</label>
                      <input 
                        type="text"
                        placeholder="Opsional (cth: kemasan bocor)"
                        value={state.catatan}
                        onChange={e => updateItem(poItem.id, 'catatan', e.target.value)}
                        className="w-full px-3.5 py-2 bg-suka-cream/30 border border-suka-brown/15 rounded-xl focus:border-suka-orange outline-none transition-all font-medium text-xs text-suka-ink"
                      />
                    </div>
                  </div>

                  {warnings.length > 0 && (
                    <div className="flex gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-2xl">
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        {warnings.map((w: any, wi: number) => (
                          <p key={wi} className="text-[11px] font-bold text-red-700 leading-snug">
                            {pesanWarning(w, satuan)}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              )
            })}

            {/* Upload Foto / Dokumen Invoice Supplier */}
            <div className="p-5 bg-white/95 border border-dashed border-suka-brown/20 rounded-3xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-suka-brown flex items-center gap-2">
                    <Camera className="w-4 h-4 text-suka-orange" />
                    Foto / Dokumen Faktur & Surat Jalan Supplier (Opsional)
                  </h4>
                  <p className="text-[11px] text-suka-brown/60 mt-0.5">
                    Unggah bukti fisik nota/surat jalan untuk arsip 3-Way Matching.
                  </p>
                </div>
                {invoiceFile && (
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                    File terpilih: {invoiceFile.name}
                  </span>
                )}
              </div>

              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={e => setInvoiceFile(e.target.files?.[0] || null)}
                capture="environment"
              />

              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full py-4 text-xs font-bold text-suka-brown/70 bg-suka-cream/30 hover:bg-suka-cream/60 border border-suka-brown/15 rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Camera className="w-4 h-4 text-suka-orange" />
                <span>{invoiceFile ? 'Ganti File Foto/Invoice' : 'Pilih / Ambil Foto Invoice'}</span>
              </button>
            </div>

            {/* Opsi Finalisasi / Pengiriman Terakhir */}
            <div className="p-5 bg-amber-50/70 border border-amber-200/80 rounded-3xl space-y-3">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isFinalisasiSisa}
                  onChange={e => setIsFinalisasiSisa(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-suka-orange focus:ring-suka-orange/30 border-suka-brown/30 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-suka-brown flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-amber-700 inline-block" />
                    Tandai sebagai Pengiriman Terakhir (Tutup PO &amp; batalkan sisa barang yang belum tiba)
                  </span>
                  <span className="text-[11px] text-suka-brown/70 leading-relaxed block mt-0.5">
                    Status PO akan langsung diselesaikan menjadi <strong>Diterima Lengkap</strong>. Sisa barang yang belum tiba <strong>TIDAK AKAN</strong> ditambahkan ke stok gudang.
                  </span>
                </div>
              </label>

              {isFinalisasiSisa && (
                <div className="pt-2 animate-fade-in space-y-1.5 border-t border-amber-200/60 mt-2">
                  <label className="block text-[11px] font-bold text-amber-900 uppercase tracking-wider">
                    Alasan Penutupan Sisa PO <span className="text-rose-600">*</span>
                  </label>
                  <textarea
                    value={alasanFinalisasi}
                    onChange={e => setAlasanFinalisasi(e.target.value)}
                    placeholder="Contoh: Stok supplier habis, sisa pesanan disepakati tidak dikirimkan lagi..."
                    rows={2}
                    className="w-full text-xs p-3 bg-white border border-amber-300 rounded-xl text-suka-brown placeholder:text-suka-brown/40 focus:outline-none focus:border-suka-orange font-medium"
                    required
                  />
                </div>
              )}
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-suka-brown/5 bg-suka-cream/30 flex justify-end gap-3">
          <button 
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-5 py-2.5 text-xs font-bold text-suka-brown/70 hover:bg-white rounded-2xl border border-suka-brown/15 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Batal
          </button>
          <button 
            type="submit"
            form="verifikasi-form"
            disabled={isSaving}
            className="px-5 py-2.5 bg-gradient-to-r from-suka-brown to-suka-ink text-white text-xs font-bold rounded-2xl hover:opacity-95 transition-all shadow-md shadow-suka-brown/20 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? <Spinner className="w-4 h-4 text-white" /> : <CheckCircle className="w-4 h-4 text-emerald-400" />}
            <span>Simpan Penerimaan</span>
          </button>
        </div>

      </div>
    </div>
  )
}
