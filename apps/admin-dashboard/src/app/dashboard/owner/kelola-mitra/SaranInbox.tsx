'use client'

import { useState } from 'react'
import { balasSaran } from './actions'
import { MessageSquare, CheckCircle, Clock } from 'lucide-react'

export function SaranInbox({ suggestions }: { suggestions: any[] }) {
  const [loadingId, setLoadingId] = useState<string | null>(null)
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
                {new Date(s.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
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
    </div>
  )
}
