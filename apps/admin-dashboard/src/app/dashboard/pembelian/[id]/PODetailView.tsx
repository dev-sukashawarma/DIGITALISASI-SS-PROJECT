'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Camera, ExternalLink, CheckCircle2, AlertTriangle, Clock, Ban, Truck, TrendingUp, TrendingDown, RefreshCw, FileText } from 'lucide-react'
import { usePODetail, useUpdatePOStatus, useUploadInvoice, getSignedInvoiceUrl, type POStatus, type POWithItems, type POItem } from '@/hooks/usePurchaseOrder'
import { useBahanBakuOptions } from '@/hooks/usePurchaseOrder'
import { useBahanBakuHargaMutations } from '@/hooks/useBahanBakuHargaMutations'
import { rupiah } from '@/lib/format'
import { PageHeader } from '@/components/ui'
import { Spinner } from '@suka/design-system'
import { toast } from 'sonner'

const STATUS_LABEL: Record<POStatus, string> = {
  draft: 'Draft',
  menunggu_approval_finance: 'Menunggu Approval Finance',
  dikirim_ke_supplier: 'Dikirim ke Supplier',
  sebagian_diterima: 'Sebagian Diterima',
  diterima_lengkap: 'Diterima Lengkap',
  dibatalkan: 'Dibatalkan',
}

const STATUS_COLOR: Record<POStatus, string> = {
  draft: 'bg-suka-gray-100 text-suka-gray-500 border-suka-gray-200',
  menunggu_approval_finance: 'bg-orange-50 text-suka-orange border-orange-200/80 shadow-2xs',
  dikirim_ke_supplier: 'bg-blue-50 text-blue-600 border-blue-200/80 shadow-2xs',
  sebagian_diterima: 'bg-yellow-50 text-yellow-700 border-yellow-200/80 shadow-2xs',
  diterima_lengkap: 'bg-emerald-50 text-emerald-700 border-emerald-200/80 shadow-2xs',
  dibatalkan: 'bg-red-50 text-red-600 border-red-200/80 shadow-2xs',
}

const NEXT_STATUS: Partial<Record<POStatus, POStatus>> = {
  draft: 'menunggu_approval_finance',
  menunggu_approval_finance: undefined,
  dikirim_ke_supplier: undefined,
}

const NEXT_STATUS_LABEL: Partial<Record<POStatus, string>> = {
  draft: 'Ajukan ke Finance',
}

type PriceDiffItem = {
  item: POItem
  harga_master: number | null
  selisih_pct: number
}

