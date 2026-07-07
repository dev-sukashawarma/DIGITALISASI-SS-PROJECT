'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Camera, ExternalLink, CheckCircle2, AlertTriangle, Clock, Ban, Truck } from 'lucide-react'
import { usePODetail, useUpdatePOStatus, useUploadInvoice, getSignedInvoiceUrl, type POStatus, type POWithItems } from '@/hooks/usePurchaseOrder'
import { rupiah } from '@/lib/format'
import { Spinner } from '@suka/design-system'

const STATUS_LABEL: Record<POStatus, string> = {
  draft: 'Draft',
  dikirim_ke_supplier: 'Dikirim ke Supplier',
  sebagian_diterima: 'Sebagian Diterima',
  diterima_lengkap: 'Diterima Lengkap',
  dibatalkan: 'Dibatalkan',
}

const STATUS_COLOR: Record<POStatus, string> = {
  draft: 'bg-gray-100 text-gray-600',
  dikirim_ke_supplier: 'bg-blue-100 text-blue-700',
  sebagian_diterima: 'bg-yellow-100 text-yellow-700',
  diterima_lengkap: 'bg-green-100 text-green-700',
  dibatalkan: 'bg-red-100 text-red-600',
}

const NEXT_STATUS: Partial<Record<POStatus, POStatus>> = {
  draft: 'dikirim_ke_supplier',
  dikirim_ke_supplier: undefined, // verifikasi dilakukan di distribusi oleh kitchen
}

const NEXT_STATUS_LABEL: Partial<Record<POStatus, string>> = {
  draft: 'Kirim ke Supplier',
}

