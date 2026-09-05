'use client'

import React, { useState, useEffect } from 'react'
import { X, CheckCircle, PackageCheck, AlertCircle, Camera, CheckCircle2, ExternalLink, FileText } from 'lucide-react'
import { Spinner } from '@suka/design-system'
import { createSupabaseBrowserClient } from '@suka/auth'
import { useQuery, useQueryClient } from '@tanstack/react-query'

const supabase = createSupabaseBrowserClient()

function getInvoiceUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return ''
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://khpkoreaaucvyqfhynfq.supabase.co'
    if (pathOrUrl.includes('/storage/v1/object/public/po-invoices/')) {
      const parts = pathOrUrl.split('/storage/v1/object/public/po-invoices/')
      return `${supabaseUrl}/storage/v1/object/public/po-invoices/${parts[1]}`
    }
    return pathOrUrl
  }
  const { data } = supabase.storage.from('po-invoices').getPublicUrl(pathOrUrl)
  return data?.publicUrl || ''
}

type Props = {
  poId: string
  onClose: () => void
  onSuccess?: () => void
}

type ItemState = {
  id: string
  nama_item: string
  satuan: string
  qty_pesan: number
  qty_terima_sebelumnya: number
  qty_datang: number
  harga_pesan: number
  harga_terima: number
  kondisi: 'baik' | 'rusak'
  catatan: string
  bahan_baku_id?: string
}

