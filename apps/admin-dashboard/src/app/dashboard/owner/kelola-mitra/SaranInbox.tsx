'use client'

import { useState } from 'react'
import { balasSaran, deleteSaran } from './actions'
import { MessageSquare, CheckCircle, Clock, Trash2, AlertTriangle } from 'lucide-react'

export function SaranInbox({ suggestions }: { suggestions: any[] }) {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmItem, setConfirmItem] = useState<any | null>(null)
  const [tanggapanText, setTanggapanText] = useState<Record<string, string>>({})
  
  const handleBalas = async (saran: any) => {
    const text = tanggapanText[saran.id]
    if (!text?.trim()) return
    
    setLoadingId(saran.id)
    try {
      await balasSaran({
        saran_id: saran.id,
        user_id: saran.user_id,
        tanggapan: text.trim()
      })
      alert('Tanggapan berhasil dikirim')
    } catch (e: any) {
      alert(e.message || 'Gagal mengirim tanggapan')
    } finally {
      setLoadingId(null)
    }
  }

  const handleDelete = async () => {
    if (!confirmItem) return
    setDeletingId(confirmItem.id)
    try {
      await deleteSaran(confirmItem.id)
      setConfirmItem(null)
    } catch (e: any) {
      alert(e.message || 'Gagal menghapus saran')
    } finally {
      setDeletingId(null)
    }
  }

  if (suggestions.length === 0) {
    return <div className="text-center p-8 bg-white border rounded-xl text-gray-500">Tidak ada saran masuk.</div>
  }

  return (
    <div className="space-y-4">
      {suggestions.map((s) => (
        <div key={s.id} className="bg-white border rounded-xl p-5 shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <div>
              <div className="flex items-center space-x-2">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                  s.status === 'baru' ? 'bg-yellow-100 text-yellow-800' :
                  s.status === 'ditanggapi' ? 'bg-green-100 text-green-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {s.status}
                </span>
                <span className="text-sm font-semibold text-gray-700">{s.outlets?.name || 'Unknown Outlet'}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1 flex items-center">
                <Clock className="w-3 h-3 mr-1" />
                {new Date(s.created_at).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta',  day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

            <button
              onClick={() => setConfirmItem(s)}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
              title="Hapus Saran"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          
          <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-800 border mb-4">
            {s.isi_saran}
          </div>
          
          {s.status === 'ditanggapi' ? (
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
              <div className="flex items-center text-xs font-bold text-blue-800 mb-1">
                <CheckCircle className="w-3 h-3 mr-1" /> Tanggapan Anda:
              </div>
              <p className="text-sm text-blue-900">{s.tanggapan}</p>
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                value={tanggapanText[s.id] || ''}
                onChange={(e) => setTanggapanText({ ...tanggapanText, [s.id]: e.target.value })}
                placeholder="Tulis tanggapan untuk saran ini..."
                className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 focus:bg-white transition-colors"
                rows={2}
              />
              <div className="flex justify-end">
                <button
                  onClick={() => handleBalas(s)}
                  disabled={loadingId === s.id || !(tanggapanText[s.id]?.trim())}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition-colors"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  {loadingId === s.id ? 'Mengirim...' : 'Kirim Tanggapan'}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Modal Konfirmasi Hapus Saran */}
      {confirmItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmItem(null)} />
          <div className="relative bg-white w-full max-w-md rounded-xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center space-x-3 text-red-600">
              <div className="p-2 bg-red-100 rounded-full">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Konfirmasi Hapus Saran</h3>
            </div>

            <p className="text-sm text-gray-600">
              Apakah Anda yakin ingin menghapus saran dari{' '}
              <span className="font-bold text-gray-900">{confirmItem.outlets?.name || 'Mitra'}</span>?
            </p>
            <div className="bg-gray-50 p-3 rounded-lg border text-xs text-gray-700 italic">
              "{confirmItem.isi_saran}"
            </div>

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

