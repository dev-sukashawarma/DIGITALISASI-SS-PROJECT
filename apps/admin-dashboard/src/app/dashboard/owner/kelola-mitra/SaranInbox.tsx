'use client'

import { useState } from 'react'
import { balasSaran, deleteSaran } from './actions'
import { CheckCircle2, Clock, Trash2, AlertTriangle, Send, Store, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'

interface SaranItem {
  id: string
  user_id: string
  outlet_id?: string
  isi_saran: string
  status: 'baru' | 'ditanggapi' | string
  tanggapan?: string | null
  created_at: string
  outlets?: {
    name?: string
  } | null
}

interface SaranInboxProps {
  suggestions?: SaranItem[]
}

export function SaranInbox({ suggestions = [] }: SaranInboxProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmItem, setConfirmItem] = useState<SaranItem | null>(null)
  const [tanggapanText, setTanggapanText] = useState<Record<string, string>>({})
  
  const handleBalas = async (saran: SaranItem) => {
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
      <div className="bg-white/80 backdrop-blur-md border border-dashed border-suka-brown/20 rounded-2xl p-10 sm:p-12 text-center text-suka-gray-500 shadow-sm space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-suka-orange/10 text-suka-orange flex items-center justify-center mx-auto">
          <MessageCircle className="w-6 h-6" />
        </div>
        <h3 className="text-sm sm:text-base font-extrabold text-suka-brown">Tidak Ada Saran Masuk</h3>
        <p className="text-xs text-suka-gray-500 max-w-sm mx-auto leading-relaxed">
          Belum ada saran atau masukan dari mitra outlet yang tercatat dalam sistem.
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
            className="bg-white/90 backdrop-blur-md border border-suka-brown/10 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-all space-y-3.5"
          >
            {/* Header: Outlet & Status */}
            <div className="flex justify-between items-start gap-2">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    s.status === 'baru' 
                      ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}>
                    {s.status === 'baru' ? 'Saran Baru' : 'Sudah Ditanggapi'}
                  </span>
                  
                  <div className="flex items-center gap-1.5 text-xs sm:text-sm font-extrabold text-suka-brown">
                    <Store className="w-3.5 h-3.5 text-suka-orange shrink-0" />
                    <span>{s.outlets?.name || 'Mitra Outlet'}</span>
                  </div>
                </div>

                <div className="text-[11px] text-suka-gray-400 flex items-center gap-1 font-medium pl-0.5">
                  <Clock className="w-3 h-3 text-suka-gray-400" />
                  <span>{dateFormatted}</span>
                </div>
              </div>

              <button
                onClick={() => setConfirmItem(s)}
                className="p-1.5 text-suka-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-200 transition-colors shrink-0"
                title="Hapus Saran"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            
            {/* Isi Saran */}
            <div className="bg-suka-brown/[0.03] p-3.5 sm:p-4 rounded-xl text-xs sm:text-sm text-suka-brown border border-suka-brown/10 leading-relaxed font-medium">
              "{s.isi_saran}"
            </div>
            
            {/* Bagian Tanggapan */}
            {isReplied ? (
              <div className="bg-emerald-50/70 p-3.5 sm:p-4 rounded-xl border border-emerald-100/80 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-black text-emerald-800 uppercase tracking-wider">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> 
                  <span>Tanggapan Manajemen:</span>
                </div>
                <p className="text-xs sm:text-sm text-emerald-950 font-medium pl-5 leading-relaxed">{s.tanggapan}</p>
              </div>
            ) : (
              <div className="space-y-2.5 pt-0.5">
                <textarea
                  value={tanggapanText[s.id] || ''}
                  onChange={(e) => setTanggapanText({ ...tanggapanText, [s.id]: e.target.value })}
                  placeholder="Tulis tanggapan atau solusi untuk mitra ini..."
                  className="w-full border border-suka-brown/15 rounded-xl p-3 text-xs sm:text-sm text-suka-brown focus:ring-2 focus:ring-suka-orange/20 focus:border-suka-orange outline-none bg-white placeholder:text-suka-gray-400 transition-all font-medium resize-y"
                  rows={2}
                />
                <div className="flex justify-end">
                  <button
                    onClick={() => handleBalas(s)}
                    disabled={loadingId === s.id || !(tanggapanText[s.id]?.trim())}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-suka-orange hover:bg-suka-orange/90 text-white rounded-xl text-xs sm:text-sm font-extrabold shadow-sm shadow-suka-orange/20 disabled:opacity-40 transition-all active:scale-95"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{loadingId === s.id ? 'Mengirim...' : 'Kirim Tanggapan'}</span>
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
          <div className="absolute inset-0 bg-suka-brown/60 backdrop-blur-sm" onClick={() => setConfirmItem(null)} />
          <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4 border border-suka-brown/10">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-100">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-suka-brown leading-tight">Hapus Saran Mitra</h3>
                <p className="text-xs text-suka-gray-500">Konfirmasi penghapusan pesan saran</p>
              </div>
            </div>

            <p className="text-sm text-suka-gray-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus saran dari outlet{' '}
              <span className="font-extrabold text-suka-brown">{confirmItem.outlets?.name || 'Mitra'}</span>?
            </p>
            <div className="bg-suka-brown/[0.03] p-3 rounded-xl border border-suka-brown/10 text-xs text-suka-brown italic font-medium">
              "{confirmItem.isi_saran}"
            </div>

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


