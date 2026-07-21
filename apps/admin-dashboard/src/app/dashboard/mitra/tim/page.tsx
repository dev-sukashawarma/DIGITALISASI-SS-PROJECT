'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useMitraOutlet } from '../MitraOutletContext'
import { PageHeader } from '@/components/ui'
import { UserCircle, Users } from 'lucide-react'

export default function TimOutletPage() {
  const { selectedOutletId, selectedOutlet } = useMitraOutlet()
  const [staff, setStaff] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function fetchStaff() {
      if (!selectedOutletId) return
      setLoading(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('outlet_staff')
        .select('id, name, role, status')
        .eq('outlet_id', selectedOutletId)
        
      setStaff(data || [])
      setLoading(false)
    }
    fetchStaff()
  }, [selectedOutletId])

  if (!selectedOutletId) {
    return (
      <div className="p-8 text-center text-gray-500 font-medium">
        Silakan pilih outlet terlebih dahulu dari halaman Dashboard.
      </div>
    )
  }

  return (
    <div className="min-h-screen relative bg-[#fafafa]">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <PageHeader 
          title="Tim Outlet" 
          description={`Daftar staf dan karyawan yang ditugaskan di outlet ${selectedOutlet?.name || 'terpilih'}`}
        />

        {loading ? (
          <div className="bg-white/70 backdrop-blur-md rounded-[32px] p-12 text-center border border-white shadow-xl shadow-suka-orange/5">
            <div className="w-8 h-8 border-4 border-suka-orange border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-suka-gray-500 font-bold uppercase tracking-wider text-sm">Memuat data tim...</p>
          </div>
        ) : staff.length === 0 ? (
          <div className="bg-white/70 backdrop-blur-md rounded-[32px] p-16 text-center border border-white shadow-xl shadow-suka-orange/5 animate-fade-in">
            <div className="bg-gradient-to-br from-suka-orange/20 to-suka-orange/5 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
              <Users className="h-8 w-8 text-suka-orange" />
            </div>
            <h3 className="text-xl font-extrabold text-suka-brown mb-2">Belum Ada Tim</h3>
            <p className="text-suka-gray-500 font-medium text-sm">Belum ada staf yang terdaftar di outlet ini.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
            {staff.map((s) => (
              <div key={s.id} className="group bg-white/70 backdrop-blur-md p-6 rounded-[24px] border border-white shadow-xl shadow-suka-orange/5 flex flex-col justify-between hover:-translate-y-1 transition-all duration-300 hover:shadow-2xl hover:shadow-suka-orange/10 relative overflow-hidden">
                <div className="flex items-center space-x-4 z-10 relative">
                  <div className="p-3 bg-gradient-to-br from-suka-orange/10 to-transparent rounded-2xl group-hover:scale-110 transition-transform duration-300 border border-suka-orange/10 shadow-sm">
                     <UserCircle className="w-10 h-10 text-suka-orange" />
                  </div>
                  <div>
                    <div className="font-extrabold text-lg text-suka-brown tracking-tight">{s.name || 'Tanpa Nama'}</div>
                    <div className="text-xs font-bold text-suka-gray-400 uppercase tracking-widest mt-1">{s.role?.replace('_', ' ')}</div>
                  </div>
                </div>
                
                <div className="mt-6 flex justify-between items-center border-t border-suka-gray-100/50 pt-4 relative z-10">
                  <span className="text-[10px] font-extrabold text-suka-gray-400 uppercase tracking-widest">Status Staf</span>
                  <span className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-full shadow-sm ${
                    s.status === 'active' 
                      ? 'bg-gradient-to-r from-suka-green/80 to-suka-green text-white shadow-green-500/30' 
                      : 'bg-gradient-to-r from-suka-gray-300 to-suka-gray-400 text-white shadow-gray-400/30'
                  }`}>
                    {s.status === 'active' ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
