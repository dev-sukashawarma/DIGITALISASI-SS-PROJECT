'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { UserCircle } from 'lucide-react'

export function TabTim({ outletId }: { outletId: string }) {
  const [staff, setStaff] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStaff() {
      if (!outletId) return
      setLoading(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('outlet_staff')
        .select('id, name, role, status')
        .eq('outlet_id', outletId)
        
      setStaff(data || [])
      setLoading(false)
    }
    fetchStaff()
  }, [outletId])

  if (loading) return <div className="text-center p-4 text-gray-500">Memuat tim...</div>
  if (staff.length === 0) return <div className="text-center p-4 text-gray-500">Belum ada staf di outlet ini.</div>

  return (
    <div className="space-y-3">
      {staff.map((s) => (
        <div key={s.id} className="flex justify-between items-center p-3 border rounded-lg bg-gray-50">
          <div className="flex items-center space-x-3">
            <UserCircle className="w-8 h-8 text-gray-400" />
            <div>
              <div className="font-medium text-sm">{s.name || 'Tanpa Nama'}</div>
              <div className="text-xs text-gray-500 capitalize">{s.role?.replace('_', ' ')}</div>
            </div>
          </div>
          <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
            s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'
          }`}>
            {s.status === 'active' ? 'Aktif' : 'Nonaktif'}
          </span>
        </div>
      ))}
    </div>
  )
}
