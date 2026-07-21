'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Spinner } from '@suka/design-system'
import { Select } from '@/components/ui/Select'
import { Activity, User, Store, Lock, Unlock, Users, UserCheck, UserX, MapPin, Monitor } from 'lucide-react'

type Outlet = { id: string; name: string; is_active: boolean }
type Staff = { id: string; name: string; outlet_id: string; role: string; is_active: boolean }
type Attendance = { outlet_id: string; outlet_staff_id: string; type: 'in' | 'out'; ts_server: string }



export default function MonitoringPage() {
  const [selectedOutletId, setSelectedOutletId] = useState<string>('ALL')
  const [posStatusFilter, setPosStatusFilter] = useState<string>('ALL')
  const [crewStatusFilter, setCrewStatusFilter] = useState<string>('ALL')
  
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [attendances, setAttendances] = useState<Attendance[]>([])
  
  const [checklistReq, setChecklistReq] = useState<Record<string, string[]>>({})
  const [checklistTicks, setChecklistTicks] = useState<Record<string, string[]>>({})
  
  const [isLoading, setIsLoading] = useState(true)

  const supabase = createClient()

  // helper to get today in YYYY-MM-DD
  const getTodayStr = () => {
    const formatter = new Intl.DateTimeFormat('en-CA', { 
      timeZone: 'Asia/Jakarta', 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    })
    const parts = formatter.formatToParts(new Date())
    const y = parts.find(p => p.type === 'year')?.value
    const m = parts.find(p => p.type === 'month')?.value
    const d = parts.find(p => p.type === 'day')?.value
    return `${y}-${m}-${d}`
  }

  const fetchData = async () => {
    try {
      const todayStr = getTodayStr()
      const start = new Date(`${todayStr}T00:00:00+07:00`).toISOString()
      const end = new Date(`${todayStr}T23:59:59+07:00`).toISOString()

      // Fetch independent queries in parallel for instant updates
      const [outRes, stfRes, attRes, catRes, recRes] = await Promise.all([
        supabase.from('outlets').select('id, name, is_active').eq('is_active', true),
        supabase.from('outlet_staff').select('id, name, outlet_id, role, is_active').eq('is_active', true).in('role', ['crew', 'leader']),
        supabase.from('attendance')
          .select('outlet_id, outlet_staff_id, type, ts_server')
          .gte('ts_server', start)
          .lte('ts_server', end)
          .order('ts_server', { ascending: true }),
        supabase.from('checklist_categories')
          .select('id, outlet_id, checklist_items(id, is_required)')
          .eq('phase', 'buka'),
        supabase.from('daily_checklist_records')
          .select('id, outlet_id')
          .eq('date', todayStr)
      ])

      const validOutlets = (outRes.data || []) as Outlet[]
      
      const reqMap: Record<string, string[]> = {}
      if (catRes.data) {
        catRes.data.forEach(cat => {
          const outId = cat.outlet_id
          if (!reqMap[outId]) reqMap[outId] = []
          const reqItems = (cat.checklist_items || []).filter((i: any) => i.is_required).map((i: any) => i.id)
          reqMap[outId].push(...reqItems)
        })
      }

      const ticksMap: Record<string, string[]> = {}
      if (recRes.data && recRes.data.length > 0) {
        const recIds = recRes.data.map(r => r.id)
        const { data: tickRes } = await supabase.from('daily_checklist_ticks').select('item_id, record_id').in('record_id', recIds)
        
        if (tickRes) {
          recRes.data.forEach(rec => {
            if (!ticksMap[rec.outlet_id]) ticksMap[rec.outlet_id] = []
            const ticksForRec = tickRes.filter(t => t.record_id === rec.id).map(t => t.item_id)
            ticksMap[rec.outlet_id].push(...ticksForRec)
          })
        }
      }

      setOutlets(validOutlets)
      setStaffList((stfRes.data || []) as Staff[])
      setAttendances((attRes.data || []) as Attendance[])
      setChecklistReq(reqMap)
      setChecklistTicks(ticksMap)
      
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()

    // Setup Subscriptions for Realtime dengan unique channel id agar aman dari React Strict Mode
    const channelId = `monitoring_${Math.random().toString(36).substring(7)}`
    const sub = supabase.channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, (payload) => {
        console.log('[Realtime] Attendance changed', payload)
        fetchData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_checklist_ticks' }, (payload) => {
        console.log('[Realtime] Checklist tick changed', payload)
        fetchData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_checklist_records' }, (payload) => {
        console.log('[Realtime] Checklist record changed', payload)
        fetchData()
      })
      .subscribe((status) => {
        console.log(`[Realtime] Monitoring channel status: ${status}`)
      })

    return () => {
      supabase.removeChannel(sub)
    }
  }, [])

  if (isLoading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-7xl pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 rounded-lg border border-indigo-100 shadow-sm">
            <Activity className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Monitoring Aktivitas Sistem</h2>
            <p className="text-sm text-gray-500 mt-0.5 font-medium">Pantau absensi crew dan status lock POS per cabang secara realtime</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto p-1.5 bg-gray-50/80 rounded-xl border border-gray-100/80 backdrop-blur-sm">
          <Select 
            value={posStatusFilter} 
            onChange={setPosStatusFilter}
            placeholder="Status POS..."
            className="w-full sm:w-48"
            options={[
              { label: 'Semua Status POS', value: 'ALL', icon: <Monitor className="w-4 h-4 text-gray-500" /> },
              { label: 'POS Terbuka', value: 'OPEN', icon: <Unlock className="w-4 h-4 text-emerald-500" /> },
              { label: 'POS Terkunci', value: 'LOCKED', icon: <Lock className="w-4 h-4 text-red-500" /> }
            ]}
          />
          <Select 
            value={crewStatusFilter} 
            onChange={setCrewStatusFilter}
            placeholder="Status Crew..."
            className="w-full sm:w-48"
            options={[
              { label: 'Semua Status Crew', value: 'ALL', icon: <Users className="w-4 h-4 text-gray-500" /> },
              { label: 'Hadir', value: 'PRESENT', icon: <UserCheck className="w-4 h-4 text-emerald-500" /> },
              { label: 'Belum / Pulang', value: 'NOT_PRESENT', icon: <UserX className="w-4 h-4 text-red-500" /> }
            ]}
          />
          <Select 
            value={selectedOutletId} 
            onChange={setSelectedOutletId}
            searchable
            placeholder="Pilih Outlet..."
            searchPlaceholder="Cari outlet..."
            className="w-full sm:w-64"
            options={[
              { label: 'Semua Cabang', value: 'ALL', icon: <MapPin className="w-4 h-4 text-gray-500" /> },
              ...outlets.map(o => ({ label: o.name, value: o.id, icon: <Store className="w-4 h-4 text-indigo-500" /> }))
            ]}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {outlets
          .filter(outlet => selectedOutletId === 'ALL' || outlet.id === selectedOutletId)
          .map(outlet => {
          // Find staff for this outlet
          const outletStaff = staffList.filter(s => s.outlet_id === outlet.id)
          
          // Get today's attendance for this outlet
          const outletAtt = attendances.filter(a => a.outlet_id === outlet.id)

          // Determine POS Status
          let posStatus = 'Terkunci - Menunggu Absen'
          let posColor = 'bg-red-50 text-red-700 border-red-200'
          let PosIcon = Lock
          
          // Staff attendance state (last record)
          const staffState = new Map<string, string>()
          outletAtt.forEach(a => {
             staffState.set(a.outlet_staff_id, a.type)
          })

          const hasAnyoneIn = Array.from(staffState.values()).some(t => t === 'in')
          const isEveryoneOut = staffState.size > 0 && Array.from(staffState.values()).every(t => t === 'out')

          if (isEveryoneOut) {
            posStatus = 'Terkunci - Tutup'
            posColor = 'bg-gray-100 text-gray-600 border-gray-200'
          } else if (hasAnyoneIn) {
            // Check checklist progress
            const reqIds = checklistReq[outlet.id] || []
            const tickIds = new Set(checklistTicks[outlet.id] || [])
            const total = reqIds.length
            const done = reqIds.filter(id => tickIds.has(id)).length

            if (total > 0 && done < total) {
              posStatus = `Terkunci - Checklist Belum Selesai (${done}/${total})`
              posColor = 'bg-orange-50 text-orange-700 border-orange-200'
            } else {
              posStatus = 'Terbuka - Siap Transaksi'
              posColor = 'bg-emerald-50 text-emerald-700 border-emerald-200'
              PosIcon = Unlock
            }
          }

          const isOpen = posStatus === 'Terbuka - Siap Transaksi'
          if (posStatusFilter === 'OPEN' && !isOpen) return null
          if (posStatusFilter === 'LOCKED' && isOpen) return null

          const visibleStaff = outletStaff.filter(staff => {
            const lastAttType = staffState.get(staff.id)
            const isPresent = lastAttType === 'in'
            if (crewStatusFilter === 'PRESENT' && !isPresent) return false
            if (crewStatusFilter === 'NOT_PRESENT' && isPresent) return false
            return true
          })

          if (crewStatusFilter !== 'ALL' && visibleStaff.length === 0) {
            return null
          }

          return (
            <div key={outlet.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              {/* Card Header */}
              <div className="p-4 border-b border-gray-50 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Store className="w-5 h-5 text-gray-400" />
                  <h3 className="font-bold text-gray-900 truncate">{outlet.name}</h3>
                </div>
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold ${posColor}`}>
                  <PosIcon className="w-3.5 h-3.5" />
                  {posStatus}
                </div>
              </div>

              {/* Card Body - Crew List */}
              <div className="p-2">
                {visibleStaff.length === 0 ? (
                  <div className="py-4 text-center text-xs text-gray-400 font-medium">Tidak ada crew aktif / sesuai filter</div>
                ) : (
                  <ul className="space-y-1">
                    {visibleStaff.map(staff => {
                      const lastAttType = staffState.get(staff.id)
                      let attLabel = 'Belum Absen'
                      let attColor = 'bg-red-100 text-red-700'
                      let attDot = 'bg-red-500'

                      if (lastAttType === 'in') {
                        attLabel = 'Hadir'
                        attColor = 'bg-emerald-100 text-emerald-700'
                        attDot = 'bg-emerald-500'
                      } else if (lastAttType === 'out') {
                        attLabel = 'Pulang'
                        attColor = 'bg-gray-100 text-gray-600'
                        attDot = 'bg-gray-400'
                      }

                      return (
                        <li key={staff.id} className="flex items-center justify-between p-2 rounded-xl hover:bg-gray-50 transition-colors">
                          <div className="flex items-center gap-2 truncate pr-2">
                            <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                              <User className="w-4 h-4 text-gray-500" />
                            </div>
                            <span className="text-sm font-semibold text-gray-700 truncate">{staff.name}</span>
                          </div>
                          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${attColor}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${attDot}`} />
                            {attLabel}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
