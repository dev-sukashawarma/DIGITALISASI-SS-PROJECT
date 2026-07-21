'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Spinner } from '@suka/design-system'
import { Select } from '@/components/ui/Select'
import { User, Store, Lock, Unlock, Users, UserCheck, UserX, MapPin, Monitor, ClipboardCheck, Bluetooth, BluetoothConnected, Navigation } from 'lucide-react'
import dynamic from 'next/dynamic'

const LiveLocationMap = dynamic(() => import('./LiveLocationMap'), { 
  ssr: false, 
  loading: () => <div className="w-full h-[600px] bg-gray-100 animate-pulse rounded-2xl border border-gray-200"></div> 
})

type Outlet = { id: string; name: string; is_active: boolean; region?: string | null; lat?: number | null; lng?: number | null; address?: string | null }
type Staff = { id: string; name: string; outlet_id: string; role: string; is_active: boolean }
type Attendance = { outlet_id: string; outlet_staff_id: string; type: 'in' | 'out'; ts_server: string }
type Opname = { id: string; outlet_id: string; created_at: string }

export default function MonitoringPage() {
  const [activeTab, setActiveTab] = useState<'POS' | 'LOCATION'>('POS')
  const [selectedOutletId, setSelectedOutletId] = useState<string>('ALL')
  const [posStatusFilter, setPosStatusFilter] = useState<string>('ALL')
  const [crewStatusFilter, setCrewStatusFilter] = useState<string>('ALL')
  
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [attendances, setAttendances] = useState<Attendance[]>([])
  const [opnamesToday, setOpnamesToday] = useState<Opname[]>([])
  const [connectedPrinters, setConnectedPrinters] = useState<Set<string>>(new Set())
  const [crewLocations, setCrewLocations] = useState<any[]>([])
  
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
      const [outRes, stfRes, attRes, catRes, recRes, opnRes] = await Promise.all([
        supabase.from('outlets').select('id, name, is_active, region, lat, lng, address').eq('is_active', true),
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
          .eq('date', todayStr),
        supabase.from('opname')
          .select('id, outlet_id, created_at')
          .gte('created_at', start)
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
      setOpnamesToday((opnRes.data || []) as Opname[])
      
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'opname' }, (payload) => {
        console.log('[Realtime] Opname changed', payload)
        fetchData()
      })
      .subscribe((status) => {
        console.log(`[Realtime] Monitoring channel status: ${status}`)
      })

    // Setup Realtime Presence for Printer status
    const presenceRoom = supabase.channel('room:printer_status')
    presenceRoom
      .on('presence', { event: 'sync' }, () => {
        const state = presenceRoom.presenceState()
        const activeOutlets = new Set<string>()
        
        for (const id in state) {
          const presences = state[id] as any[]
          for (const presence of presences) {
            if (presence.outlet_id && presence.is_connected) {
              activeOutlets.add(presence.outlet_id)
            }
          }
        }
        setConnectedPrinters(activeOutlets)
      })
      .subscribe()

    // Setup Realtime Presence for Crew Location
    const locationRoom = supabase.channel('room:crew_location')
    locationRoom
      .on('presence', { event: 'sync' }, () => {
        const state = locationRoom.presenceState()
        const crews = []
        for (const id in state) {
          const presences = state[id] as any[]
          for (const presence of presences) {
            if (presence.staff_id && presence.lat && presence.lng) {
              crews.push(presence)
            }
          }
        }
        setCrewLocations(crews)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(sub)
      supabase.removeChannel(presenceRoom)
      supabase.removeChannel(locationRoom)
    }
  }, [])

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Spinner className="w-8 h-8 text-suka-orange" />
      </div>
    )
  }

  // Group outlets by region
  const groupedOutlets = outlets.reduce((acc, outlet) => {
    const region = outlet.region || 'Lain-lain / Unassigned'
    if (!acc[region]) acc[region] = []
    acc[region].push(outlet)
    return acc
  }, {} as Record<string, Outlet[]>)

  // Combine live crews with offline crews (who are present today)
  const allCrewsForMap = [...crewLocations]
  
  // Find staffs who have attendance today but are not currently live
  const presentStaffIds = new Set(attendances.map(a => a.outlet_staff_id))
  
  staffList.forEach(staff => {
    // Only show offline staff if they have clocked in today
    if (presentStaffIds.has(staff.id)) {
      const isLive = crewLocations.some(c => c.staff_id === staff.id)
      if (!isLive) {
        // Get outlet coordinates as fallback
        const outlet = outlets.find(o => o.id === staff.outlet_id)
        if (outlet && outlet.lat && outlet.lng) {
          allCrewsForMap.push({
            staff_id: staff.id,
            staff_name: staff.name,
            role: staff.role,
            outlet_id: staff.outlet_id,
            lat: outlet.lat,
            lng: outlet.lng,
            accuracy: 0,
            speed: 0,
            heading: 0,
            device_type: 'OFFLINE',
            isOffline: true,
            updated_at: new Date().toISOString()
          })
        }
      }
    }
  })

  const opnameOutletIds = new Set(opnamesToday.map(o => o.outlet_id))

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto">
      
      {/* Header & Tabs */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Monitoring Aktivitas</h1>
            <p className="text-sm text-gray-500 mt-1">Pantau status POS, absensi kru, dan lokasi secara real-time</p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
          <button
            onClick={() => setActiveTab('POS')}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors flex items-center gap-2
              ${activeTab === 'POS' ? 'bg-[#1e1b15] text-[#fff8f1]' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}
          >
            <Monitor className="w-4 h-4" />
            POS & Crew
          </button>
          <button
            onClick={() => setActiveTab('LOCATION')}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors flex items-center gap-2
              ${activeTab === 'LOCATION' ? 'bg-[#1e1b15] text-[#fff8f1]' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}
          >
            <Navigation className="w-4 h-4" />
            Live Location
          </button>
        </div>
      </div>

      {activeTab === 'LOCATION' ? (
        <div className="animate-fade-in">
          <LiveLocationMap outlets={outlets as any[]} crews={allCrewsForMap as any[]} />
        </div>
      ) : (
        <div className="flex flex-col gap-6 animate-fade-in">
          {/* Filter Bar */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 relative z-20">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full xl:w-auto p-1.5 bg-gray-50/80 rounded-xl border border-gray-100/80 backdrop-blur-sm shadow-sm">
              <Select 
                value={posStatusFilter}  
                onChange={setPosStatusFilter}
                placeholder="Status POS..."
                className="w-full sm:min-w-[170px]"
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
                className="w-full sm:min-w-[170px]"
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
                className="w-full sm:min-w-[220px]"
                options={[
                  { label: 'Semua Cabang', value: 'ALL', icon: <MapPin className="w-4 h-4 text-gray-500" /> },
                  ...outlets.map(o => ({ label: o.name, value: o.id, icon: <Store className="w-4 h-4 text-indigo-500" /> }))
                ]}
              />
            </div>
          </div>

          <div className="space-y-10">
            {Object.keys(groupedOutlets).sort().map(regionName => {
              const regionOutlets = groupedOutlets[regionName].filter(outlet => selectedOutletId === 'ALL' || outlet.id === selectedOutletId)
              
              if (regionOutlets.length === 0) return null

              // Pre-filter region outlets based on pos/crew status to see if we should render the region at all
              const visibleRegionOutlets = regionOutlets.filter(outlet => {
                const outletStaff = staffList.filter(s => s.outlet_id === outlet.id)
                const outletAtt = attendances.filter(a => a.outlet_id === outlet.id)
                
                let posStatus = 'Terkunci - Menunggu Absen'
                const staffState = new Map<string, string>()
                outletAtt.forEach(a => staffState.set(a.outlet_staff_id, a.type))

                const hasAnyoneIn = Array.from(staffState.values()).some(t => t === 'in')
                const isEveryoneOut = staffState.size > 0 && Array.from(staffState.values()).every(t => t === 'out')

                if (isEveryoneOut) {
                  posStatus = 'Terkunci - Tutup'
                } else if (hasAnyoneIn) {
                  const reqIds = checklistReq[outlet.id] || []
                  const tickIds = new Set(checklistTicks[outlet.id] || [])
                  const total = reqIds.length
                  const done = reqIds.filter(id => tickIds.has(id)).length

                  if (total > 0 && done < total) {
                    posStatus = `Terkunci - Checklist Belum Selesai (${done}/${total})`
                  } else {
                    posStatus = 'Terbuka - Siap Transaksi'
                  }
                }

                const isOpen = posStatus === 'Terbuka - Siap Transaksi'
                if (posStatusFilter === 'OPEN' && !isOpen) return false
                if (posStatusFilter === 'LOCKED' && isOpen) return false

                const visibleStaff = outletStaff.filter(staff => {
                  const lastAttType = staffState.get(staff.id)
                  const isPresent = lastAttType === 'in'
                  if (crewStatusFilter === 'PRESENT' && !isPresent) return false
                  if (crewStatusFilter === 'NOT_PRESENT' && isPresent) return false
                  return true
                })

                if (crewStatusFilter !== 'ALL' && visibleStaff.length === 0) return false

                return true
              })

              if (visibleRegionOutlets.length === 0) return null

              return (
                <div key={regionName} className="space-y-4">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-suka-orange" />
                      {regionName}
                    </h2>
                    <div className="h-px bg-gray-200 flex-1"></div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {visibleRegionOutlets.map(outlet => {
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

                      const visibleStaff = outletStaff.filter(staff => {
                        const lastAttType = staffState.get(staff.id)
                        const isPresent = lastAttType === 'in'
                        if (crewStatusFilter === 'PRESENT' && !isPresent) return false
                        if (crewStatusFilter === 'NOT_PRESENT' && isPresent) return false
                        return true
                      })
                      
                      const hasOpnameToday = opnameOutletIds.has(outlet.id)

                      return (
                        <div key={outlet.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-all duration-200 flex flex-col h-full group">
                          {/* Card Header */}
                          <div className={`p-4 border-b flex flex-col gap-3 flex-shrink-0 relative ${hasOpnameToday ? 'border-blue-50 bg-blue-50/20' : 'border-gray-50'}`}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2">
                                <Store className={`w-5 h-5 shrink-0 mt-0.5 ${hasOpnameToday ? 'text-blue-500' : 'text-gray-400'}`} />
                                <h3 className="font-bold text-gray-900 leading-tight" title={outlet.name}>{outlet.name}</h3>
                              </div>
                              <div className="flex flex-col gap-1.5 items-end">
                                {hasOpnameToday ? (
                                  <span title="Telah melakukan Opname harian" className="flex shrink-0 items-center justify-center rounded-md bg-blue-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-blue-700 border border-blue-200 animate-pulse">
                                    <ClipboardCheck className="w-3 h-3 mr-1" />
                                    Opname
                                  </span>
                                ) : (
                                  <span title="Belum melakukan Opname harian" className="flex shrink-0 items-center justify-center rounded-md bg-gray-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-gray-400 border border-gray-200">
                                    Belum Opname
                                  </span>
                                )}
                                <span title={connectedPrinters.has(outlet.id) ? "Printer Bluetooth Terhubung" : "Printer Bluetooth Terputus"} className={`flex shrink-0 items-center justify-center rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${connectedPrinters.has(outlet.id) ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                                  {connectedPrinters.has(outlet.id) ? <BluetoothConnected className="w-3 h-3 mr-1" /> : <Bluetooth className="w-3 h-3 mr-1" />}
                                  Printer
                                </span>
                              </div>
                            </div>
                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold self-start w-full sm:w-auto ${posColor}`}>
                              <PosIcon className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{posStatus}</span>
                            </div>
                          </div>

                          {/* Card Body - Crew List */}
                          <div className="p-2 flex-grow">
                            {visibleStaff.length === 0 ? (
                              <div className="py-8 px-4 flex flex-col items-center justify-center text-center">
                                <Users className="w-8 h-8 text-gray-200 mb-2" />
                                <span className="text-xs text-gray-400 font-medium">Tidak ada crew aktif / sesuai filter</span>
                              </div>
                            ) : (
                              <ul className="space-y-1">
                                {visibleStaff.map(staff => {
                                  const lastAttType = staffState.get(staff.id)
                                  let attLabel = 'Belum Absen'
                                  let attColor = 'bg-red-100 text-red-700 border border-red-100'
                                  let attDot = 'bg-red-500'

                                  if (lastAttType === 'in') {
                                    attLabel = 'Hadir'
                                    attColor = 'bg-emerald-100 text-emerald-700 border border-emerald-100'
                                    attDot = 'bg-emerald-500'
                                  } else if (lastAttType === 'out') {
                                    attLabel = 'Pulang'
                                    attColor = 'bg-gray-100 text-gray-600 border border-gray-200'
                                    attDot = 'bg-gray-400'
                                  }

                                  return (
                                    <li key={staff.id} className="flex items-center justify-between p-2 rounded-xl hover:bg-gray-50 transition-colors">
                                      <div className="flex items-center gap-2.5 truncate pr-2">
                                        <div className="w-7 h-7 rounded-full bg-indigo-50 border border-indigo-100/50 flex items-center justify-center shrink-0">
                                          <User className="w-3.5 h-3.5 text-indigo-500" />
                                        </div>
                                        <span className="text-sm font-semibold text-gray-700 truncate" title={staff.name}>{staff.name}</span>
                                      </div>
                                      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold shrink-0 ${attColor}`}>
                                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${attDot}`} />
                                        <span className="whitespace-nowrap tracking-wide uppercase">{attLabel}</span>
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
            })}
          </div>
        </div>
      )}
    </div>
  )
}
