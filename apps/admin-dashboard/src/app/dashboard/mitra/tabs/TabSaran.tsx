'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { MessageSquare, Send } from 'lucide-react'

export function TabSaran({ outletId, userId }: { outletId: string, userId: string }) {
  const [saranList, setSaranList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isiSaran, setIsiSaran] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const supabase = createClient()

  const fetchSaran = async () => {
    if (!outletId) return
    setLoading(true)
    const { data } = await supabase
      .from('mitra_suggestions')
      .select('*')
      .eq('outlet_id', outletId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      
    setSaranList(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchSaran()
  }, [outletId, userId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isiSaran.trim()) return
    
    setSubmitting(true)
    const { error } = await supabase
      .from('mitra_suggestions')
      .insert({
        user_id: userId,
        outlet_id: outletId,
        isi_saran: isiSaran.trim()
      })
      
    if (!error) {
      setIsiSaran('')
      await fetchSaran()
    } else {
      alert('Gagal mengirim saran.')
    }
    setSubmitting(false)
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg border shadow-sm">
        <label className="block text-sm font-medium text-gray-700 mb-2">Punya Masukan atau Pertanyaan?</label>
        <textarea
          rows={3}
          value={isiSaran}
          onChange={(e) => setIsiSaran(e.target.value)}
          placeholder="Tulis saran, keluhan, atau pertanyaan Anda di sini..."
          className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          required
        />
        <div className="flex justify-end mt-2">
          <button
            type="submit"
            disabled={submitting || !isiSaran.trim()}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition-colors"
          >
            <Send className="w-4 h-4 mr-2" />
            {submitting ? 'Mengirim...' : 'Kirim Saran'}
          </button>
        </div>
      </form>

      <div className="space-y-4">
        <h3 className="font-semibold text-gray-800">Riwayat Saran</h3>
        {loading ? (
          <div className="text-center p-4 text-gray-500">Memuat saran...</div>
        ) : saranList.length === 0 ? (
          <div className="text-center p-4 text-gray-500 border rounded-lg border-dashed">Belum ada riwayat saran.</div>
        ) : (
          saranList.map((s) => (
            <div key={s.id} className="bg-gray-50 rounded-lg p-4 border">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs text-gray-500">
                  {new Date(s.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${
                  s.status === 'baru' ? 'bg-yellow-100 text-yellow-700' :
                  s.status === 'dibaca' ? 'bg-blue-100 text-blue-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {s.status}
                </span>
              </div>
              <p className="text-sm text-gray-800 mb-3">{s.isi_saran}</p>
              
              {s.tanggapan && (
                <div className="bg-blue-50 rounded border border-blue-100 p-3 mt-3">
                  <div className="flex items-center text-xs font-semibold text-blue-800 mb-1">
                    <MessageSquare className="w-3 h-3 mr-1" /> Tanggapan Admin
                  </div>
                  <p className="text-sm text-blue-900">{s.tanggapan}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
