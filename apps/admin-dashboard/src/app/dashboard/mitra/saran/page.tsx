'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useMitraOutlet } from '../MitraOutletContext'
import { PageHeader } from '@/components/ui'
import { MessageSquare, Send, HelpCircle } from 'lucide-react'

export default function SaranPage() {
  const { selectedOutletId, selectedOutlet, profile } = useMitraOutlet()
  const [saranList, setSaranList] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [isiSaran, setIsiSaran] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const supabase = createClient()

  const fetchSaran = async () => {
    if (!selectedOutletId || !profile?.user_id) return
    setLoading(true)
    const { data } = await supabase
      .from('mitra_suggestions')
      .select('*')
      .eq('outlet_id', selectedOutletId)
      .eq('user_id', profile.user_id)
      .order('created_at', { ascending: false })
      
    setSaranList(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchSaran()
  }, [selectedOutletId, profile?.user_id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isiSaran.trim() || !profile?.user_id) return
    
    setSubmitting(true)
    const { error } = await supabase
      .from('mitra_suggestions')
      .insert({
        user_id: profile.user_id,
        outlet_id: selectedOutletId,
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

  if (!selectedOutletId) {
    return (
      <div className="p-8 text-center text-gray-500 font-medium">
        Silakan pilih outlet terlebih dahulu dari halaman Dashboard.
      </div>
    )
  }

  return (
    <div className="min-h-screen relative bg-[#fafafa]">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        <PageHeader 
          title="Saran & Kritik" 
          description={`Berikan masukan atau pertanyaan untuk outlet ${selectedOutlet?.name || 'terpilih'}`}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Form Section */}
          <div className="lg:col-span-1">
            <form onSubmit={handleSubmit} className="bg-white/70 backdrop-blur-md p-6 sm:p-8 rounded-[32px] border border-white shadow-xl shadow-suka-orange/5 hover:bg-white/90 transition-colors duration-500 sticky top-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-suka-orange/10 rounded-2xl">
                  <HelpCircle className="w-6 h-6 text-suka-orange" />
                </div>
                <div>
                  <h3 className="font-black text-suka-brown tracking-tight text-lg">Kirim Masukan</h3>
                  <p className="text-[10px] font-bold text-suka-gray-400 uppercase tracking-widest mt-1">Saran / Pertanyaan</p>
                </div>
              </div>
              
              <textarea
                rows={5}
                value={isiSaran}
                onChange={(e) => setIsiSaran(e.target.value)}
                placeholder="Tulis keluhan, saran perbaikan, atau pertanyaan Anda di sini..."
                className="w-full bg-white/80 border border-suka-gray-200 rounded-2xl p-4 text-sm font-medium text-suka-brown focus:ring-2 focus:ring-suka-orange focus:border-suka-orange outline-none resize-none shadow-inner mb-6 transition-all placeholder:text-suka-gray-400"
                required
              />
              <button
                type="submit"
                disabled={submitting || !isiSaran.trim()}
                className="w-full flex items-center justify-center py-3.5 px-6 bg-gradient-to-r from-suka-orange to-suka-brown text-white rounded-xl hover:shadow-lg hover:shadow-suka-orange/30 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none text-sm font-black uppercase tracking-widest transition-all"
              >
                {submitting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Kirim Saran
                  </>
                )}
              </button>
            </form>
          </div>

          {/* History Section */}
          <div className="lg:col-span-2 space-y-6">
            <h3 className="text-sm font-black text-suka-gray-400 uppercase tracking-widest pl-2">Riwayat Saran & Tanggapan</h3>
            
            {loading ? (
              <div className="bg-white/70 backdrop-blur-md rounded-[32px] p-12 text-center border border-white shadow-xl shadow-suka-orange/5">
                <div className="w-8 h-8 border-4 border-suka-orange border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-suka-gray-500 font-bold uppercase tracking-wider text-sm">Memuat saran...</p>
              </div>
            ) : saranList.length === 0 ? (
              <div className="bg-white/70 backdrop-blur-md rounded-[32px] p-16 text-center border border-white shadow-xl shadow-suka-orange/5 animate-fade-in">
                <div className="bg-gradient-to-br from-suka-orange/20 to-suka-orange/5 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                  <MessageSquare className="h-8 w-8 text-suka-orange" />
                </div>
                <h3 className="text-xl font-extrabold text-suka-brown mb-2">Belum Ada Riwayat</h3>
                <p className="text-suka-gray-500 font-medium text-sm">Anda belum mengirimkan saran atau pertanyaan apapun.</p>
              </div>
            ) : (
              <div className="space-y-4 animate-fade-in">
                {saranList.map((s) => (
                  <div key={s.id} className="bg-white/70 backdrop-blur-md rounded-[24px] p-6 border border-white shadow-lg shadow-suka-orange/5 hover:bg-white/90 transition-all duration-300">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-[10px] font-extrabold text-suka-gray-400 uppercase tracking-widest">
                        {new Date(s.created_at).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta',  day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-full shadow-sm ${
                        s.status === 'baru' ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-white shadow-yellow-500/30' :
                        s.status === 'dibaca' ? 'bg-gradient-to-r from-blue-400 to-blue-500 text-white shadow-blue-500/30' :
                        'bg-gradient-to-r from-suka-green/80 to-suka-green text-white shadow-green-500/30'
                      }`}>
                        {s.status}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-suka-brown leading-relaxed mb-4">{s.isi_saran}</p>
                    
                    {s.tanggapan && (
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100/30 p-5 rounded-2xl border border-blue-100 shadow-sm relative overflow-hidden mt-4">
                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                        <div className="flex items-center text-[10px] font-black text-blue-800 uppercase tracking-widest mb-2">
                          <MessageSquare className="w-3 h-3 mr-1.5" /> 
                          Tanggapan Admin
                        </div>
                        <p className="text-sm font-medium text-blue-900 leading-relaxed">{s.tanggapan}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          
        </div>
      </div>
    </div>
  )
}
