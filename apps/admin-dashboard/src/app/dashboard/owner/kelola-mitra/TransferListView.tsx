'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { deleteMitraTransfer } from './actions'
import { FileText, Trash2, Search, Building2, Calendar, AlertTriangle, ExternalLink, X } from 'lucide-react'
import { toast } from 'sonner'

interface TransferItem {
  id: string
  outlet_id: string
  bulan: string
  nominal: number
  catatan?: string | null
  bukti_url?: string | null
  created_at: string
  outlets?: {
    name?: string
  } | null
}

interface OutletItem {
  id: string
  name: string
}

interface TransferListViewProps {
  transfers?: TransferItem[]
  outlets?: OutletItem[]
}

export function TransferListView({ transfers = [], outlets = [] }: TransferListViewProps) {
  const [selectedOutlet, setSelectedOutlet] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmItem, setConfirmItem] = useState<TransferItem | null>(null)
  const [loadingUrlId, setLoadingUrlId] = useState<string | null>(null)

  const supabase = createClient()

  // Filter transfers based on outlet and search term
  const filteredTransfers = transfers.filter((t) => {
    const matchesOutlet = selectedOutlet === 'all' || t.outlet_id === selectedOutlet
    const outletName = t.outlets?.name || outlets.find((o) => o.id === t.outlet_id)?.name || ''
    const bulanStr = new Date(t.bulan).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
    const catatanStr = t.catatan || ''
    const searchLower = searchTerm.toLowerCase()
    
    const matchesSearch = !searchTerm || 
      outletName.toLowerCase().includes(searchLower) ||
      bulanStr.toLowerCase().includes(searchLower) ||
      catatanStr.toLowerCase().includes(searchLower)

    return matchesOutlet && matchesSearch
  })

  const handleOpenProof = async (transfer: TransferItem) => {
    if (!transfer.bukti_url) {
      toast.error('File bukti transfer tidak ditemukan')
      return
    }

    try {
      setLoadingUrlId(transfer.id)
      const { data, error } = await supabase.storage
        .from('mitra-transfers')
        .createSignedUrl(transfer.bukti_url, 60)

      if (error || !data?.signedUrl) {
        throw new Error(error?.message || 'Gagal membuat URL akses berkas')
      }

      window.open(data.signedUrl, '_blank')
    } catch (err: any) {
      toast.error(`Gagal membuka bukti transfer: ${err.message}`)
    } finally {
      setLoadingUrlId(null)
    }
  }

  const handleDelete = async () => {
    if (!confirmItem) return
    
    setDeletingId(confirmItem.id)
    try {
      await deleteMitraTransfer(confirmItem.id, confirmItem.bukti_url || undefined)
      toast.success('Bukti transfer berhasil dihapus')
      setConfirmItem(null)
    } catch (err: any) {
      toast.error(`Gagal menghapus bukti transfer: ${err.message}`)
    } finally {
      setDeletingId(null)
    }
  }

  const formatCurrency = (amount: number) => {
    return 'Rp ' + Math.round(amount || 0).toLocaleString('id-ID')
  }

  return (
    <div className="space-y-4">
      {/* Search & Filter Header */}
      <div className="bg-white/90 backdrop-blur-md border border-suka-brown/10 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between shadow-sm">
        <div className="flex flex-1 flex-col sm:flex-row gap-2.5 w-full">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-suka-gray-400" />
            <input
              type="text"
              placeholder="Cari outlet, periode bulan, atau catatan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-8 py-2 bg-white border border-suka-brown/15 rounded-xl text-xs sm:text-sm text-suka-brown focus:ring-2 focus:ring-suka-orange/20 focus:border-suka-orange outline-none transition-all placeholder:text-suka-gray-400 font-medium"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-suka-gray-400 hover:text-suka-brown transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Outlet */}
          <div className="w-full sm:w-60">
            <select
              value={selectedOutlet}
              onChange={(e) => setSelectedOutlet(e.target.value)}
              className="w-full border border-suka-brown/15 rounded-xl px-3 py-2 text-xs sm:text-sm focus:ring-2 focus:ring-suka-orange/20 focus:border-suka-orange outline-none bg-white text-suka-brown font-medium transition-all"
            >
              <option value="all">Semua Outlet ({outlets.length})</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-xs font-semibold text-suka-gray-500 self-end sm:self-center whitespace-nowrap">
          Menampilkan: <span className="text-suka-brown font-extrabold">{filteredTransfers.length}</span> / {transfers.length} bukti
        </div>
      </div>

      {/* Transfer List Table */}
      {filteredTransfers.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-md border border-dashed border-suka-brown/20 rounded-2xl p-10 sm:p-12 text-center text-suka-gray-500 shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-suka-orange/10 text-suka-orange flex items-center justify-center mx-auto">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-sm sm:text-base font-extrabold text-suka-brown">Belum Ada Bukti Transfer</h3>
          <p className="text-xs text-suka-gray-500 max-w-sm mx-auto leading-relaxed">
            {searchTerm || selectedOutlet !== 'all' 
              ? 'Tidak ditemukan bukti transfer yang sesuai dengan filter pencarian.' 
              : 'Belum ada berkas transfer yang diunggah ke sistem.'}
          </p>
        </div>
      ) : (
        <div className="bg-white/90 backdrop-blur-md border border-suka-brown/10 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto min-h-[360px]">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-suka-brown/[0.03] border-b border-suka-brown/10 text-suka-gray-500 font-extrabold uppercase text-[10px] sm:text-[11px] tracking-wider sticky top-0">
                <tr>
                  <th className="py-3.5 px-4 sm:px-5">Outlet Mitra</th>
                  <th className="py-3.5 px-4 sm:px-5">Periode Bulan</th>
                  <th className="py-3.5 px-4 sm:px-5 text-right">Nominal Transfer</th>
                  <th className="py-3.5 px-4 sm:px-5">Catatan</th>
                  <th className="py-3.5 px-4 sm:px-5">Tgl Upload</th>
                  <th className="py-3.5 px-4 sm:px-5 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-suka-brown/5">
                {filteredTransfers.map((t) => {
                  const outletName = t.outlets?.name || outlets.find((o) => o.id === t.outlet_id)?.name || 'Outlet Tidak Ditemukan'
                  const bulanFormatted = new Date(t.bulan).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
                  const uploadDate = new Date(t.created_at).toLocaleDateString('id-ID', { 
                    day: 'numeric', 
                    month: 'short', 
                    year: 'numeric',
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })

                  return (
                    <tr key={t.id} className="hover:bg-suka-orange/[0.02] transition-colors group">
                      <td className="py-3.5 px-4 sm:px-5 font-bold text-suka-brown">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-suka-orange/10 text-suka-orange flex items-center justify-center shrink-0 border border-suka-orange/20">
                            <Building2 className="w-3.5 h-3.5" />
                          </div>
                          <span className="truncate max-w-[180px] sm:max-w-none">{outletName}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 sm:px-5">
                        <div className="flex items-center gap-1.5 text-suka-brown/80 font-semibold text-xs whitespace-nowrap">
                          <Calendar className="w-3.5 h-3.5 text-suka-gray-400 shrink-0" />
                          <span>{bulanFormatted}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 sm:px-5 text-right whitespace-nowrap">
                        <span className="font-extrabold text-emerald-700 text-xs sm:text-sm bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/60 inline-block font-mono">
                          {formatCurrency(t.nominal)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 sm:px-5 text-suka-gray-600 text-xs max-w-[200px] truncate" title={t.catatan || '-'}>
                        {t.catatan || <span className="text-suka-gray-300">—</span>}
                      </td>
                      <td className="py-3.5 px-4 sm:px-5 text-xs text-suka-gray-500 whitespace-nowrap font-medium">
                        {uploadDate}
                      </td>
                      <td className="py-3.5 px-4 sm:px-5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Open/Download button */}
                          <button
                            onClick={() => handleOpenProof(t)}
                            disabled={loadingUrlId === t.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-suka-brown/5 text-suka-brown hover:bg-suka-orange hover:text-white border border-suka-brown/10 hover:border-suka-orange rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                            title="Lihat / Download Bukti Transfer"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>{loadingUrlId === t.id ? 'Membuka...' : 'Lihat'}</span>
                          </button>

                          {/* Delete button */}
                          <button
                            onClick={() => setConfirmItem(t)}
                            className="inline-flex items-center p-1.5 text-suka-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-200 transition-colors"
                            title="Hapus Bukti Transfer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Delete */}
      {confirmItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-suka-brown/60 backdrop-blur-sm transition-opacity" onClick={() => setConfirmItem(null)} />
          <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4 border border-suka-brown/10">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-100">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-suka-brown leading-tight">Hapus Bukti Transfer</h3>
                <p className="text-xs text-suka-gray-500">Konfirmasi penghapusan data transfer</p>
              </div>
            </div>

            <p className="text-sm text-suka-gray-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus berkas transfer untuk outlet{' '}
              <span className="font-extrabold text-suka-brown">
                {confirmItem.outlets?.name || outlets.find((o) => o.id === confirmItem.outlet_id)?.name}
              </span>{' '}
              periode{' '}
              <span className="font-bold text-suka-brown">
                {new Date(confirmItem.bulan).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
              </span>{' '}
              sebesar <span className="font-extrabold text-emerald-700">{formatCurrency(confirmItem.nominal)}</span>?
            </p>
            
            <p className="text-xs text-rose-600 bg-rose-50/80 p-3 rounded-xl border border-rose-100 font-medium">
              Data transaksi dan berkas di storage akan dihapus secara permanen.
            </p>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmItem(null)}
                disabled={deletingId === confirmItem.id}
                className="px-4 py-2 text-xs font-bold text-suka-brown bg-suka-brown/5 hover:bg-suka-brown/10 rounded-xl transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deletingId === confirmItem.id}
                className="px-4 py-2 text-xs font-extrabold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors disabled:opacity-50 flex items-center shadow-md shadow-rose-600/20"
              >
                {deletingId === confirmItem.id ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Menghapus...
                  </>
                ) : (
                  'Ya, Hapus Bukti'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