function PriceSyncModal({
  diffs,
  onConfirm,
  onSkip,
  saving,
}: {
  diffs: PriceDiffItem[]
  onConfirm: (selectedIds: string[]) => void
  onSkip: () => void
  saving: boolean
}) {
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(diffs.filter(d => d.item.harga_terima !== null).map(d => d.item.bahan_baku_id))
  )

  function toggle(id: string) {
    setChecked(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectedCount = checked.size

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-suka-ink/60 backdrop-blur-md animate-fade-in font-sans">
      <div className="bg-white/90 backdrop-blur-2xl rounded-3xl shadow-2xl w-full max-w-md border border-suka-gray-200/60 overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-suka-gray-100 flex items-center gap-3 bg-white/40">
          <div className="w-10 h-10 rounded-2xl bg-orange-50 border border-orange-200/80 text-suka-orange flex items-center justify-center shrink-0 shadow-2xs">
            <RefreshCw className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-extrabold text-suka-brown text-base">Perbarui Harga Master?</h2>
            <p className="text-xs text-suka-gray-400 font-medium">Harga aktual berbeda &gt; 5% dari harga master</p>
          </div>
        </div>

        {/* Items */}
        <div className="divide-y divide-suka-gray-100 max-h-72 overflow-y-auto p-2">
          {diffs.map(({ item, harga_master, selisih_pct }) => {
            const isChecked = checked.has(item.bahan_baku_id)
            const naik = selisih_pct > 0
            const pct = Math.abs(selisih_pct * 100).toFixed(1)
            return (
              <label
                key={item.bahan_baku_id}
                className="flex items-center gap-3 p-3.5 rounded-2xl cursor-pointer hover:bg-white transition-all select-none"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggle(item.bahan_baku_id)}
                  className="w-4 h-4 accent-suka-orange rounded cursor-pointer"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-extrabold text-suka-brown text-xs truncate">
                    {(item as any).bahan_baku?.nama ?? item.bahan_baku_id}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-suka-gray-400 font-semibold">
                      {harga_master !== null ? rupiah(harga_master) : '—'}
                    </span>
                    <span className="text-suka-gray-300 text-xs">→</span>
                    <span className="text-xs font-black text-suka-ink">
                      {rupiah(item.harga_terima!)}
                    </span>
                    <span className={`flex items-center gap-0.5 text-[9px] font-black px-2 py-0.5 rounded-full border ${
                      naik ? 'bg-red-50 text-red-600 border-red-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                    }`}>
                      {naik ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {naik ? '+' : '-'}{pct}%
                    </span>
                  </div>
                </div>
              </label>
            )
          })}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-suka-gray-100 flex gap-3 bg-white/40">
          <button
            onClick={onSkip}
            disabled={saving}
            className="flex-1 py-3 border border-suka-gray-200 text-suka-gray-500 rounded-2xl text-xs font-bold hover:bg-suka-gray-50 transition-colors disabled:opacity-50"
          >
            Lewati
          </button>
          <button
            onClick={() => onConfirm([...checked])}
            disabled={saving || selectedCount === 0}
            className="flex-[2] py-3 bg-gradient-to-r from-suka-brown to-suka-ink text-white rounded-2xl text-xs font-extrabold hover:from-suka-ink hover:to-black transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-md"
          >
            {saving ? <Spinner className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
            Update {selectedCount > 0 ? `(${selectedCount} item)` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PODetailView({ id, initialData }: { id: string, initialData: POWithItems }) {
  const router = useRouter()
  const { data: po, isLoading, error } = usePODetail(id, initialData)
  const updateStatus = useUpdatePOStatus()
  const uploadInvoice = useUploadInvoice()
  const { setHarga } = useBahanBakuHargaMutations()
  const { data: bahanBakuOptions = [] } = useBahanBakuOptions()
  const fileRef = useRef<HTMLInputElement>(null)
  const [invoiceUrls, setInvoiceUrls] = useState<string[]>([])
  const [showPriceSync, setShowPriceSync] = useState(false)
  const [syncSaving, setSyncSaving] = useState(false)
  const [syncDone, setSyncDone] = useState(false)

  useEffect(() => {
    if (!po?.invoice_urls?.length) return
    Promise.all(po.invoice_urls.map(path => getSignedInvoiceUrl(path)))
      .then(setInvoiceUrls)
      .catch(console.error)
  }, [po?.invoice_urls])

  if (isLoading && !po) return <div className="flex justify-center py-16"><Spinner className="w-8 h-8 text-suka-orange" /></div>
  if (error || !po) return (
    <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl flex items-center gap-3">
      <AlertTriangle className="w-5 h-5 shrink-0" />
      <span className="text-xs font-bold">PO tidak ditemukan atau gagal dimuat.</span>
    </div>
  )

  const totalPesan = po.items.reduce((s, it) => s + it.qty_pesan * it.harga_pesan, 0)
  const totalTerima = po.items.reduce((s, it) =>
    s + (it.qty_terima ?? 0) * (it.harga_terima ?? it.harga_pesan), 0)
  const selisih = totalTerima - totalPesan
  const nextStatus = NEXT_STATUS[po.status]

  const isReceived = po.status === 'diterima_lengkap' || po.status === 'sebagian_diterima'

  const priceDiffs: PriceDiffItem[] = isReceived
    ? po.items
        .filter(it => it.harga_terima !== null)
        .map(it => {
          const option = bahanBakuOptions.find(b => b.id === it.bahan_baku_id)
          const harga_master = option?.harga_beli ?? null
          const selisih_pct = harga_master !== null && harga_master > 0
            ? (it.harga_terima! - harga_master) / harga_master
            : it.harga_terima !== null ? 1 : 0
          return { item: it, harga_master, selisih_pct }
        })
        .filter(d => Math.abs(d.selisih_pct) > 0.05)
    : []

  async function handlePriceSync(selectedBahanBakuIds: string[]) {
    setSyncSaving(true)
    try {
      const toUpdate = priceDiffs.filter(d => selectedBahanBakuIds.includes(d.item.bahan_baku_id))
      await Promise.all(
        toUpdate.map(d =>
          setHarga.mutateAsync({ bahan_baku_id: d.item.bahan_baku_id, harga_beli: d.item.harga_terima! })
        )
      )
      toast.success(`Harga master diperbarui untuk ${toUpdate.length} bahan baku`)
      setSyncDone(true)
      setShowPriceSync(false)
    } catch (e: any) {
      toast.error('Gagal update harga: ' + e.message)
    } finally {
      setSyncSaving(false)
    }
  }

  async function handleUploadInvoice(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    await uploadInvoice.mutateAsync({ poId: po!.id, file })
    e.target.value = ''
  }

  return (
    <div className="space-y-6 max-w-4xl animate-fade-in pb-12">
      {/* Price Sync Modal */}
      {showPriceSync && (
        <PriceSyncModal
          diffs={priceDiffs}
          onConfirm={handlePriceSync}
          onSkip={() => setShowPriceSync(false)}
          saving={syncSaving}
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <button 
          onClick={() => router.back()} 
          className="p-2.5 rounded-2xl bg-white border border-suka-gray-200 hover:bg-suka-gray-50 text-suka-gray-500 hover:text-suka-brown transition-all shadow-2xs"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-black text-suka-brown font-mono tracking-tight">{po.nomor_po}</h1>
            <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest border ${STATUS_COLOR[po.status]}`}>
              {STATUS_LABEL[po.status]}
            </span>
          </div>
          <p className="text-xs font-bold text-suka-gray-400 mt-1">
            Supplier: <span className="text-suka-brown">{po.supplier_nama}</span> · Dibuat pada {new Date(po.tanggal_po).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Price Sync Banner */}
      {isReceived && priceDiffs.length > 0 && !syncDone && (
        <div className="bg-amber-50/80 backdrop-blur-xl border border-amber-200/80 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <RefreshCw className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-extrabold text-amber-900">
                {priceDiffs.length} Bahan baku memiliki harga aktual berbeda dari harga master
              </p>
              <p className="text-[11px] text-amber-700 font-medium">Terdapat selisih harga &gt; 5% dari harga master saat ini.</p>
            </div>
          </div>
          <button
            onClick={() => setShowPriceSync(true)}
            className="shrink-0 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-xl transition-all shadow-xs flex items-center gap-1.5 active:scale-95"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Perbarui Harga Master
          </button>
        </div>
      )}

      {/* Sync done confirmation */}
      {syncDone && (
        <div className="bg-emerald-50/80 backdrop-blur-xl border border-emerald-200 rounded-2xl p-4 flex items-center gap-3 text-emerald-800 font-bold text-xs shadow-2xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Harga master berhasil diperbarui sesuai transaksi PO ini.</span>
        </div>
      )}

      {/* Info Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Estimasi', value: rupiah(totalPesan), icon: Clock },
          { label: 'Total Diterima', value: totalTerima > 0 ? rupiah(totalTerima) : '—', icon: CheckCircle2 },
          { label: 'Selisih Nilai', value: totalTerima > 0 ? rupiah(selisih) : '—', icon: selisih < 0 ? AlertTriangle : CheckCircle2,
            color: selisih < 0 ? 'text-red-600' : 'text-emerald-600' },
          { label: 'Jumlah Item', value: `${po.items.length} Item`, icon: Truck },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white/70 backdrop-blur-xl rounded-3xl border border-suka-gray-200/60 shadow-[0_4px_20px_rgba(0,0,0,0.03)] p-4 sm:p-5">
            <div className="flex items-center gap-1.5 text-suka-gray-400 mb-1">
              <Icon className="w-3.5 h-3.5 text-suka-orange" />
              <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
            </div>
            <div className={`text-base font-black tracking-tight ${color ?? 'text-suka-brown'}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Daftar Item Table */}
      <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-suka-gray-200/60 shadow-[0_4px_20px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="p-5 border-b border-suka-gray-100 bg-white/40">
          <h2 className="font-black text-suka-brown text-sm uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-suka-orange" />
            Daftar Item Bahan Baku PO
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[750px] whitespace-nowrap">
            <thead>
              <tr className="bg-suka-cream/40 text-suka-gray-500 text-[9px] uppercase font-black tracking-widest border-b border-suka-gray-100">
                <th className="py-4 px-6">Nama Bahan Baku</th>
                <th className="py-4 px-6 text-right">Qty Pesan</th>
                <th className="py-4 px-6 text-right">Harga Pesan</th>
                <th className="py-4 px-6 text-right">Qty Diterima</th>
                <th className="py-4 px-6 text-right">Harga Aktual</th>
                <th className="py-4 px-6 text-right">Subtotal</th>
                <th className="py-4 px-6 text-center">Kondisi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-suka-gray-100 text-xs">
              {po.items.map(item => {
                const priceDiff = item.harga_terima && Math.abs((item.harga_terima - item.harga_pesan) / item.harga_pesan) > 0.05
                return (
                  <tr key={item.id} className="hover:bg-white/80 transition-all">
                    <td className="py-4 px-6 font-extrabold text-suka-brown text-sm">
                      {(item as any).bahan_baku?.nama ?? '—'}
                      <span className="text-xs text-suka-gray-400 font-semibold ml-1.5">({(item as any).bahan_baku?.satuan})</span>
                    </td>
                    <td className="py-4 px-6 text-right font-bold text-suka-ink">{item.qty_pesan}</td>
                    <td className="py-4 px-6 text-right text-suka-gray-400 font-medium">{rupiah(item.harga_pesan)}</td>
                    <td className="py-4 px-6 text-right font-black">
                      {item.qty_terima !== null ? (
                        <span className={item.qty_terima < item.qty_pesan ? 'text-amber-600 font-extrabold' : 'text-emerald-600 font-extrabold'}>
                          {item.qty_terima}
                        </span>
                      ) : <span className="text-suka-gray-300 font-normal">—</span>}
                    </td>
                    <td className="py-4 px-6 text-right font-black">
                      {item.harga_terima !== null ? (
                        <span className={priceDiff ? 'text-orange-600 font-black' : 'text-suka-brown'}>
                          {rupiah(item.harga_terima)}
                          {priceDiff && <span className="text-[10px] ml-1 text-orange-600">⚠</span>}
                        </span>
                      ) : <span className="text-suka-gray-300 font-normal">—</span>}
                    </td>
                    <td className="py-4 px-6 text-right font-black text-suka-brown text-sm">
                      {item.subtotal > 0 ? rupiah(item.subtotal) : '—'}
                    </td>
                    <td className="py-4 px-6 text-center">
                      {item.kondisi ? (
                        <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-widest border ${
                          item.kondisi === 'baik' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          item.kondisi === 'kurang' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          'bg-red-50 text-red-600 border-red-200'
                        }`}>{item.kondisi}</span>
                      ) : <span className="text-suka-gray-300 text-xs">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Photos */}
      <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-suka-gray-200/60 shadow-[0_4px_20px_rgba(0,0,0,0.03)] p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-black text-suka-brown text-sm uppercase tracking-widest flex items-center gap-2">
            <Camera className="w-4 h-4 text-suka-orange" />
            Foto Invoice Supplier
          </h2>
          {po.status !== 'dibatalkan' && (
            <>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploadInvoice.isPending}
                className="flex items-center gap-1.5 text-xs font-black text-suka-orange hover:text-orange-600 bg-orange-50 px-3.5 py-1.5 rounded-xl border border-orange-200/60 transition-all active:scale-95 disabled:opacity-50"
              >
                <Camera className="w-4 h-4" />
                {uploadInvoice.isPending ? 'Uploading...' : 'Upload Foto Invoice'}
              </button>
              <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleUploadInvoice} capture="environment" />
            </>
          )}
        </div>

        {invoiceUrls.length === 0 ? (
          <div className="text-center py-10 text-suka-gray-400 border-2 border-dashed border-suka-gray-200 rounded-2xl bg-white/40">
            <Camera className="w-8 h-8 mx-auto mb-2 text-suka-gray-300" />
            <p className="text-xs font-bold text-suka-brown">Belum ada foto invoice</p>
            <p className="text-[11px] text-suka-gray-400 mt-0.5">Unggah foto fisik invoice dari supplier untuk keperluan rekap & audit.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {invoiceUrls.map((url, idx) => (
              <a key={idx} href={url} target="_blank" rel="noopener noreferrer"
                className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-suka-gray-200/80 hover:border-suka-orange hover:shadow-md transition-all group">
                <img src={url} alt={`Invoice ${idx + 1}`} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-suka-ink/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <ExternalLink className="w-5 h-5 text-white" />
                </div>
                <div className="absolute bottom-2 right-2 bg-suka-ink/80 text-white text-[9px] font-black px-2 py-0.5 rounded-md">
                  Doc {idx + 1}
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Catatan */}
      {po.catatan && (
        <div className="bg-amber-50/80 backdrop-blur-xl border border-amber-200/80 rounded-2xl p-4 text-xs font-medium text-amber-900 shadow-2xs">
          <span className="font-black text-amber-900 uppercase tracking-widest mr-1">Catatan PO:</span>{po.catatan}
        </div>
      )}

      {/* Verifikasi info */}
      {po.diverifikasi_at && (
        <div className="bg-emerald-50/80 backdrop-blur-xl border border-emerald-200 rounded-2xl p-4 text-xs font-bold text-emerald-800 flex items-center gap-2 shadow-2xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Diverifikasi oleh Kitchen pada {new Date(po.diverifikasi_at).toLocaleString('id-ID')}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 flex-wrap pt-2">
        {nextStatus && NEXT_STATUS_LABEL[po.status] && (
          <button
            onClick={() => updateStatus.mutate({ id: po.id, status: nextStatus })}
            disabled={updateStatus.isPending}
            className="flex-1 py-3.5 bg-gradient-to-r from-suka-brown to-suka-ink text-white rounded-2xl font-extrabold text-sm hover:from-suka-ink hover:to-black active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(44,24,16,0.15)]"
          >
            {updateStatus.isPending ? <Spinner className="w-5 h-5" /> : <Truck className="w-5 h-5" />}
            {NEXT_STATUS_LABEL[po.status]}
          </button>
        )}
        {po.status === 'draft' && (
          <button
            onClick={() => updateStatus.mutate({ id: po.id, status: 'dibatalkan' })}
            disabled={updateStatus.isPending}
            className="px-6 py-3.5 border border-red-200 text-red-600 bg-white hover:bg-red-50 rounded-2xl font-extrabold text-sm transition-all flex items-center gap-2 disabled:opacity-50 active:scale-95 shadow-2xs"
          >
            <Ban className="w-4 h-4" /> Batalkan PO
          </button>
        )}
      </div>
    </div>
  )
}
