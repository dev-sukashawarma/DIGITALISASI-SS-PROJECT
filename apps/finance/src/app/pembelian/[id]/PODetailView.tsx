// @ts-nocheck
'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Camera, PackageCheck, ExternalLink, CheckCircle2, AlertTriangle, Clock, Ban, Truck, TrendingUp, TrendingDown, RefreshCw, FileText, Printer } from 'lucide-react'
import { usePODetail, useUpdatePOStatus, useUploadInvoice, getSignedInvoiceUrl, type POStatus, type POWithItems, type POItem } from '@/hooks/usePurchaseOrder'
import { useBahanBakuOptions } from '@/hooks/usePurchaseOrder'
import { rupiah } from '@/lib/format'
import { PageHeader } from '@/components/ui'
import { VerifikasiTerimaModal } from './components/VerifikasiTerimaModal'
import { generatePurchaseOrderPDF } from '@/utils/poPdfExporter'
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
  draft: 'bg-stone-100 text-stone-600 border-stone-200',
  menunggu_approval_finance: 'bg-amber-50 text-amber-800 border-amber-200',
  dikirim_ke_supplier: 'bg-blue-50 text-blue-700 border-blue-200',
  sebagian_diterima: 'bg-orange-50 text-orange-700 border-orange-200',
  diterima_lengkap: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  dibatalkan: 'bg-rose-50 text-rose-700 border-rose-200',
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
      <div className="bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl w-full max-w-md border border-suka-brown/10 overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-suka-brown/5 flex items-center gap-3 bg-suka-cream/40">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
            <RefreshCw className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-suka-brown text-base">Perbarui Harga Master?</h2>
            <p className="text-xs text-suka-brown/60 font-medium">Harga aktual berbeda &gt; 5% dari harga master</p>
          </div>
        </div>

        {/* Items */}
        <div className="divide-y divide-suka-brown/5 max-h-72 overflow-y-auto p-2">
          {diffs.map(({ item, harga_master, selisih_pct }) => {
            const isChecked = checked.has(item.bahan_baku_id)
            const naik = selisih_pct > 0
            const pct = Math.abs(selisih_pct * 100).toFixed(1)
            return (
              <label
                key={item.bahan_baku_id}
                className="flex items-center gap-3 p-3.5 rounded-2xl cursor-pointer hover:bg-suka-cream/40 transition-all select-none"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggle(item.bahan_baku_id)}
                  className="w-4 h-4 accent-suka-orange rounded cursor-pointer"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-suka-brown text-xs truncate">
                    {(item as any).bahan_baku?.nama || (item as any).item_description || (item as any).bahan_baku_id}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-suka-brown/60 font-semibold tabular-nums">
                      {harga_master !== null ? rupiah(harga_master) : '—'}
                    </span>
                    <span className="text-suka-brown/30 text-xs">→</span>
                    <span className="text-xs font-bold text-suka-brown tabular-nums">
                      {rupiah(item.harga_terima!)}
                    </span>
                    <span className={`flex items-center gap-0.5 text-[9px] font-bold px-2 py-0.5 rounded-lg border ${
                      naik ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'
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
        <div className="p-5 border-t border-suka-brown/5 flex gap-3 bg-suka-cream/30">
          <button
            onClick={onSkip}
            disabled={saving}
            className="flex-1 py-2.5 border border-suka-brown/20 text-suka-brown/70 rounded-2xl text-xs font-bold hover:bg-white transition-colors disabled:opacity-50 cursor-pointer"
          >
            Lewati
          </button>
          <button
            onClick={() => onConfirm([...checked])}
            disabled={saving || selectedCount === 0}
            className="flex-[2] py-2.5 bg-gradient-to-r from-suka-brown to-suka-ink text-white rounded-2xl text-xs font-bold hover:opacity-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm cursor-pointer"
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
  const { data: bahanBakuOptions = [] } = useBahanBakuOptions()
  const fileRef = useRef<HTMLInputElement>(null)
  const [invoiceUrls, setInvoiceUrls] = useState<string[]>([])
  const [showPriceSync, setShowPriceSync] = useState(false)
  const [showVerifikasi, setShowVerifikasi] = useState(false)
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
    <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-2xl flex items-center gap-3 text-xs font-bold">
      <AlertTriangle className="w-5 h-5 shrink-0" />
      <span>PO tidak ditemukan atau gagal dimuat.</span>
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
        .filter(it => it.harga_terima !== null && it.bahan_baku_id !== null)
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
    <div className="space-y-6 animate-fade-in pb-12 font-sans">
      {/* Price Sync Modal */}
      {showVerifikasi && <VerifikasiTerimaModal po={po} onClose={() => setShowVerifikasi(false)} />}
      {showPriceSync && (
        <PriceSyncModal
          diffs={priceDiffs}
          onConfirm={handlePriceSync}
          onSkip={() => setShowPriceSync(false)}
          saving={syncSaving}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.back()} 
            className="p-2.5 rounded-2xl bg-white border border-suka-brown/15 hover:bg-suka-cream text-suka-brown/70 hover:text-suka-brown transition-all shadow-2xs cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-suka-brown font-mono tracking-tight">{po.nomor_po}</h1>
              <span className={`text-[10px] font-bold px-3 py-0.5 rounded-lg uppercase tracking-wider border ${STATUS_COLOR[po.status]}`}>
                {STATUS_LABEL[po.status]}
              </span>
            </div>
            <p className="text-xs font-semibold text-suka-brown/60 mt-1">
              Supplier: <span className="text-suka-brown font-bold">{po.supplier_nama}</span> · Dibuat pada {new Date(po.tanggal_po).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            generatePurchaseOrderPDF({
              id: po.id,
              nomor_po: po.nomor_po,
              supplier_nama: po.supplier_nama,
              tanggal_po: po.tanggal_po,
              status: po.status,
              jatuh_tempo: po.jatuh_tempo,
              catatan: po.catatan,
              nama_dibuat_oleh: po.nama_dibuat_oleh,
              nama_disetujui_oleh: po.nama_disetujui_oleh,
              diverifikasi_at: po.diverifikasi_at,
              supplier: po.supplier,
              items: (po.items || []).map(it => ({
                nama_item: it.nama_item || it.bahan_baku?.nama || it.item_description || 'Item',
                satuan: it.satuan || it.bahan_baku?.satuan || 'pcs',
                qty_pesan: Number(it.qty_pesan || 0),
                harga_pesan: Number(it.harga_pesan || 0),
                subtotal: Number(it.subtotal) || (Number(it.qty_pesan || 0) * Number(it.harga_pesan || 0)),
                catatan: it.catatan
              }))
            })
            toast.success(po.status === 'draft' || po.status === 'menunggu_approval_finance' ? 'Draft PDF PO berhasil diunduh!' : 'PDF Purchase Order berhasil diunduh!')
          }}
          className="self-start sm:self-auto flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white border border-suka-brown/15 hover:bg-suka-cream text-suka-brown font-bold text-xs shadow-2xs hover:shadow-xs transition-all active:scale-95 cursor-pointer shrink-0"
        >
          <Printer className="w-4 h-4 text-suka-orange" />
          <span>{po.status === 'draft' || po.status === 'menunggu_approval_finance' ? 'Unduh Draft PDF PO' : 'Cetak / Unduh PDF PO'}</span>
        </button>
      </div>

      {/* Price Sync Banner */}
      {isReceived && priceDiffs.length > 0 && !syncDone && (
        <div className="bg-amber-50/90 backdrop-blur-xl border border-amber-200 rounded-3xl p-4 flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <RefreshCw className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-900">
                {priceDiffs.length} Bahan baku memiliki harga aktual berbeda dari harga master
              </p>
              <p className="text-[11px] text-amber-700 font-medium">Terdapat selisih harga &gt; 5% dari harga master saat ini.</p>
            </div>
          </div>
          <button
            onClick={() => setShowPriceSync(true)}
            className="shrink-0 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 active:scale-95 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Perbarui Harga Master</span>
          </button>
        </div>
      )}

      {/* Sync done confirmation */}
      {syncDone && (
        <div className="bg-emerald-50/90 backdrop-blur-xl border border-emerald-200 rounded-3xl p-4 flex items-center gap-3 text-emerald-800 font-semibold text-xs shadow-2xs">
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
            color: selisih < 0 ? 'text-rose-700' : 'text-emerald-800' },
          { label: 'Jumlah Item', value: `${po.items.length} Item`, icon: Truck },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white/95 backdrop-blur-xl rounded-3xl border border-suka-brown/10 shadow-sm p-4 sm:p-5">
            <div className="flex items-center gap-1.5 text-suka-brown/50 mb-1">
              <Icon className="w-3.5 h-3.5 text-suka-orange" />
              <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
            </div>
            <div className={`text-base sm:text-lg font-bold tracking-tight tabular-nums ${color ?? 'text-suka-brown'}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Daftar Item Table */}
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl border border-suka-brown/10 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-suka-brown/5 bg-suka-cream/40">
          <h2 className="font-bold text-suka-brown text-sm uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-suka-orange" />
            Daftar Item Bahan Baku PO
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[750px] whitespace-nowrap text-xs sm:text-sm">
            <thead>
              <tr className="bg-suka-cream/70 text-suka-brown/80 text-[11px] uppercase font-bold tracking-wider border-b border-suka-brown/10 select-none">
                <th className="py-4 px-5">Nama Bahan Baku</th>
                <th className="py-4 px-5 text-right">Qty Pesan</th>
                <th className="py-4 px-5 text-right">Harga Pesan</th>
                <th className="py-4 px-5 text-right">Qty Diterima</th>
                <th className="py-4 px-5 text-right">Harga Aktual</th>
                <th className="py-4 px-5 text-right">Subtotal</th>
                <th className="py-4 px-5 text-center">Kondisi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-suka-brown/5 text-suka-ink font-medium">
              {po.items.map(item => {
                const priceDiff = item.harga_terima && Math.abs((item.harga_terima - item.harga_pesan) / item.harga_pesan) > 0.05
                return (
                  <tr key={item.id} className="hover:bg-amber-50/40 transition-colors">
                    <td className="py-4 px-5 font-bold text-suka-brown">
                      {(item as any).bahan_baku?.nama ?? '—'}
                      <span className="text-[11px] text-suka-brown/60 font-semibold ml-1.5">({(item as any).bahan_baku?.satuan || (item as any).satuan_ad_hoc || '—'})</span>
                    </td>
                    <td className="py-4 px-5 text-right font-bold text-suka-ink tabular-nums">{item.qty_pesan}</td>
                    <td className="py-4 px-5 text-right text-suka-brown/60 font-semibold tabular-nums">{rupiah(item.harga_pesan)}</td>
                    <td className="py-4 px-5 text-right font-bold tabular-nums">
                      {item.qty_terima !== null ? (
                        <span className={item.qty_terima < item.qty_pesan ? 'text-amber-800' : 'text-emerald-800'}>
                          {item.qty_terima}
                        </span>
                      ) : <span className="text-suka-brown/30 font-normal">—</span>}
                    </td>
                    <td className="py-4 px-5 text-right font-bold tabular-nums">
                      {item.harga_terima !== null ? (
                        <span className={priceDiff ? 'text-rose-700' : 'text-suka-brown'}>
                          {rupiah(item.harga_terima)}
                          {priceDiff && <span className="text-[10px] ml-1 text-rose-700">⚠</span>}
                        </span>
                      ) : <span className="text-suka-brown/30 font-normal">—</span>}
                    </td>
                    <td className="py-4 px-5 text-right font-bold text-suka-brown text-sm tabular-nums">
                      {item.subtotal > 0 ? rupiah(item.subtotal) : '—'}
                    </td>
                    <td className="py-4 px-5 text-center">
                      {item.kondisi ? (
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-lg uppercase tracking-wider border ${
                          item.kondisi === 'baik' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                          item.kondisi === 'kurang' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                          'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>{item.kondisi}</span>
                      ) : <span className="text-suka-brown/30 text-xs">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Photos */}
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl border border-suka-brown/10 shadow-sm p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-suka-brown text-sm uppercase tracking-wider flex items-center gap-2">
            <Camera className="w-4 h-4 text-suka-orange" />
            Foto Invoice Supplier
          </h2>
          {po.status !== 'dibatalkan' && (
            <>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploadInvoice.isPending}
                className="flex items-center gap-1.5 text-xs font-bold text-suka-orange hover:text-suka-brown bg-suka-orange/10 px-3.5 py-1.5 rounded-xl border border-suka-orange/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>{uploadInvoice.isPending ? 'Uploading...' : 'Upload Foto Invoice'}</span>
              </button>
              <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleUploadInvoice} capture="environment" />
            </>
          )}
        </div>

        {invoiceUrls.length === 0 ? (
          <div className="text-center py-10 text-suka-brown/50 border border-dashed border-suka-brown/20 rounded-2xl bg-suka-cream/20">
            <Camera className="w-8 h-8 mx-auto mb-2 text-suka-brown/30" />
            <p className="text-xs font-bold text-suka-brown">Belum ada foto invoice</p>
            <p className="text-[11px] text-suka-brown/60 mt-0.5">Unggah foto fisik invoice dari supplier untuk keperluan rekap &amp; audit.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {invoiceUrls.map((url, idx) => (
              <a key={idx} href={url} target="_blank" rel="noopener noreferrer"
                className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-suka-brown/10 hover:border-suka-orange hover:shadow-md transition-all group">
                <img src={url} alt={`Invoice ${idx + 1}`} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-suka-ink/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <ExternalLink className="w-5 h-5 text-white" />
                </div>
                <div className="absolute bottom-2 right-2 bg-suka-ink/80 text-white text-[9px] font-bold px-2 py-0.5 rounded-md">
                  Doc {idx + 1}
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Catatan */}
      {po.catatan && (
        <div className="bg-amber-50/90 backdrop-blur-xl border border-amber-200 rounded-2xl p-4 text-xs font-medium text-amber-900 shadow-2xs">
          <span className="font-bold text-amber-900 uppercase tracking-wider mr-1">Catatan PO:</span>{po.catatan}
        </div>
      )}

      {/* Verifikasi info */}
      {po.diverifikasi_at && (
        <div className="bg-emerald-50/90 backdrop-blur-xl border border-emerald-200 rounded-2xl p-4 text-xs font-semibold text-emerald-800 flex items-center gap-2 shadow-2xs">
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
            className="flex-1 py-3 bg-gradient-to-r from-suka-brown to-suka-ink text-white rounded-2xl font-bold text-xs hover:opacity-95 active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-suka-brown/20 cursor-pointer"
          >
            {updateStatus.isPending ? <Spinner className="w-4 h-4" /> : <Truck className="w-4 h-4" />}
            <span>{NEXT_STATUS_LABEL[po.status]}</span>
          </button>
        )}
        {(po.status === 'dikirim_ke_supplier' || po.status === 'sebagian_diterima') && (
          <button
            onClick={() => setShowVerifikasi(true)}
            className="flex-1 py-3 bg-gradient-to-r from-suka-ink to-blue-900 text-white rounded-2xl font-bold text-xs hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
          >
            <PackageCheck className="w-4 h-4" />
            <span>Terima Barang</span>
          </button>
        )}
        {po.status === 'draft' && (
          <button
            onClick={() => updateStatus.mutate({ id: po.id, status: 'dibatalkan' })}
            disabled={updateStatus.isPending}
            className="px-5 py-3 border border-rose-200 text-rose-700 bg-white hover:bg-rose-50 rounded-2xl font-bold text-xs transition-all flex items-center gap-2 disabled:opacity-50 active:scale-95 shadow-2xs cursor-pointer"
          >
            <Ban className="w-4 h-4" />
            <span>Batalkan PO</span>
          </button>
        )}
      </div>
    </div>
  )
}