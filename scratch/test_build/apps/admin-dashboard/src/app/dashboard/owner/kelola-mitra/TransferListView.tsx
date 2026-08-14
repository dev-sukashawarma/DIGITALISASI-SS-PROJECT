'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { deleteMitraTransfer } from './actions'
import { FileText, Download, Trash2, Search, Building2, Calendar, AlertTriangle } from 'lucide-react'

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
      alert('File bukti transfer tidak ditemukan')
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
      alert(`Gagal membuka bukti transfer: ${err.message}`)
    } finally {
      setLoadingUrlId(null)
    }
  }

  const handleDelete = async () => {
    if (!confirmItem) return
    
    setDeletingId(confirmItem.id)
    try {
      await deleteMitraTransfer(confirmItem.id, confirmItem.bukti_url)
      setConfirmItem(null)
    } catch (err: any) {
      alert(`Gagal menghapus bukti transfer: ${err.message}`)
    } finally {
      setDeletingId(null)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(amount || 0)
  }

  return (
    <div className="space-y-6">
      {/* Search & Filter Header */}
      <div className="bg-white border rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
        <div className="flex flex-1 flex-col md:flex-row gap-3 w-full">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Cari outlet, periode, atau catatan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Filter Outlet */}
          <div className="w-full md:w-64">
            <select
              value={selectedOutlet}
              onChange={(e) => setSelectedOutlet(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            >
              <option value="all">Semua Outlet ({outlets.length})</option>
              {outlets.map((o: any) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-xs text-gray-500 font-medium whitespace-nowrap">
          Menampilkan <span className="font-bold text-gray-900">{filteredTransfers.length}</span> dari {transfers.length} bukti transfer
        </div>
      </div>

      {/* Transfer List Table / Grid */}
      {filteredTransfers.length === 0 ? (
        <div className="bg-white border rounded-xl p-12 text-center text-gray-500 shadow-sm">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-gray-700 mb-1">Belum Ada Bukti Transfer</h3>
          <p className="text-sm text-gray-500">
            {searchTerm || selectedOutlet !== 'all' 
              ? 'Tidak ditemukan bukti transfer yang sesuai dengan filter pencarian.' 
              : 'Belum ada bukti transfer yang di-upload.'}
          </p>
        </div>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b text-gray-600 font-semibold uppercase text-xs">
                <tr>
                  <th className="py-3.5 px-4">Outlet</th>
                  <th className="py-3.5 px-4">Periode Bulan</th>
                  <th className="py-3.5 px-4">Nominal Transfer</th>
                  <th className="py-3.5 px-4">Catatan</th>
                  <th className="py-3.5 px-4">Tgl Upload</th>
                  <th className="py-3.5 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y text-gray-700">
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
                    <tr key={t.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-4 px-4 font-semibold text-gray-900">
                        <div className="flex items-center space-x-2">
                          <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
                          <span>{outletName}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-1.5 text-gray-700">
                          <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                          <span>{bulanFormatted}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 font-bold text-green-700">
                        {formatCurrency(t.nominal)}
                      </td>
                      <td className="py-4 px-4 text-gray-500 max-w-xs truncate">
                        {t.catatan || '-'}
                      </td>
                      <td className="py-4 px-4 text-xs text-gray-500 whitespace-nowrap">
                        {uploadDate}
                      </td>
                      <td className="py-4 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center space-x-2">
                          {/* Open/Download button */}
                          <button
                            onClick={() => handleOpenProof(t)}
                            disabled={loadingUrlId === t.id}
                            className="inline-flex items-center px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 text-xs font-semibold transition-colors disabled:opacity-50"
                            title="Lihat / Download Bukti Transfer"
                          >
                            <Download className="w-3.5 h-3.5 mr-1" />
                            {loadingUrlId === t.id ? 'Memuat...' : 'Lihat Bukti'}
                          </button>

                          {/* Delete button */}
                          <button
                            onClick={() => setConfirmItem(t)}
                            className="inline-flex items-center p-1.5 text-red-600 hover:bg-red-50 rounded-lg border border-red-200 transition-colors"
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
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmItem(null)} />
          <div className="relative bg-white w-full max-w-md rounded-xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center space-x-3 text-red-600">
              <div className="p-2 bg-red-100 rounded-full">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Konfirmasi Hapus Bukti Transfer</h3>
            </div>

            <p className="text-sm text-gray-600">
              Apakah Anda yakin ingin menghapus bukti transfer untuk outlet{' '}
              <span className="font-bold text-gray-900">
                {confirmItem.outlets?.name || outlets.find((o: any) => o.id === confirmItem.outlet_id)?.name}
              </span>{' '}
              periode{' '}
              <span className="font-bold text-gray-900">
                {new Date(confirmItem.bulan).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
              </span>{' '}
              sebesar <span className="font-bold text-green-700">{formatCurrency(confirmItem.nominal)}</span>?
            </p>
            <p className="text-xs text-red-500 bg-red-50 p-2.5 rounded-lg border border-red-100">
              Tindakan ini akan menghapus data transfer dari sistem serta berkas bukti yang tersimpan di storage secara permanen.
            </p>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmItem(null)}
                disabled={deletingId === confirmItem.id}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deletingId === confirmItem.id}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 flex items-center"
              >
                {deletingId === confirmItem.id ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Menghapus...
                  </>
                ) : (
                  'Ya, Hapus'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
