'use client'

import { useState } from 'react'
import { balasSaran, deleteSaran } from './actions'
import { MessageSquare, CheckCircle2, Clock, Trash2, AlertTriangle, Send, Store, UserCheck, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'

export function SaranInbox({ suggestions = [] }: { suggestions: any[] }) {
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
      toast.success('Tanggapan berhasil dikirim ke mitra')
    } catch (e: any) {
      toast.error(e.message || 'Gagal mengirim tanggapan')
    } finally {
      setLoadingId(null)
    }
  }

  const handleDelete = async () => {
    if (!confirmItem) return
    setDeletingId(confirmItem.id)
    try {
      await deleteSaran(confirmItem.id)
      toast.success('Saran berhasil dihapus')
      setConfirmItem(null)
    } catch (e: any) {
      toast.error(e.message || 'Gagal menghapus saran')
    } finally {
      setDeletingId(null)
    }
  }

  if (suggestions.length === 0) {
    return (
      <div className="bg-white/80 backdrop-blur-xl border border-dashed border-gray-300 rounded-3xl p-12 text-center text-gray-500 shadow-sm space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
          <MessageCircle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-extrabold text-gray-800">Tidak Ada Saran Masuk</h3>
        <p className="text-xs text-gray-500 max-w-sm mx-auto">
          Belum ada saran atau kritik dari mitra outlet yang tercatat dalam sistem.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {suggestions.map((s) => {
        const isReplied = s.status === 'ditanggapi'
        const dateFormatted = new Date(s.created_at).toLocaleDateString('id-ID', { 
          day: 'numeric', 
          month: 'long', 
          year: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit' 
        })

        return (
          <div 
            key={s.id} 
            className="bg-white/90 backdrop-blur-xl border border-amber-100/80 rounded-3xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.03)] hover:shadow-md transition-all space-y-4"
          >
            {/* Header: Outlet & Status */}
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    s.status === 'baru' 
                      ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}>
                    {s.status === 'baru' ? 'Saran Baru' : 'Sudah Ditanggapi'}
                  </span>
                  
                  <div className="flex items-center gap-1 text-sm font-extrabold text-gray-900">
                    <Store className="w-3.5 h-3.5 text-amber-600" />
                    <span>{s.outlets?.name || 'Mitra Outlet'}</span>
                  </div>
                </div>

                <div className="text-xs text-gray-400 flex items-center gap-1 font-medium pl-0.5">
                  <Clock className="w-3 h-3 text-gray-400" />
                  <span>{dateFormatted}</span>
                </div>
              </div>

              <button
                onClick={() => setConfirmItem(s)}
                className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                title="Hapus Saran"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            
            {/* Isi Saran */}
            <div className="bg-amber-50/40 p-4 rounded-2xl text-sm text-gray-800 border border-amber-100/60 leading-relaxed font-medium">
              "{s.isi_saran}"
            </div>
            
            {/* Bagian Tanggapan */}
            {isReplied ? (
              <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-100/80 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-black text-emerald-800 uppercase tracking-wider">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Tanggapan Manajemen:
                </div>
                <p className="text-sm text-emerald-950 font-medium pl-5">{s.tanggapan}</p>
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                <textarea
                  value={tanggapanText[s.id] || ''}
                  onChange={(e) => setTanggapanText({ ...tanggapanText, [s.id]: e.target.value })}
                  placeholder="Tulis tanggapan / solusi untuk mitra ini..."
                  className="w-full border border-gray-200 rounded-2xl p-3.5 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none bg-white placeholder-gray-400 transition-all font-medium"
                  rows={2}
                />
                <div className="flex justify-end">
                  <button
                    onClick={() => handleBalas(s)}
                    disabled={loadingId === s.id || !(tanggapanText[s.id]?.trim())}
                    className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs sm:text-sm font-extrabold shadow-md shadow-amber-500/20 disabled:opacity-40 transition-all hover:scale-[1.02] active:scale-95"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {loadingId === s.id ? 'Mengirim Tanggapan...' : 'Kirim Tanggapan'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Modal Konfirmasi Hapus Saran */}
      {confirmItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={() => setConfirmItem(null)} />
          <div className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-4 border border-amber-100">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 bg-rose-50 rounded-2xl border border-rose-100">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900 leading-tight">Hapus Saran Mitra</h3>
                <p className="text-xs text-gray-500">Konfirmasi penghapusan pesan saran</p>
              </div>
            </div>

            <p className="text-sm text-gray-600">
              Apakah Anda yakin ingin menghapus saran dari outlet{' '}
              <span className="font-extrabold text-gray-900">{confirmItem.outlets?.name || 'Mitra'}</span>?
            </p>
            <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100 text-xs text-gray-700 italic">
              "{confirmItem.isi_saran}"
            </div>

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
                  'Ya, Hapus Saran'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


