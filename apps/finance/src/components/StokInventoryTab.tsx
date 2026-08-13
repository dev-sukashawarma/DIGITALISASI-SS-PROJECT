// @ts-nocheck
'use client'

import React, { useState } from 'react'
import { Package, Truck, CheckCircle2, Clock, PackageCheck, AlertCircle, Search, ArrowDownRight } from 'lucide-react'
import { usePurchaseOrders, type POSummary } from '@/hooks/usePurchaseOrder'
import { VerifikasiTerimaModal } from '@/app/pembelian/[id]/components/VerifikasiTerimaModal'
import { Spinner } from '@suka/design-system'
import Link from 'next/link'

export default function StokInventoryTab() {
  const { data: pos = [], isLoading, error } = usePurchaseOrders({ status: undefined })
  const [selectedPoId, setSelectedPoId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Inbound POs waiting for receiving
  const inboundPos = pos.filter(p => p.status === 'dikirim_ke_supplier' || p.status === 'sebagian_diterima')

  const filteredInbound = search
    ? inboundPos.filter(p => p.nomor_po.toLowerCase().includes(search.toLowerCase()) || p.supplier_nama.toLowerCase().includes(search.toLowerCase()))
    : inboundPos

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-suka-ink via-suka-brown to-black text-white rounded-3xl p-6 shadow-md flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest bg-white/10 px-3 py-1 rounded-full border border-white/10">
            Stok & Inbound Management
          </span>
          <h2 className="text-2xl font-black mt-2 font-display">Penerimaan Barang & Control Stok Dapur</h2>
          <p className="text-xs text-white/70 mt-1 max-w-xl">
            Verifikasi fisik barang yang datang dari supplier langsung di halaman ini. Stok akan otomatis bertambah ke Ledger Dapur secara real-time.
          </p>
        </div>
        <div className="bg-white/10 backdrop-blur-md rounded-2xl px-5 py-3 border border-white/10 text-center">
          <div className="text-2xl font-black text-amber-400">{inboundPos.length}</div>
          <div className="text-[10px] font-bold text-white/80 uppercase tracking-wider mt-0.5">PO Supplier Menunggu Tiba</div>
        </div>
      </div>

      {/* Widget Inbound PO Supplier (Kitchen Action Center) */}
      <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-suka-gray-200/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-black text-suka-brown text-base flex items-center gap-2">
              <Truck className="w-5 h-5 text-suka-orange" />
              Penerimaan PO Supplier (Inbound)
            </h3>
            <p className="text-xs text-suka-gray-500 font-medium">Klik "Terima Barang" saat truk supplier tiba di gudang/dapur.</p>
          </div>
          {inboundPos.length > 0 && (
            <div className="relative min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-suka-gray-400" />
              <input
                type="text"
                placeholder="Cari PO..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs font-bold text-suka-ink bg-white border border-suka-gray-200 rounded-xl focus:outline-none focus:border-suka-orange"
              />
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl text-xs font-bold">
            Gagal memuat data PO: {(error as Error).message}
          </div>
        ) : filteredInbound.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed border-suka-gray-200 rounded-2xl bg-white/50 space-y-2">
            <PackageCheck className="w-8 h-8 mx-auto text-emerald-500 opacity-80" />
            <p className="text-xs font-extrabold text-suka-brown">Tidak Ada PO Supplier Menunggu Diterima</p>
            <p className="text-[11px] text-suka-gray-400 max-w-sm mx-auto">
              Semua pengiriman supplier sudah terverifikasi lengkap atau belum ada PO baru yang disetujui.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredInbound.map(po => (
              <div 
                key={po.id}
                className="bg-white rounded-2xl border border-suka-gray-200/80 hover:border-suka-orange/60 shadow-xs hover:shadow-md transition-all p-4 space-y-3 relative overflow-hidden"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-black text-sm text-suka-ink uppercase tracking-tight">{po.nomor_po}</span>
                  <span className="text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-widest bg-blue-50 text-blue-600 border border-blue-200 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Inbound
                  </span>
                </div>

                <div>
                  <div className="text-xs font-black text-suka-brown">{po.supplier_nama}</div>
                  <div className="text-[10px] text-suka-gray-400 font-semibold mt-0.5">
                    Tgl PO: {new Date(po.tanggal_po).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} · {po.jumlah_item} Jenis Item
                  </div>
                </div>

                <div className="pt-2 border-t border-suka-gray-100 flex items-center justify-between">
                  <div className="text-[10px] font-bold text-suka-gray-500">
                    Progress: <span className="text-suka-brown font-black">{po.jumlah_item_terima ?? 0}/{po.jumlah_item} Item</span>
                  </div>
                  <button
                    onClick={() => setSelectedPoId(po.id)}
                    className="px-4 py-2 bg-gradient-to-r from-suka-brown to-suka-ink text-white text-xs font-black rounded-xl hover:from-suka-ink hover:to-black active:scale-95 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <PackageCheck className="w-4 h-4 text-suka-orange" />
                    Terima Barang
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Render Modal Verifikasi jika ada PO yang dipilih */}
      {selectedPoId && (
        <VerifikasiTerimaModal
          poId={selectedPoId}
          onClose={() => setSelectedPoId(null)}
        />
      )}
    </div>
  )
}
