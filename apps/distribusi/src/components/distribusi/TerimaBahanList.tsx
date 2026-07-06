'use client'
import { useState, useRef } from 'react'
import { usePOPending, usePODetailKitchen, useVerifikasiPO, uploadInvoiceKitchen, type POItemVerif } from '@/hooks/usePOKitchen'
import { BottomNav } from '@/components/distribusi/BottomNav'
import { Package, ChevronRight, ArrowLeft, Camera, CheckCircle2, AlertCircle, Clock } from 'lucide-react'
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
    <div className="flex justify-center py-16">
      <div className="w-8 h-8 border-4 border-[#f29744]/30 border-t-[#f29744] rounded-full animate-spin" />
    </div>
  )

  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm flex items-center gap-2">
      <AlertCircle size={16} /> Gagal memuat data
    </div>
  )

  if (pos.length === 0) return (
    <div className="text-center py-20 text-gray-400">
      <CheckCircle2 size={44} className="mx-auto mb-3 opacity-30" />
      <p className="font-bold">Tidak ada PO yang perlu diverifikasi</p>
      <p className="text-sm mt-1">Semua kiriman supplier sudah diproses</p>
    </div>
  )

  return (
    <div className="space-y-2">
      {pos.map(po => (
        <button key={po.id} onClick={() => onSelect(po.id)}
          className="w-full text-left bg-white rounded-2xl border border-[#d9c2b2]/40 shadow-sm p-4 flex items-center gap-4 hover:border-[#f29744]/40 hover:shadow-md active:scale-[0.99] transition-all group">
          <div className="w-10 h-10 bg-[#f29744]/10 rounded-xl flex items-center justify-center shrink-0">
            <Package size={18} className="text-[#f29744]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-[#3d2b1f] font-mono text-sm">{po.nomor_po}</div>
            <div className="text-sm text-gray-600 truncate">{po.supplier_nama}</div>
            <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
              <Clock size={10} />
              {new Date(po.tanggal_po).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
              <span className="mx-1">·</span>
              {po.jumlah_item} item
            </div>
          </div>
          <ChevronRight size={16} className="text-gray-300 group-hover:text-[#f29744] transition-colors shrink-0" />
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
    <div className="flex justify-center py-16">
      <div className="w-8 h-8 border-4 border-[#f29744]/30 border-t-[#f29744] rounded-full animate-spin" />
    </div>
  )

  const allValid = po.items.every(item => {
    const s = getState(item)
    return parseFloat(s.qty_terima) >= 0
  })

  return (
    <div className="space-y-4 pb-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={onBack} className="p-2 rounded-xl bg-white border border-[#d9c2b2]/40 text-gray-400 hover:text-[#3d2b1f] transition-colors mt-0.5 active:scale-95">
          <ArrowLeft size={18} />
        </button>
        <div>
          <div className="font-extrabold text-[#3d2b1f] font-mono">{po.nomor_po}</div>
          <div className="text-sm text-gray-500">{po.supplier_nama}</div>
        </div>
      </div>

      {/* Upload Invoice */}
      <div className="bg-white rounded-2xl border border-[#d9c2b2]/40 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Foto Invoice Supplier</span>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploadingInvoice}
            className="flex items-center gap-1.5 text-xs font-bold text-[#f29744] hover:text-[#f29744]/80 transition-colors disabled:opacity-50 bg-[#f29744]/10 px-3 py-1.5 rounded-lg active:scale-95"
          >
            <Camera size={12} />
            {uploadingInvoice ? 'Uploading...' : 'Foto Invoice'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUploadInvoice} capture="environment" />
        </div>
        {po.invoice_urls.length === 0 ? (
          <div className="text-center py-4 text-gray-400 text-xs border-2 border-dashed border-[#d9c2b2]/40 rounded-xl">
            Belum ada foto invoice — klik tombol di atas untuk foto
          </div>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {po.invoice_urls.map((_url, idx) => (
              <div key={idx} className="w-20 h-28 shrink-0 rounded-xl overflow-hidden border border-[#d9c2b2]/40 bg-gray-50 flex items-center justify-center text-xs text-gray-400">
                <Camera size={20} className="opacity-40" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Item Verifikasi */}
      <div className="space-y-3">
        <div className="text-xs font-bold text-gray-500 uppercase tracking-wide px-1">Verifikasi Setiap Bahan</div>
        {po.items.map(item => {
          const s = getState(item)
          const qtyNum = parseFloat(s.qty_terima)
          const isKurang = !isNaN(qtyNum) && qtyNum < item.qty_pesan
          return (
            <div key={item.id} className="bg-white rounded-2xl border border-[#d9c2b2]/40 shadow-sm p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-bold text-[#3d2b1f]">{item.bahan_baku.nama}</div>
                  <div className="text-xs text-gray-400">Dipesan: {item.qty_pesan} {item.bahan_baku.satuan}</div>
                </div>
                {isKurang && <span className="text-[10px] font-bold bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Kurang</span>}
              </div>

              {/* Qty & Harga */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">
                    Qty Diterima ({item.bahan_baku.satuan})
                  </label>
                  <input
                    type="number" min="0" step="0.01"
                    value={s.qty_terima}
                    onChange={e => updateState(item.id, 'qty_terima', e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2.5 text-sm text-right font-bold focus:outline-none focus:ring-2 focus:ring-[#f29744]/30 ${isKurang ? 'border-yellow-300 bg-yellow-50' : 'border-[#d9c2b2]/60'}`}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">
                    Harga Aktual / {item.bahan_baku.satuan}
                  </label>
                  <input
                    type="number" min="0"
                    value={s.harga_terima}
                    onChange={e => updateState(item.id, 'harga_terima', e.target.value)}
                    placeholder={String(item.harga_pesan)}
                    className="w-full border border-[#d9c2b2]/60 rounded-xl px-3 py-2.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#f29744]/30"
                  />
                </div>
              </div>

              {/* Kondisi */}
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Kondisi</label>
                <div className="flex gap-2">
                  {(['baik', 'kurang', 'rusak'] as const).map(k => (
                    <button
                      key={k}
                      onClick={() => updateState(item.id, 'kondisi', k)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold capitalize transition-all active:scale-95 ${
                        s.kondisi === k
                          ? k === 'baik' ? 'bg-green-500 text-white' : k === 'kurang' ? 'bg-yellow-400 text-white' : 'bg-red-500 text-white'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {k === 'baik' ? '✓ Baik' : k === 'kurang' ? '⚠ Kurang' : '✗ Rusak'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Catatan (muncul jika kondisi bukan baik) */}
              {s.kondisi !== 'baik' && (
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Keterangan</label>
                  <input
                    type="text"
                    value={s.catatan}
                    onChange={e => updateState(item.id, 'catatan', e.target.value)}
                    placeholder="Jelaskan kondisi barang..."
                    className="w-full border border-[#d9c2b2]/60 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f29744]/30"
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!allValid || verifikasi.isPending}
        className="w-full py-4 bg-[#f29744] text-white font-extrabold text-base rounded-2xl hover:bg-[#f29744]/90 active:scale-[0.99] transition-all disabled:opacity-50 shadow-md flex items-center justify-center gap-2"
      >
        {verifikasi.isPending ? (
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <CheckCircle2 size={20} />
        )}
        {verifikasi.isPending ? 'Memproses...' : 'Konfirmasi Terima Barang'}
      </button>
      <p className="text-center text-xs text-gray-400">
        Stok Kitchen dan harga bahan baku akan otomatis diperbarui setelah konfirmasi.
      </p>
    </div>
  )
}

// ─── Page export ──────────────────────────────────────────────────────────────

export function TerimaBahanList() {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  return (
    <div className="min-h-screen bg-[#f5ede3] flex flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-5 pb-28">
        {selectedId ? (
          <VerifikasiDetail poId={selectedId} onBack={() => setSelectedId(null)} />
        ) : (
          <>
            <div className="mb-5">
              <h1 className="text-xl font-extrabold text-[#3d2b1f]">Terima Barang dari Supplier</h1>
              <p className="text-sm text-gray-500 mt-0.5">Verifikasi barang yang dikirim supplier ke Kitchen.</p>
            </div>
            <PendingList onSelect={setSelectedId} />
          </>
        )}
      </div>
      <BottomNav activeTab="terima-supplier" />
    </div>
  )
}
