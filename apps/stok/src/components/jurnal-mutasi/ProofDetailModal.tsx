'use client'

import React, { useEffect, useState } from 'react'
import { X, Loader2, FileText, Trash2, ShoppingBag, AlertTriangle, Bot } from 'lucide-react'

import { fetchProofDetails } from '@/app/actions/jurnalMutasi'

interface ProofDetailModalProps {
  type: 'surat_jalan' | 'waste' | 'order'
  id: string
  onClose: () => void
}

export function ProofDetailModal({ type, id, onClose }: ProofDetailModalProps) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    fetchProofDetails(type, id)
      .then((res) => {
        if (active) {
          setData(res.data)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message || 'Gagal memuat dokumen bukti')
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [type, id])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-suka-brown/10 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-suka-brown text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {type === 'surat_jalan' && <FileText className="w-5 h-5 text-amber-300" />}
            {type === 'waste' && <Trash2 className="w-5 h-5 text-red-300" />}
            {type === 'order' && <ShoppingBag className="w-5 h-5 text-emerald-300" />}
            <h3 className="font-black text-sm uppercase tracking-wider">
              {type === 'surat_jalan' && 'Bukti Surat Jalan Kiriman'}
              {type === 'waste' && 'Bukti Laporan Kerusakan/Waste'}
              {type === 'order' && 'Bukti Pesanan Kasir POS'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
          {loading && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-2">
              <Loader2 className="w-8 h-8 animate-spin text-suka-orange" />
              <p className="text-suka-brown/60 font-bold uppercase tracking-wider text-[11px]">
                Mengambil dokumen bukti...
              </p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && data && (
            <>
              {/* DETAIL SURAT JALAN */}
              {type === 'surat_jalan' && (
                <div className="space-y-4">
                  <div className="bg-suka-cream/40 p-4 rounded-2xl border border-suka-brown/10 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-suka-brown/60 font-bold">Nomor SJ:</span>
                      <span className="font-black text-suka-brown text-sm">{data.document_number}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-suka-brown/60 font-bold">Outlet Tujuan:</span>
                      <span className="font-bold text-suka-brown">{data.outlets?.name || '-'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-suka-brown/60 font-bold">Status:</span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800">
                        {data.status}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-suka-brown/60 font-bold">Tanggal Kirim:</span>
                      <span className="font-medium text-suka-brown">
                        {new Date(data.created_at).toLocaleString('id-ID')}
                      </span>
                    </div>
                    {data.auto_verified_at ? (
                      <div className="flex justify-between items-center text-purple-700 bg-purple-50 p-2.5 rounded-xl border border-purple-200">
                        <span className="font-bold flex items-center gap-1.5 text-xs">
                          <Bot size={14} className="text-purple-600" /> Diverifikasi Sistem (Auto):
                        </span>
                        <span className="font-black text-xs">
                          {new Date(data.auto_verified_at).toLocaleString('id-ID')}
                        </span>
                      </div>
                    ) : data.verified_at ? (
                      <div className="flex justify-between items-center text-emerald-700">
                        <span className="font-bold">Diverifikasi Outlet:</span>
                        <span className="font-medium">
                          {new Date(data.verified_at).toLocaleString('id-ID')}
                        </span>
                      </div>
                    ) : null}
                  </div>

                  {(data.notes || data.catatan) && (
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800">
                      <span className="font-bold">Catatan Pengiriman:</span> {data.notes || data.catatan}
                    </div>
                  )}


                  <div>
                    <h4 className="font-black text-suka-brown mb-2 uppercase tracking-wider text-[11px]">
                      Daftar Bahan Baku yang Dikirim
                    </h4>
                    <div className="border border-suka-brown/10 rounded-2xl overflow-hidden">
                      <table className="w-full text-left">
                        <thead className="bg-suka-brown/5 text-suka-brown/70 font-bold text-[10px] uppercase">
                          <tr>
                            <th className="p-2.5">Bahan</th>
                            <th className="p-2.5 text-right">Dikirim</th>
                            <th className="p-2.5 text-right">Diterima</th>
                            <th className="p-2.5 text-right">Harga Snapshot</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-suka-brown/10">
                          {(data.surat_jalan_item || []).map((item: any) => (
                            <tr key={item.id} className="hover:bg-suka-cream/20">
                              <td className="p-2.5 font-bold text-suka-brown">
                                {item.bahan_baku?.nama || 'Bahan'}
                              </td>
                              <td className="p-2.5 text-right font-medium">
                                {item.qty_dikirim} {item.bahan_baku?.satuan}
                              </td>
                              <td className="p-2.5 text-right font-bold text-emerald-700">
                                {item.qty_terima ?? item.qty_diterima ?? item.qty_dikirim} {item.bahan_baku?.satuan}
                              </td>

                              <td className="p-2.5 text-right text-suka-brown/70 font-medium">
                                {item.harga_snapshot ? `Rp ${Math.round(item.harga_snapshot).toLocaleString('id-ID')}` : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* DETAIL WASTE */}
              {type === 'waste' && (
                <div className="space-y-4">
                  <div className="bg-suka-cream/40 p-4 rounded-2xl border border-suka-brown/10 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-suka-brown/60 font-bold">Bahan Terbuang:</span>
                      <span className="font-black text-suka-brown text-sm">
                        {data.bahan_baku?.nama} ({data.qty} {data.bahan_baku?.satuan})
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-suka-brown/60 font-bold">Status Persetujuan:</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        data.status === 'APPROVED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : data.status === 'REJECTED'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {data.status}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-suka-brown/60 font-bold">Waktu Dilaporkan:</span>
                      <span className="font-medium text-suka-brown">
                        {new Date(data.created_at).toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-suka-brown/60 font-bold">Dilaporkan Oleh:</span>
                      <span className="font-bold text-suka-brown">{data.reported_by_staff?.name || '-'}</span>
                    </div>
                    {data.approved_by_staff && (
                      <div className="flex justify-between items-center text-emerald-700">
                        <span className="font-bold">Disetujui Oleh:</span>
                        <span className="font-bold">{data.approved_by_staff.name}</span>
                      </div>
                    )}
                  </div>

                  <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-red-800">
                    <span className="font-black">Alasan Kerusakan:</span>
                    <p className="mt-1 font-medium">{data.reason || 'Tidak ada keterangan alasan.'}</p>
                  </div>

                  {data.photo_url ? (
                    <div>
                      <h4 className="font-black text-suka-brown mb-2 uppercase tracking-wider text-[11px]">
                        Foto Bukti Fisik
                      </h4>
                      <div className="rounded-2xl overflow-hidden border border-suka-brown/10 bg-black/5 flex items-center justify-center max-h-60">
                        <img
                          src={data.photo_url}
                          alt="Bukti Waste"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-center text-suka-brown/40 italic py-4">
                      Tidak ada foto bukti yang dilampirkan.
                    </p>
                  )}
                </div>
              )}

              {/* DETAIL ORDER POS */}
              {type === 'order' && (
                <div className="space-y-4">
                  <div className="bg-suka-cream/40 p-4 rounded-2xl border border-suka-brown/10 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-suka-brown/60 font-bold">Nomor Pesanan:</span>
                      <span className="font-black text-suka-brown text-sm">#{data.order_number}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-suka-brown/60 font-bold">Waktu Transaksi:</span>
                      <span className="font-medium text-suka-brown">
                        {new Date(data.created_at).toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-suka-brown/60 font-bold">Total Pembayaran:</span>
                      <span className="font-black text-emerald-700 text-sm">
                        Rp {Math.round(data.total_amount || 0).toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-black text-suka-brown mb-2 uppercase tracking-wider text-[11px]">
                      Menu yang Dipesan Pelanggan (Pemicu Potongan BOM)
                    </h4>
                    <div className="border border-suka-brown/10 rounded-2xl overflow-hidden">
                      <table className="w-full text-left">
                        <thead className="bg-suka-brown/5 text-suka-brown/70 font-bold text-[10px] uppercase">
                          <tr>
                            <th className="p-2.5">Menu</th>
                            <th className="p-2.5 text-right">Qty</th>
                            <th className="p-2.5 text-right">Harga</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-suka-brown/10">
                          {(data.order_items || []).map((item: any) => (
                            <tr key={item.id} className="hover:bg-suka-cream/20">
                              <td className="p-2.5 font-bold text-suka-brown">{item.menu_item_name}</td>
                              <td className="p-2.5 text-right font-black text-suka-brown">{item.quantity}x</td>
                              <td className="p-2.5 text-right text-suka-brown/70">
                                Rp {Math.round(item.unit_price || 0).toLocaleString('id-ID')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-suka-cream/20 border-t border-suka-brown/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-suka-brown hover:bg-suka-brown/90 text-white rounded-xl font-black text-xs transition-all shadow-xs cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}
