'use client'

import React, { useState } from 'react'
import { Truck, Clock, PackageCheck, AlertCircle, Search, ArrowLeft } from 'lucide-react'
import { Spinner } from '@suka/design-system'
import Link from 'next/link'
import { createSupabaseBrowserClient } from '@suka/auth'
import { useQuery } from '@tanstack/react-query'

const supabase = createSupabaseBrowserClient()

type InboundPO = {
  id: string
  nomor_po: string
  supplier_nama: string
  tanggal_po: string
  status: string
  total_nilai: number
  jumlah_item: number
  jumlah_item_terima: number
}

export default function PenerimaanPOStokPage() {
  const [search, setSearch] = useState('')
  const [selectedPoId, setSelectedPoId] = useState<string | null>(null)

  const { data: inboundPos = [], isLoading, error } = useQuery<InboundPO[]>({
    queryKey: ['stok-inbound-pos'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_purchase_orders', {
        p_from: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
        p_to: new Date().toISOString().split('T')[0],
        p_status: null
      })
      if (error) throw error
      return (data ?? []).filter((p: any) => p.status === 'dikirim_ke_supplier' || p.status === 'sebagian_diterima')
    }
  })

  const filtered = search
    ? inboundPos.filter(p => p.nomor_po.toLowerCase().includes(search.toLowerCase()) || p.supplier_nama.toLowerCase().includes(search.toLowerCase()))
    : inboundPos

  return (
    <div className="min-h-screen bg-[#fff8f1] p-4 md:p-6 space-y-6">
      {/* Top Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="p-2 rounded-2xl bg-white border border-suka-brown/10 text-suka-brown hover:bg-suka-cream transition-all">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-black text-suka-brown font-display">Penerimaan PO Supplier (Inbound)</h1>
          <p className="text-xs text-suka-brown/70">Verifikasi fisik barang yang tiba di dapur dari supplier.</p>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-3xl border border-suka-brown/10 shadow-xs p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-black text-suka-brown text-base flex items-center gap-2">
              <Truck className="w-5 h-5 text-suka-orange" />
              Daftar PO Supplier Tiba
            </h2>
            <p className="text-xs text-suka-brown/70">Stok dapur akan otomatis ter-update secara real-time begitu barang diverifikasi.</p>
          </div>
          {inboundPos.length > 0 && (
            <div className="relative min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-suka-brown/40" />
              <input
                type="text"
                placeholder="Cari nomor PO / supplier..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs font-bold text-suka-brown bg-suka-cream/50 border border-suka-brown/10 rounded-xl focus:outline-none focus:border-suka-orange"
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
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-suka-brown/10 rounded-2xl bg-suka-cream/20 space-y-2">
            <PackageCheck className="w-8 h-8 mx-auto text-emerald-600 opacity-80" />
            <p className="text-xs font-black text-suka-brown">Tidak Ada PO Supplier Menunggu Diterima</p>
            <p className="text-[11px] text-suka-brown/60 max-w-sm mx-auto">
              Semua pengiriman supplier sudah terverifikasi lengkap atau belum ada PO baru yang disetujui.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map(po => (
              <div 
                key={po.id}
                className="bg-suka-cream/30 rounded-2xl border border-suka-brown/10 p-4 space-y-3 relative overflow-hidden"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-black text-sm text-suka-brown uppercase tracking-tight">{po.nomor_po}</span>
                  <span className="text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-widest bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Inbound
                  </span>
                </div>

                <div>
                  <div className="text-xs font-black text-suka-brown">{po.supplier_nama}</div>
                  <div className="text-[10px] text-suka-brown/60 font-semibold mt-0.5">
                    Tgl PO: {new Date(po.tanggal_po).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} · {po.jumlah_item} Jenis Item
                  </div>
                </div>

                <div className="pt-2 border-t border-suka-brown/10 flex items-center justify-between">
                  <div className="text-[10px] font-bold text-suka-brown/70">
                    Progress: <span className="text-suka-brown font-black">{po.jumlah_item_terima ?? 0}/{po.jumlah_item} Item</span>
                  </div>
                  <a
                    href={`/pembelian/${po.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-suka-orange text-white text-xs font-black rounded-xl hover:bg-orange-600 active:scale-95 transition-all flex items-center gap-1.5 shadow-xs"
                  >
                    <PackageCheck className="w-4 h-4" />
                    Terima Barang
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