export function KitchenVerifikasiModal({ poId, onClose, onSuccess }: Props) {
  const queryClient = useQueryClient()
  const [items, setItems] = useState<ItemState[]>([])
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Fetch PO detail & items
  const { data: poDetail, isLoading, error } = useQuery({
    queryKey: ['stok-po-detail', poId],
    queryFn: async () => {
      const { data: po, error: poErr } = await supabase
        .from('purchase_order')
        .select('*, supplier:supplier_id(nama)')
        .eq('id', poId)
        .single()
      if (poErr) throw poErr

      const { data: rawItems, error: iErr } = await supabase
        .from('purchase_order_item')
        .select('*, bahan_baku(nama, satuan)')
        .eq('purchase_order_id', poId)
      if (iErr) throw iErr

      return { po, items: rawItems ?? [] }
    }
  })

  // Initialize item states
  useEffect(() => {
    if (poDetail?.items) {
      setItems(
        poDetail.items.map((it: any) => {
          const prevTerima = Number(it.qty_terima || 0)
          const qtyPesan = Number(it.qty_pesan || 0)
          const sisaBelumTiba = Math.max(0, qtyPesan - prevTerima)
          return {
            id: it.id,
            bahan_baku_id: it.bahan_baku_id,
            nama_item: it.bahan_baku?.nama || it.item_description || 'Item Ad-Hoc',
            satuan: it.bahan_baku?.satuan || it.satuan_ad_hoc || 'pcs',
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
    }
  }, [poDetail])

  const updateItem = (id: string, field: keyof ItemState, value: any) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it))
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (isSubmitting) return

    setIsSubmitting(true)
    setErrorMsg(null)

    try {
      // 1. Upload foto nota jika ada
      if (invoiceFile) {
        const ext = invoiceFile.name.split('.').pop() || 'jpg'
        const path = `${poId}/${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('po-invoices')
          .upload(path, invoiceFile, { cacheControl: '3600', upsert: false })
        
        if (upErr) {
          throw new Error('Gagal upload foto: ' + upErr.message)
        }

        const { data: currentPO, error: fetchErr } = await supabase
          .from('purchase_order')
          .select('invoice_urls')
          .eq('id', poId)
          .single()

        if (fetchErr) {
          throw new Error('Gagal mengambil data PO: ' + fetchErr.message)
        }

        const newUrls = [...(currentPO?.invoice_urls ?? []), path]
        const { error: updateErr } = await supabase.from('purchase_order').update({ invoice_urls: newUrls }).eq('id', poId)

        if (updateErr) {
          throw new Error('Gagal menyimpan foto PO ke database: ' + updateErr.message)
        }
      }

      // 2. Execute verifikasi_terima_po RPC with delta qty_datang and new cumulative qty_terima
      const payloadItems = items.map(it => ({
        id: it.id,
        bahan_baku_id: it.bahan_baku_id,
        qty_datang: Number(it.qty_datang || 0),
        qty_terima: Number(it.qty_terima_sebelumnya) + Number(it.qty_datang || 0),
        harga_terima: Number(it.harga_terima || 0),
        kondisi: it.kondisi,
        catatan: it.catatan
      }))

      const { data: rpcRes, error: rpcErr } = await supabase.rpc('verifikasi_terima_po', {
        p_po_id: poId,
        p_items: payloadItems
      })

      if (rpcErr) throw rpcErr
      if (rpcRes && rpcRes.success === false) {
        throw new Error(rpcRes.message || 'Gagal memverifikasi PO')
      }

      // 3. Invalidate queries for instant UI updates (Wait for it so DB is synced)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['stok-inbound-pos'] }),
        queryClient.invalidateQueries({ queryKey: ['spv_inbound_pos'] }),
        queryClient.invalidateQueries({ queryKey: ['spv-monitoring'] }),
        queryClient.invalidateQueries({ queryKey: ['leader-monitoring'] }),
        queryClient.invalidateQueries({ queryKey: ['fluktuasi-harga-bahan-baku'] }),
        queryClient.invalidateQueries({ queryKey: ['bahan_baku_harga'] }),
        queryClient.invalidateQueries({ queryKey: ['po-price-alerts'] })
      ])

      setIsSuccess(true)
      if (onSuccess) onSuccess()

      setTimeout(() => {
        onClose()
      }, 1500)
    } catch (err: any) {
      console.error('Gagal verifikasi:', err)
      setErrorMsg(err.message || 'Gagal menyimpan verifikasi barang.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 fade-in duration-200 my-auto max-h-[90vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-suka-brown/10 flex items-center justify-between bg-suka-cream/40 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-suka-orange text-white flex items-center justify-center shadow-xs">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-suka-brown text-base">Verifikasi Fisik Barang Dapur</h3>
              <p className="text-xs text-suka-brown/70 font-medium">
                PO: <span className="font-mono font-bold">{poDetail?.po?.nomor_po || 'Loading...'}</span> · Supplier: {poDetail?.po?.supplier?.nama || poDetail?.po?.supplier_nama || '-'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-suka-brown/50 hover:text-suka-brown hover:bg-suka-cream rounded-xl transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content / Form */}
        {isSuccess ? (
          <div className="p-12 text-center space-y-3">
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto animate-bounce" />
            <h4 className="text-xl font-black text-suka-brown">Penerimaan Barang Berhasil Disimpan!</h4>
            <p className="text-xs text-suka-brown/70 max-w-md mx-auto font-medium">
              Stok fisik di Ledger Dapur telah otomatis diperbarui & status PO ter-update.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              {isLoading ? (
                <div className="flex justify-center py-12"><Spinner /></div>
              ) : error ? (
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-bold">
                  Gagal memuat detail item PO: {(error as Error).message}
                </div>
              ) : (
                <div className="space-y-4">
                  {errorMsg && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" /> {errorMsg}
                    </div>
                  )}

                  <div className="space-y-3">
                    <label className="text-xs font-black text-suka-brown uppercase tracking-wider block">
                      Daftar Barang & Qty Tiba Fisik:
                    </label>

                    {items.map((it, idx) => {
                      const totalAkumulasi = (Number(it.qty_terima_sebelumnya || 0) + Number(it.qty_datang || 0))
                      
                      return (
                        <div key={it.id} className="p-4 bg-suka-cream/20 border border-suka-brown/10 rounded-2xl space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black text-suka-brown">{idx + 1}. {it.nama_item}</span>
                                {it.qty_terima_sebelumnya > 0 && (
                                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-black rounded-lg border border-amber-200">
                                    Sudah Tiba: {it.qty_terima_sebelumnya} {it.satuan}
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-suka-brown/60 font-semibold mt-0.5">
                                Total Dipesan: <span className="font-bold text-suka-brown">{it.qty_pesan} {it.satuan}</span>
                                {it.qty_terima_sebelumnya > 0 && (
                                  <span> · Sisa Belum Tiba: <span className="font-bold text-amber-700">{Math.max(0, it.qty_pesan - it.qty_terima_sebelumnya)} {it.satuan}</span></span>
                                )}
                              </div>
                            </div>

                            {/* Kondisi Selector */}
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => updateItem(it.id, 'kondisi', 'baik')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                  it.kondisi === 'baik'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 ring-2 ring-emerald-500/20'
                                    : 'bg-white text-suka-brown/60 border-suka-brown/10'
                                }`}
                              >
                                🟢 Kondisi Baik
                              </button>
                              <button
                                type="button"
                                onClick={() => updateItem(it.id, 'kondisi', 'rusak')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                  it.kondisi === 'rusak'
                                    ? 'bg-red-50 text-red-700 border-red-300 ring-2 ring-red-500/20'
                                    : 'bg-white text-suka-brown/60 border-suka-brown/10'
                                }`}
                              >
                                🔴 Rusak / Kurang
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-suka-brown/10">
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-[10px] font-bold text-suka-brown/70 block">
                                  Fisik Tiba Hari Ini ({it.satuan}):
                                </label>
                                {it.qty_terima_sebelumnya > 0 && (
                                  <span className="text-[9px] font-bold text-suka-brown/50">
                                    Total: {totalAkumulasi}/{it.qty_pesan}
                                  </span>
                                )}
                              </div>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                value={it.qty_datang}
                                onChange={e => updateItem(it.id, 'qty_datang', Number(e.target.value))}
                                className="w-full px-3 py-2 text-xs font-black text-suka-brown bg-white border border-suka-brown/20 rounded-xl focus:outline-none focus:border-suka-orange"
                                required
                              />
                            </div>

                            <div>
                              <label className="text-[10px] font-bold text-suka-brown/70 block mb-1">
                                Harga Beli Faktur (Rp/{it.satuan}):
                              </label>
                              <input
                                type="number"
                                step="any"
                                value={it.harga_terima}
                                onChange={e => updateItem(it.id, 'harga_terima', Number(e.target.value))}
                                className="w-full px-3 py-2 text-xs font-black text-suka-brown bg-white border border-suka-brown/20 rounded-xl focus:outline-none focus:border-suka-orange"
                                placeholder="Harga per unit"
                              />
                            </div>

                            <div>
                              <label className="text-[10px] font-bold text-suka-brown/70 block mb-1">
                                Catatan Dapur (Opsional):
                              </label>
                              <input
                                type="text"
                                placeholder="Misal: Batch 1 pengiriman supir A"
                                value={it.catatan}
                                onChange={e => updateItem(it.id, 'catatan', e.target.value)}
                                className="w-full px-3 py-2 text-xs font-medium text-suka-brown bg-white border border-suka-brown/20 rounded-xl focus:outline-none focus:border-suka-orange"
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Foto Nota Fisik yang sudah ada */}
                  {poDetail?.po?.invoice_urls && poDetail.po.invoice_urls.length > 0 && (
                    <div className="p-4 bg-suka-cream/20 border border-suka-brown/10 rounded-2xl space-y-2">
                      <label className="text-[11px] font-black text-suka-brown uppercase tracking-wider block">
                        Foto / Dokumen Invoice Tersimpan ({poDetail.po.invoice_urls.length}):
                      </label>
                      <div className="flex gap-2.5 overflow-x-auto pb-1">
                        {poDetail.po.invoice_urls.map((invPath: string, idx: number) => {
                          const url = getInvoiceUrl(invPath)
                          const isPdf = invPath.toLowerCase().includes('.pdf')
                          return (
                            <a
                              key={idx}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="relative w-20 h-24 rounded-xl overflow-hidden border border-suka-brown/15 bg-white shrink-0 flex items-center justify-center group hover:border-suka-orange transition-all"
                            >
                              {isPdf ? (
                                <div className="flex flex-col items-center p-1 text-center">
                                  <FileText className="w-6 h-6 text-rose-500 mb-1" />
                                  <span className="text-[9px] font-bold text-suka-brown">PDF</span>
                                </div>
                              ) : (
                                <img src={url} alt={`Nota ${idx + 1}`} className="w-full h-full object-cover" loading="lazy" />
                              )}
                              <div className="absolute inset-0 bg-suka-ink/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <ExternalLink className="w-4 h-4 text-white" />
                              </div>
                            </a>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Upload Foto Nota Fisik (Opsional) */}
                  <div className="p-4 border border-dashed border-suka-brown/20 bg-suka-cream/10 rounded-2xl space-y-2">
                    <label className="text-xs font-black text-suka-brown flex items-center gap-2">
                      <Camera className="w-4 h-4 text-suka-orange" />
                      Upload Foto Faktur / Nota Supplier (Opsional)
                    </label>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={e => setInvoiceFile(e.target.files?.[0] || null)}
                      className="block w-full text-xs text-suka-brown/70 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-suka-orange file:text-white hover:file:bg-orange-600 cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-suka-brown/10 bg-suka-cream/40 flex items-center justify-end gap-3 flex-shrink-0">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-bold text-suka-brown bg-white border border-suka-brown/20 rounded-xl hover:bg-suka-cream transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isLoading}
                className="px-6 py-2 bg-gradient-to-r from-suka-orange to-orange-600 text-white text-xs font-black rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-xs flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? <Spinner size={16} /> : <CheckCircle className="w-4 h-4" />}
                Simpan & Update Stok Dapur
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
