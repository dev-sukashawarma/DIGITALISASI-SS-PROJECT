'use client'
import { useState, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { usePOPending, usePODetailKitchen, useVerifikasiPO, uploadInvoiceKitchen, getInvoiceUrl, type POItemVerif } from '@/hooks/usePOKitchen'
import { BottomNav } from '@/components/distribusi/BottomNav'
import { Package, ChevronRight, ArrowLeft, Camera, CheckCircle2, AlertCircle, Clock, FileText } from 'lucide-react'
import { toast } from 'sonner'

type ItemVerifState = {
  qty_terima: string
  harga_terima: string
  kondisi: 'baik' | 'rusak' | 'kurang'
  catatan: string
}

// ─── Main list page ──────────────────────────────────────────────────────────

function PendingList({ onSelect }: { onSelect: (id: string) => void }) {
  const { data: pos = [], isLoading, error } = usePOPending()

  if (isLoading) return (
    <div className="flex justify-center py-20">
      <div className="w-10 h-10 border-4 border-[#f29744]/20 border-t-[#f29744] rounded-full animate-spin" />
    </div>
  )

  if (error) return (
    <div className="bg-red-50/80 backdrop-blur-sm border border-red-200/50 rounded-2xl p-4 text-red-700 text-sm flex items-center gap-3 shadow-sm">
      <AlertCircle size={18} className="text-red-500" />
      <span className="font-medium">Gagal memuat data pesanan.</span>
    </div>
  )

  if (pos.length === 0) return (
    <div className="text-center py-24 px-6 flex flex-col items-center justify-center bg-white/40 backdrop-blur-md rounded-3xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
      <div className="w-20 h-20 bg-gradient-to-br from-green-100 to-green-50 rounded-full flex items-center justify-center mb-5 shadow-inner">
        <CheckCircle2 size={36} className="text-green-500" />
      </div>
      <h3 className="text-xl font-extrabold text-[#3d2b1f] tracking-tight">Semua Beres!</h3>
      <p className="text-sm text-gray-500 mt-2 font-medium max-w-[250px] leading-relaxed">
        Tidak ada kiriman barang dari supplier yang perlu diverifikasi saat ini.
      </p>
    </div>
  )

  return (
    <div className="space-y-3">
      {pos.map((po, i) => (
        <button key={po.id} onClick={() => onSelect(po.id)}
          className="w-full text-left bg-white/70 backdrop-blur-lg rounded-3xl border border-white/80 shadow-[0_4px_20px_rgb(0,0,0,0.03)] p-4 flex items-center gap-4 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-300 group relative overflow-hidden"
          style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'both' }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 pointer-events-none" />
          
          <div className="w-12 h-12 bg-gradient-to-br from-[#f29744]/10 to-[#f29744]/20 rounded-2xl flex items-center justify-center shrink-0 border border-[#f29744]/10 group-hover:scale-110 transition-transform duration-300">
            <Package size={20} className="text-[#e67e22]" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="font-extrabold text-[#3d2b1f] tracking-tight text-sm mb-0.5 group-hover:text-[#e67e22] transition-colors">{po.nomor_po}</div>
            <div className="text-sm font-medium text-gray-600 truncate">{po.supplier_nama}</div>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#e67e22] bg-[#f29744]/10 px-2 py-0.5 rounded-full">
                <FileText size={10} /> {po.jumlah_item} Item
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                <Clock size={10} />
                {new Date(po.tanggal_po).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
              </span>
            </div>
          </div>
          
          <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-[#f29744]/10 transition-colors shrink-0">
            <ChevronRight size={16} className="text-gray-400 group-hover:text-[#e67e22] transition-colors" />
          </div>
        </button>
      ))}
    </div>
  )
}

// ─── Verifikasi detail form ───────────────────────────────────────────────────

function VerifikasiDetail({ poId, onBack }: { poId: string; onBack: () => void }) {
  const { data: po, isLoading } = usePODetailKitchen(poId)
  const verifikasi = useVerifikasiPO()
  const fileRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const [uploadingInvoice, setUploadingInvoice] = useState(false)

  const [itemStates, setItemStates] = useState<Record<string, ItemVerifState>>({})

  function getState(item: POItemVerif): ItemVerifState {
    return itemStates[item.id] ?? {
      qty_terima: String(item.qty_pesan),
      harga_terima: item.harga_pesan ? String(item.harga_pesan) : '',
      kondisi: 'baik',
      catatan: '',
    }
  }

  function updateState(itemId: string, field: keyof ItemVerifState, value: string) {
    setItemStates(prev => ({
      ...prev,
      [itemId]: { ...getState({ id: itemId } as any), [field]: value },
    }))
  }

  async function handleUploadInvoice(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !poId) return
    setUploadingInvoice(true)
    try {
      await uploadInvoiceKitchen(poId, file)
      await queryClient.invalidateQueries({ queryKey: ['po-detail-kitchen', poId] })
      toast.success('Foto invoice berhasil disimpan')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setUploadingInvoice(false)
      e.target.value = ''
    }
  }

  async function handleSubmit() {
    if (!po) return
    const items = po.items.map(item => {
      const s = getState(item)
      return {
        bahan_baku_id: item.bahan_baku_id,
        qty_terima: parseFloat(s.qty_terima) || 0,
        harga_terima: parseFloat(s.harga_terima) || null,
        kondisi: s.kondisi,
        catatan: s.catatan.trim() || undefined,
      }
    })

    const result = await verifikasi.mutateAsync({ poId, items })
    if (result?.success) onBack()
  }

  if (isLoading || !po) return (
    <div className="flex justify-center py-20">
      <div className="w-10 h-10 border-4 border-[#f29744]/20 border-t-[#f29744] rounded-full animate-spin" />
    </div>
  )

  const allValid = po.items.every(item => {
    const s = getState(item)
    return parseFloat(s.qty_terima) >= 0
  })

  return (
    <div className="space-y-5 pb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center gap-4 bg-white/60 backdrop-blur-md p-4 rounded-3xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white border border-gray-100 shadow-sm text-gray-500 hover:text-[#3d2b1f] hover:shadow-md transition-all active:scale-95">
          <ArrowLeft size={18} />
        </button>
        <div>
          <div className="font-extrabold text-[#3d2b1f] tracking-tight text-lg leading-none">{po.nomor_po}</div>
          <div className="text-sm font-medium text-gray-500 mt-1">{po.supplier_nama}</div>
        </div>
      </div>

      {/* Upload Invoice */}
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[#f29744]/10 to-transparent rounded-bl-full pointer-events-none" />
        
        <div className="flex items-center justify-between mb-4 relative z-10">
          <div>
            <span className="block text-xs font-extrabold text-[#3d2b1f] tracking-wider uppercase">Faktur / Surat Jalan</span>
            <span className="text-[10px] text-gray-400 font-medium mt-0.5 block">Wajib foto bukti pengiriman dari supplier</span>
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploadingInvoice}
            className="flex items-center gap-2 text-xs font-bold text-white bg-gradient-to-r from-[#f29744] to-[#e67e22] shadow-md shadow-[#f29744]/20 hover:shadow-lg hover:shadow-[#f29744]/30 hover:-translate-y-0.5 transition-all disabled:opacity-50 px-4 py-2 rounded-xl active:scale-95"
          >
            <Camera size={14} />
            {uploadingInvoice ? 'Uploading...' : 'Foto Baru'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUploadInvoice} capture="environment" />
        </div>
        
        <div className="relative z-10">
          {po.invoice_urls.length === 0 ? (
            <button onClick={() => fileRef.current?.click()} className="w-full py-8 text-gray-400 bg-gray-50/50 hover:bg-gray-50 border-2 border-dashed border-gray-200 hover:border-[#f29744]/40 rounded-2xl transition-colors group flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                <Camera size={20} className="text-gray-300 group-hover:text-[#f29744]" />
              </div>
              <span className="text-xs font-medium">Ketuk untuk mengambil foto</span>
            </button>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
              {po.invoice_urls.map((_url, idx) => {
                const publicUrl = getInvoiceUrl(_url)
                const isPdf = _url.toLowerCase().includes('.pdf')
                return (
                  <a href={publicUrl} target="_blank" rel="noreferrer" key={idx} className="w-24 h-32 shrink-0 rounded-2xl overflow-hidden border border-gray-200/50 bg-gray-50 flex items-center justify-center shadow-sm relative group cursor-pointer hover:shadow-md transition-all">
                    {isPdf ? (
                      <div className="flex flex-col items-center justify-center p-2 text-center">
                        <FileText size={24} className="text-red-500 mb-1" />
                        <span className="text-[10px] font-bold text-gray-700">PDF</span>
                      </div>
                    ) : (
                      <img src={publicUrl} alt="Invoice" className="w-full h-full object-cover" loading="lazy" />
                    )}
                    <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition-colors" />
                    <div className="absolute bottom-2 right-2 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center shadow-md">
                      <CheckCircle2 size={12} className="text-white" />
                    </div>
                  </a>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Item Verifikasi */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-2">
          <div className="w-1 h-4 bg-[#f29744] rounded-full" />
          <h3 className="text-sm font-extrabold text-[#3d2b1f] uppercase tracking-wider">Verifikasi Item</h3>
        </div>
        
        {po.items.map((item, i) => {
          const s = getState(item)
          const qtyNum = parseFloat(s.qty_terima)
          const isKurang = !isNaN(qtyNum) && qtyNum < item.qty_pesan
          
          return (
            <div key={item.id} className="bg-white rounded-3xl border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] p-5 relative overflow-hidden transition-all duration-300" style={{ animationDelay: `${i * 100}ms` }}>
              {isKurang && <div className="absolute top-0 left-0 w-full h-1 bg-yellow-400" />}
              {s.kondisi === 'rusak' && <div className="absolute top-0 left-0 w-full h-1 bg-red-500" />}
              {s.kondisi === 'baik' && !isKurang && <div className="absolute top-0 left-0 w-full h-1 bg-green-500 opacity-50" />}

              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="font-extrabold text-[#3d2b1f] text-base leading-tight mb-1">{item.bahan_baku.nama}</div>
                  <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-gray-50 border border-gray-100 rounded-lg">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Dipesan</span>
                    <span className="text-xs font-extrabold text-[#e67e22]">{item.qty_pesan}</span>
                    <span className="text-[10px] font-bold text-gray-500">{item.bahan_baku.satuan}</span>
                  </div>
                </div>
                {isKurang && <span className="text-[10px] font-bold bg-yellow-100 text-yellow-700 px-2.5 py-1 rounded-full border border-yellow-200">Selisih Kurang</span>}
              </div>

              {/* Qty & Harga */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">
                    Fisik Diterima
                  </label>
                  <div className="relative">
                    <input
                      type="number" min="0" step="0.01"
                      value={s.qty_terima}
                      onChange={e => updateState(item.id, 'qty_terima', e.target.value)}
                      className={`w-full border-2 rounded-2xl px-4 py-3 text-base text-right font-extrabold focus:outline-none transition-colors ${
                        isKurang 
                          ? 'border-yellow-300 bg-yellow-50/50 text-yellow-800 focus:border-yellow-400 focus:bg-yellow-50' 
                          : 'border-gray-100 bg-gray-50/50 text-[#3d2b1f] focus:border-[#f29744]/40 focus:bg-white focus:ring-4 focus:ring-[#f29744]/10'
                      }`}
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">{item.bahan_baku.satuan}</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">
                    Harga Aktual / {item.bahan_baku.satuan}
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">Rp</span>
                    <input
                      type="number" min="0"
                      value={s.harga_terima}
                      onChange={e => updateState(item.id, 'harga_terima', e.target.value)}
                      placeholder={String(item.harga_pesan)}
                      className="w-full border-2 border-gray-100 bg-gray-50/50 rounded-2xl pl-10 pr-4 py-3 text-sm text-right font-bold text-[#3d2b1f] focus:outline-none focus:border-[#f29744]/40 focus:bg-white focus:ring-4 focus:ring-[#f29744]/10 transition-all placeholder:font-normal placeholder:text-gray-300"
                    />
                  </div>
                </div>
              </div>

              {/* Kondisi */}
              <div className="space-y-2 mb-1">
                <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">Kondisi Barang</label>
                <div className="flex gap-2">
                  {(['baik', 'kurang', 'rusak'] as const).map(k => {
                    const isSelected = s.kondisi === k;
                    let baseClass = "flex-1 py-2.5 rounded-xl text-xs font-extrabold capitalize transition-all duration-200 border-2 active:scale-95 "
                    
                    if (isSelected) {
                      if (k === 'baik') baseClass += "bg-green-500 border-green-500 text-white shadow-md shadow-green-500/20"
                      else if (k === 'kurang') baseClass += "bg-yellow-400 border-yellow-400 text-white shadow-md shadow-yellow-400/20"
                      else baseClass += "bg-red-500 border-red-500 text-white shadow-md shadow-red-500/20"
                    } else {
                      baseClass += "bg-white border-gray-100 text-gray-400 hover:border-gray-200 hover:bg-gray-50"
                    }

                    return (
                      <button key={k} onClick={() => updateState(item.id, 'kondisi', k)} className={baseClass}>
                        {k === 'baik' ? '✓ Baik' : k === 'kurang' ? '⚠ Kurang' : '✗ Rusak'}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Catatan (muncul jika kondisi bukan baik) */}
              <div className={`overflow-hidden transition-all duration-300 ease-in-out ${s.kondisi !== 'baik' ? 'max-h-24 mt-4 opacity-100' : 'max-h-0 opacity-0'}`}>
                <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Keterangan Kondisi</label>
                <input
                  type="text"
                  value={s.catatan}
                  onChange={e => updateState(item.id, 'catatan', e.target.value)}
                  placeholder="Jelaskan secara singkat..."
                  className="w-full border-2 border-gray-100 bg-gray-50 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:border-[#f29744]/40 focus:bg-white focus:ring-4 focus:ring-[#f29744]/10 transition-all"
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Submit */}
      <div className="pt-4 pb-8">
        <button
          onClick={handleSubmit}
          disabled={!allValid || verifikasi.isPending}
          className="w-full py-4 px-6 bg-gradient-to-r from-[#f29744] to-[#f57c00] text-white font-extrabold text-base tracking-wide rounded-2xl hover:shadow-[0_8px_30px_rgba(242,151,68,0.4)] hover:-translate-y-1 active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none shadow-[0_4px_20px_rgba(242,151,68,0.25)] flex items-center justify-center gap-3 relative overflow-hidden group"
        >
          <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out" />
          {verifikasi.isPending ? (
            <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <CheckCircle2 size={20} className="drop-shadow-sm" />
          )}
          {verifikasi.isPending ? 'Menyimpan Data...' : 'Konfirmasi Penerimaan Barang'}
        </button>
        <p className="text-center text-[11px] font-medium text-gray-400 mt-4 px-4 leading-relaxed">
          Stok otomatis dicatat menggunakan metode <strong className="text-gray-500">FIFO</strong>.<br/>Harga bahan baku akan di-update dari nilai aktual.
        </p>
      </div>
    </div>
  )
}

// ─── Page export ──────────────────────────────────────────────────────────────

export function TerimaBahanList() {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f8f3ec] to-[#f2eae1] flex flex-col font-sans">
      <div className="flex-1 overflow-y-auto px-4 py-6 pb-32 scrollbar-hide">
        {selectedId ? (
          <VerifikasiDetail poId={selectedId} onBack={() => setSelectedId(null)} />
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-6 px-1">
              <h1 className="text-2xl font-extrabold text-[#3d2b1f] tracking-tight">Terima Barang</h1>
              <p className="text-sm text-gray-500 font-medium mt-1 leading-relaxed max-w-[280px]">Verifikasi kedatangan barang dari supplier untuk menambah stok Kitchen.</p>
            </div>
            <PendingList onSelect={setSelectedId} />
          </div>
        )}
      </div>
      <BottomNav activeTab="terima-supplier" />
    </div>
  )
}