export default function PODetailView({ id, initialData }: { id: string, initialData: POWithItems }) {
  const router = useRouter()
  const { data: po, isLoading, error } = usePODetail(id, initialData)
  const updateStatus = useUpdatePOStatus()
  const uploadInvoice = useUploadInvoice()
  const fileRef = useRef<HTMLInputElement>(null)
  const [invoiceUrls, setInvoiceUrls] = useState<string[]>([])

  // Load signed URLs for invoice photos
  useEffect(() => {
    if (!po?.invoice_urls?.length) return
    Promise.all(po.invoice_urls.map(path => getSignedInvoiceUrl(path)))
      .then(setInvoiceUrls)
      .catch(console.error)
  }, [po?.invoice_urls])

  if (isLoading && !po) return <div className="flex justify-center py-16"><Spinner /></div>
  if (error || !po) return (
    <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl flex items-center gap-3">
      <AlertTriangle size={18} />
      <span className="text-sm">PO tidak ditemukan atau gagal dimuat.</span>
    </div>
  )

  const totalPesan = po.items.reduce((s, it) => s + it.qty_pesan * it.harga_pesan, 0)
  const totalTerima = po.items.reduce((s, it) =>
    s + (it.qty_terima ?? 0) * (it.harga_terima ?? it.harga_pesan), 0)
  const selisih = totalTerima - totalPesan
  const nextStatus = NEXT_STATUS[po.status]

  async function handleUploadInvoice(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    await uploadInvoice.mutateAsync({ poId: po!.id, file })
    e.target.value = ''
  }

  return (
    <div className="space-y-5 max-w-3xl animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-suka-gray-50 text-gray-400 hover:text-suka-brown transition-colors mt-0.5">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-extrabold text-suka-brown font-mono tracking-tight">{po.nomor_po}</h1>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${STATUS_COLOR[po.status]}`}>
              {STATUS_LABEL[po.status]}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{po.supplier_nama} · {new Date(po.tanggal_po).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Estimasi', value: rupiah(totalPesan), icon: Clock },
          { label: 'Total Diterima', value: totalTerima > 0 ? rupiah(totalTerima) : '—', icon: CheckCircle2 },
          { label: 'Selisih', value: totalTerima > 0 ? rupiah(selisih) : '—', icon: selisih < 0 ? AlertTriangle : CheckCircle2,
            color: selisih < 0 ? 'text-red-600' : 'text-green-600' },
          { label: 'Jumlah Item', value: `${po.items.length} item`, icon: Truck },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-suka-gray-200 shadow-sm p-4">
            <div className="flex items-center gap-1.5 text-gray-400 mb-1">
              <Icon size={13} />
              <span className="text-[11px] font-bold uppercase tracking-wide">{label}</span>
            </div>
            <div className={`text-base font-extrabold ${color ?? 'text-suka-brown'}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Daftar Item */}
      <div className="bg-white rounded-2xl border border-suka-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-suka-gray-100">
          <h2 className="font-bold text-suka-brown text-sm uppercase tracking-wide">Daftar Bahan</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-suka-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wide">
                <th className="text-left px-5 py-3">Bahan</th>
                <th className="text-right px-4 py-3">Qty Pesan</th>
                <th className="text-right px-4 py-3">Harga Pesan</th>
                <th className="text-right px-4 py-3">Qty Diterima</th>
                <th className="text-right px-4 py-3">Harga Aktual</th>
                <th className="text-right px-4 py-3">Subtotal</th>
                <th className="text-center px-4 py-3">Kondisi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-suka-gray-100">
              {po.items.map(item => {
                const priceDiff = item.harga_terima && Math.abs((item.harga_terima - item.harga_pesan) / item.harga_pesan) > 0.05
                return (
                  <tr key={item.id} className="hover:bg-suka-gray-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-suka-ink">
                      {(item as any).bahan_baku?.nama ?? '—'}
                      <span className="text-xs text-gray-400 ml-1">({(item as any).bahan_baku?.satuan})</span>
                    </td>
                    <td className="px-4 py-3 text-right">{item.qty_pesan}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{rupiah(item.harga_pesan)}</td>
                    <td className="px-4 py-3 text-right">
                      {item.qty_terima !== null ? (
                        <span className={item.qty_terima < item.qty_pesan ? 'text-yellow-600 font-bold' : 'text-green-600 font-bold'}>
                          {item.qty_terima}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {item.harga_terima !== null ? (
                        <span className={priceDiff ? 'text-orange-600 font-bold' : ''}>
                          {rupiah(item.harga_terima)}
                          {priceDiff && <span className="text-[10px] ml-1">⚠</span>}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-suka-brown">
                      {item.subtotal > 0 ? rupiah(item.subtotal) : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.kondisi ? (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          item.kondisi === 'baik' ? 'bg-green-100 text-green-700' :
                          item.kondisi === 'kurang' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-600'
                        }`}>{item.kondisi}</span>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Photos */}
      <div className="bg-white rounded-2xl border border-suka-gray-200 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-suka-brown text-sm uppercase tracking-wide">Foto Invoice Supplier</h2>
          {po.status !== 'dibatalkan' && (
            <>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploadInvoice.isPending}
                className="flex items-center gap-2 text-sm font-bold text-suka-orange hover:text-suka-orange/80 transition-colors disabled:opacity-50"
              >
                <Camera size={14} />
                {uploadInvoice.isPending ? 'Uploading...' : 'Upload Foto'}
              </button>
              <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleUploadInvoice} capture="environment" />
            </>
          )}
        </div>

        {invoiceUrls.length === 0 ? (
          <div className="text-center py-8 text-gray-400 border-2 border-dashed border-suka-gray-200 rounded-xl">
            <Camera size={28} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">Belum ada foto invoice</p>
            <p className="text-xs mt-1">Foto invoice fisik dari supplier untuk audit</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {invoiceUrls.map((url, idx) => (
              <a key={idx} href={url} target="_blank" rel="noopener noreferrer"
                className="relative aspect-[3/4] rounded-xl overflow-hidden border border-suka-gray-200 hover:border-suka-orange hover:shadow-md transition-all group">
                <img src={url} alt={`Invoice ${idx + 1}`} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <ExternalLink size={20} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                  {idx + 1}
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Catatan */}
      {po.catatan && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
          <span className="font-bold">Catatan: </span>{po.catatan}
        </div>
      )}

      {/* Verifikasi info */}
      {po.diverifikasi_at && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800 flex items-center gap-2">
          <CheckCircle2 size={16} />
          <span>Diverifikasi pada {new Date(po.diverifikasi_at).toLocaleString('id-ID')}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 flex-wrap">
        {nextStatus && NEXT_STATUS_LABEL[po.status] && (
          <button
            onClick={() => updateStatus.mutate({ id: po.id, status: nextStatus })}
            disabled={updateStatus.isPending}
            className="flex-1 py-3 bg-suka-orange text-white rounded-xl font-bold text-sm hover:bg-suka-orange/90 active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {updateStatus.isPending ? <Spinner className="w-4 h-4" /> : <Truck size={16} />}
            {NEXT_STATUS_LABEL[po.status]}
          </button>
        )}
        {po.status === 'draft' && (
          <button
            onClick={() => updateStatus.mutate({ id: po.id, status: 'dibatalkan' })}
            disabled={updateStatus.isPending}
            className="px-5 py-3 border border-red-200 text-red-600 rounded-xl font-bold text-sm hover:bg-red-50 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Ban size={14} /> Batalkan PO
          </button>
        )}
        {po.status === 'dikirim_ke_supplier' && (
          <div className="flex-1 py-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl text-sm text-center font-medium">
            ⏳ Menunggu verifikasi penerimaan oleh kitchen di app Distribusi
          </div>
        )}
      </div>
    </div>
  )
}
