'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useMitraOutlet } from '../MitraOutletContext'
import { PageHeader } from '@/components/ui'
import { UserCircle, Users, Store } from 'lucide-react'

export default function TimOutletPage() {
  const { outlets } = useMitraOutlet()
  const [staff, setStaff] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function fetchStaff() {
      if (!outlets || outlets.length === 0) return
      
      setLoading(true)
      const outletIds = outlets.map((o: any) => o.id)
      
      const supabase = createClient()
      const { data } = await supabase
        .from('outlet_staff')
        .select('id, name, role, status, outlet_id')
        .in('outlet_id', outletIds)
        .in('role', ['crew', 'leader'])
        
      if (data) {
        // Filter out hidden names
        const hiddenNames = ['staff_new', 'Aang', 'Kasir Paledang', 'Test Cicurug']
        const filtered = data.filter(s => !hiddenNames.includes(s.name))
        
        // Sort by outlet name, then by staff name
        filtered.sort((a, b) => {
          const outletA = outlets.find((o: any) => o.id === a.outlet_id)?.name || ''
          const outletB = outlets.find((o: any) => o.id === b.outlet_id)?.name || ''
          
          if (outletA < outletB) return -1
          if (outletA > outletB) return 1
          return (a.name || '').localeCompare(b.name || '')
        })
        
        setStaff(filtered)
      }
      
      setLoading(false)
    }
    fetchStaff()
  }, [outlets])

  if (!outlets || outlets.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500 font-medium">
        Anda belum memiliki outlet yang terdaftar.
      </div>
    )
  }

  const getOutletName = (id: string) => {
    return outlets.find((o: any) => o.id === id)?.name || 'Unknown Outlet'
  }

  return (
    <div className="min-h-screen relative bg-[#fafafa]">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <PageHeader 
          title="Tim Outlet" 
          description="Daftar staf Crew dan Leader untuk semua outlet Anda"
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
            <p className="text-suka-gray-500 font-medium text-sm">Belum ada staf dengan role Crew atau Leader yang terdaftar.</p>
          </div>
        ) : (
          <div className="bg-white/70 backdrop-blur-xl rounded-[32px] border border-white shadow-xl shadow-suka-orange/5 overflow-hidden animate-fade-in">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gradient-to-r from-suka-orange/5 to-transparent border-b border-white/50">
                    <th className="py-4 px-6 text-xs font-black text-suka-brown uppercase tracking-widest whitespace-nowrap">Staf</th>
                    <th className="py-4 px-6 text-xs font-black text-suka-brown uppercase tracking-widest whitespace-nowrap">Outlet</th>
                    <th className="py-4 px-6 text-xs font-black text-suka-brown uppercase tracking-widest whitespace-nowrap">Posisi</th>
                    <th className="py-4 px-6 text-xs font-black text-suka-brown uppercase tracking-widest whitespace-nowrap text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/40">
                  {staff.map((s) => (
                    <tr key={s.id} className="hover:bg-white/40 transition-colors group">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-suka-orange/10 flex items-center justify-center text-suka-orange group-hover:scale-110 transition-transform shadow-sm border border-suka-orange/20">
                            <UserCircle className="w-6 h-6" />
                          </div>
                          <span className="font-extrabold text-suka-brown">{s.name || 'Tanpa Nama'}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2 text-sm font-bold text-suka-gray-500">
                          <Store className="w-4 h-4 text-suka-orange/60" />
                          {getOutletName(s.outlet_id)}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-suka-orange/10 text-suka-orange capitalize">
                          {s.role?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <span className={`inline-flex items-center px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full shadow-sm ${
                          s.status === 'active' 
                            ? 'bg-gradient-to-r from-suka-green/80 to-suka-green text-white shadow-green-500/30' 
                            : 'bg-gradient-to-r from-suka-gray-300 to-suka-gray-400 text-white shadow-gray-400/30'
                        }`}>
                          {s.status === 'active' ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
