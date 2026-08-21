'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { deleteMitraTransfer } from './actions'
import { FileText, Download, Trash2, Search, Building2, Calendar, AlertTriangle, ArrowDownRight, ExternalLink, X } from 'lucide-react'
import { toast } from 'sonner'

export function TransferListView({ transfers = [], outlets = [] }: { transfers: any[], outlets: any[] }) {
  const [selectedOutlet, setSelectedOutlet] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmItem, setConfirmItem] = useState<any | null>(null)
  const [loadingUrlId, setLoadingUrlId] = useState<string | null>(null)

  const supabase = createClient()

  // Filter transfers based on outlet and search term
  const filteredTransfers = transfers.filter((t: any) => {
    const matchesOutlet = selectedOutlet === 'all' || t.outlet_id === selectedOutlet
    const outletName = t.outlets?.name || outlets.find((o: any) => o.id === t.outlet_id)?.name || ''
    const bulanStr = new Date(t.bulan).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
    const catatanStr = t.catatan || ''
    const searchLower = searchTerm.toLowerCase()
    
    const matchesSearch = !searchTerm || 
      outletName.toLowerCase().includes(searchLower) ||
      bulanStr.toLowerCase().includes(searchLower) ||
      catatanStr.toLowerCase().includes(searchLower)

    return matchesOutlet && matchesSearch
  })

  const handleOpenProof = async (transfer: any) => {
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
      await deleteMitraTransfer(confirmItem.id, confirmItem.bukti_url)
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
    <div className="space-y-6">
      {/* Search & Filter Header */}
      <div className="bg-white/70 backdrop-blur-xl border border-amber-100/80 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
        <div className="flex flex-1 flex-col md:flex-row gap-3 w-full">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Cari outlet, periode bulan, atau catatan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all placeholder-gray-400"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Outlet */}
          <div className="w-full md:w-64">
            <select
              value={selectedOutlet}
              onChange={(e) => setSelectedOutlet(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none bg-white text-gray-700 font-medium"
            >
              <option value="all">Semua Outlet ({outlets.length})</option>
              {outlets.map((o: any) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-xs font-bold text-gray-500 whitespace-nowrap">
          Menampilkan: <span className="text-gray-900 font-extrabold">{filteredTransfers.length}</span> / {transfers.length} bukti
        </div>
      </div>

      {/* Transfer List Table */}
      {filteredTransfers.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-xl border border-dashed border-gray-300 rounded-3xl p-12 text-center text-gray-500 shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-base font-extrabold text-gray-800">Belum Ada Bukti Transfer</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            {searchTerm || selectedOutlet !== 'all' 
              ? 'Tidak ditemukan bukti transfer yang sesuai dengan filter pencarian.' 
              : 'Belum ada berkas transfer yang diunggah ke sistem.'}
          </p>
        </div>
      ) : (
        <div className="bg-white/80 backdrop-blur-xl border border-amber-100/80 rounded-3xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.03)]">
          <div className="overflow-x-auto min-h-[40vh]">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50/80 border-b border-gray-100 text-gray-500 font-extrabold uppercase text-[11px] tracking-wider sticky top-0">
                <tr>
                  <th className="py-4 px-5">Outlet Mitra</th>
                  <th className="py-4 px-5">Periode Bulan</th>
                  <th className="py-4 px-5 text-right">Nominal Transfer</th>
                  <th className="py-4 px-5">Catatan</th>
                  <th className="py-4 px-5">Tgl Upload</th>
                  <th className="py-4 px-5 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTransfers.map((t: any) => {
                  const outletName = t.outlets?.name || outlets.find((o: any) => o.id === t.outlet_id)?.name || 'Outlet Tidak Ditemukan'
                  const bulanFormatted = new Date(t.bulan).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
                  const uploadDate = new Date(t.created_at).toLocaleDateString('id-ID', { 
                    day: 'numeric', 
                    month: 'short', 
                    year: 'numeric',
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })

                  return (
                    <tr key={t.id} className="hover:bg-amber-50/40 transition-colors group">
                      <td className="py-4 px-5 font-bold text-gray-900">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200/60">
                            <Building2 className="w-3.5 h-3.5" />
                          </div>
                          <span>{outletName}</span>
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-1.5 text-gray-700 font-semibold text-xs">
                          <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span>{bulanFormatted}</span>
                        </div>
                      </td>
                      <td className="py-4 px-5 text-right">
                        <span className="font-extrabold text-emerald-700 text-sm bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/60 inline-block">
                          {formatCurrency(t.nominal)}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-gray-600 text-xs max-w-xs truncate" title={t.catatan || '-'}>
                        {t.catatan || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-4 px-5 text-xs text-gray-500 whitespace-nowrap">
                        {uploadDate}
                      </td>
                      <td className="py-4 px-5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          {/* Open/Download button */}
                          <button
                            onClick={() => handleOpenProof(t)}
                            disabled={loadingUrlId === t.id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200/80 rounded-xl text-xs font-bold transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                            title="Lihat / Download Bukti Transfer"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-amber-600" />
                            {loadingUrlId === t.id ? 'Membuka...' : 'Lihat Bukti'}
                          </button>

                          {/* Delete button */}
                          <button
                            onClick={() => setConfirmItem(t)}
                            className="inline-flex items-center p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-transparent hover:border-rose-200 transition-colors"
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
          <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity" onClick={() => setConfirmItem(null)} />
          <div className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-4 border border-amber-100">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 bg-rose-50 rounded-2xl border border-rose-100">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900 leading-tight">Hapus Bukti Transfer</h3>
                <p className="text-xs text-gray-500">Konfirmasi penghapusan data transfer</p>
              </div>
            </div>

            <p className="text-sm text-gray-600">
              Apakah Anda yakin ingin menghapus berkas transfer untuk outlet{' '}
              <span className="font-extrabold text-gray-900">
                {confirmItem.outlets?.name || outlets.find((o: any) => o.id === confirmItem.outlet_id)?.name}
              </span>{' '}
              periode{' '}
              <span className="font-bold text-gray-900">
                {new Date(confirmItem.bulan).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
              </span>{' '}
              sebesar <span className="font-extrabold text-emerald-700">{formatCurrency(confirmItem.nominal)}</span>?
            </p>
            
            <p className="text-xs text-rose-600 bg-rose-50/80 p-3 rounded-2xl border border-rose-100">
              Data transaksi dan file berkas di storage akan dihapus secara permanen.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmItem(null)}
                disabled={deletingId === confirmItem.id}
                className="px-4 py-2.5 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deletingId === confirmItem.id}
                className="px-5 py-2.5 text-xs font-extrabold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors disabled:opacity-50 flex items-center shadow-lg shadow-rose-600/20"
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

