'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { Spinner } from '@suka/design-system'
import { Select } from '@/components/ui/Select'
import type { PeriodFilterValue } from '@/lib/types'
import { presetRange } from '@/lib/period'
import { User, Store, Lock, Unlock, Users, UserCheck, UserX, MapPin, Monitor, ClipboardCheck, Bluetooth, BluetoothConnected, Navigation, Calendar, Clock } from 'lucide-react'
import dynamic from 'next/dynamic'

const LiveLocationMap = dynamic(() => import('./LiveLocationMap'), { 
  ssr: false, 
  loading: () => <div className="w-full h-[600px] bg-gray-100 animate-pulse rounded-2xl border border-gray-200"></div> 
})

type Outlet = { id: string; name: string; is_active: boolean; region?: string | null; lat?: number | null; lng?: number | null; address?: string | null }
type Staff = { id: string; name: string; outlet_id: string; role: string; is_active: boolean }
type StaffOutletMap = { staff_id: string; outlet_id: string }
type Attendance = { outlet_id: string; outlet_staff_id: string; type: 'in' | 'out'; ts_server: string }
type Opname = { id: string; outlet_id: string; created_at: string }

function cleanOutletShortName(name: string): string {
  return name.replace(/^SUKA SHAWARMA\s+/i, '').replace(/^MITRA\s+/i, '')
}

// ── Date & Time Format Helpers ─────────────────────────────────────
function getWIBDateStr(tsServerStr: string): string {
  try {
    const d = new Date(tsServerStr)
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    return formatter.format(d)
  } catch {
    return tsServerStr ? tsServerStr.slice(0, 10) : ''
  }
}

function formatWIBTime(tsServerStr: string): string {
  try {
    const d = new Date(tsServerStr)
    return d.toLocaleTimeString('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).replace(':', '.') + ' WIB'
  } catch {
    return ''
  }
}

function formatIndonesianDate(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number)
    const dateObj = new Date(Date.UTC(y, m - 1, d))
    return dateObj.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    })
  } catch {
    return dateStr
  }
}

function getDatesInRange(fromStr: string, toStr: string): string[] {
  const dates: string[] = []
  try {
    let curr = new Date(fromStr + 'T00:00:00Z')
    const last = new Date(toStr + 'T00:00:00Z')
    while (curr <= last) {
      dates.push(curr.toISOString().slice(0, 10))
      curr.setUTCDate(curr.getUTCDate() + 1)
    }
  } catch {
    dates.push(fromStr)
  }
  return dates.reverse() // Terbaru dulu
}

function CustomDateRangePopover({
  from, to, onChange, isActive
}: {
  from: string
  to: string
  onChange: (range: { from: string; to: string }) => void
  isActive: boolean
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  
  const [localFrom, setLocalFrom] = useState(from)
  const [localTo, setLocalTo] = useState(to)

  useEffect(() => {
    if (open) {
      setLocalFrom(from)
      setLocalTo(to)
    }
  }, [open, from, to])

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const handleApply = () => {
    if (localFrom && localTo) {
      onChange({ from: localFrom, to: localTo })
      setOpen(false)
    }
  }

  return (
    <div ref={rootRef} className="relative flex">
      <button
        onClick={() => setOpen(!open)}
        className={`px-3 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all text-xs cursor-pointer ${
          isActive || open
            ? 'bg-suka-orange text-white shadow-sm font-extrabold'
            : 'text-slate-600 hover:text-slate-900 hover:bg-white/80 font-bold'
        }`}
        title="Rentang tanggal kustom"
      >
        <Calendar className="w-3.5 h-3.5" />
        <span>Kustom</span>
      </button>

      {open && (
        <div className="absolute top-full left-0 sm:left-auto sm:right-0 mt-2 p-4 w-[280px] max-w-[calc(100vw-2rem)] bg-white border border-slate-200 rounded-2xl shadow-xl z-[9999] animate-in fade-in zoom-in-95 duration-200">
          <h4 className="text-sm font-bold text-slate-900 mb-3">Pilih Rentang Tanggal</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Dari Tanggal</label>
              <input 
                type="date" 
                value={localFrom} 
                onChange={(e) => setLocalFrom(e.target.value)} 
                className="w-full px-3 py-2 border border-slate-200 focus:border-suka-orange focus:ring-2 focus:ring-suka-orange/10 rounded-xl text-xs outline-none transition-all text-slate-800 font-semibold"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Sampai Tanggal</label>
              <input 
                type="date" 
                value={localTo} 
                onChange={(e) => setLocalTo(e.target.value)} 
                min={localFrom}
                className="w-full px-3 py-2 border border-slate-200 focus:border-suka-orange focus:ring-2 focus:ring-suka-orange/10 rounded-xl text-xs outline-none transition-all text-slate-800 font-semibold"
              />
            </div>
            <button 
              onClick={handleApply}
              disabled={!localFrom || !localTo || localTo < localFrom}
              className="w-full mt-2 bg-suka-orange hover:bg-orange-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-extrabold py-2.5 rounded-xl text-xs transition-all shadow-sm active:scale-95"
            >
              Terapkan Filter
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function MonitoringPage() {
  const [activeTab, setActiveTab] = useState<'POS' | 'LOCATION'>('POS')
  const [selectedOutletId, setSelectedOutletId] = useState<string>('ALL')
  const [posStatusFilter, setPosStatusFilter] = useState<string>('ALL')
  const [crewStatusFilter, setCrewStatusFilter] = useState<string>('ALL')
  
  // Period filter (Kemarin, Hari Ini, 7 Hari, 30 Hari, Kustom)
  const [periodFilter, setPeriodFilter] = useState<PeriodFilterValue>(() => {
    const today = presetRange('today')
    return {
      from: today.from,
      to: today.to,
      outletId: 'all',
      source: 'all',
    }
  })

  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [staffOutletMappings, setStaffOutletMappings] = useState<StaffOutletMap[]>([])
  const [attendances, setAttendances] = useState<Attendance[]>([])
  const [opnames, setOpnames] = useState<Opname[]>([])
  const [connectedPrinters, setConnectedPrinters] = useState<Set<string>>(new Set())
  const [crewLocations, setCrewLocations] = useState<any[]>([])
  
  const [checklistReq, setChecklistReq] = useState<Record<string, string[]>>({})
  const [checklistTicks, setChecklistTicks] = useState<Record<string, string[]>>({})
  
  const [isLoading, setIsLoading] = useState(true)

  const supabase = createClient()

  // Active preset helper
  const activePreset = () => {
    const pToday = presetRange('today')
    if (periodFilter.from === pToday.from && periodFilter.to === pToday.to) return 'today'
    
    const pYesterday = presetRange('yesterday')
    if (periodFilter.from === pYesterday.from && periodFilter.to === pYesterday.to) return 'yesterday'

    const p7d = presetRange('7d')
    if (periodFilter.from === p7d.from && periodFilter.to === p7d.to) return '7d'

    const p30d = presetRange('30d')
    if (periodFilter.from === p30d.from && periodFilter.to === p30d.to) return '30d'

    return null
  }

  const currentPreset = activePreset()

  // Lista tanggal dalam rentang terpilih
  const dateListInRange = useMemo(() => {
    return getDatesInRange(periodFilter.from, periodFilter.to)
  }, [periodFilter.from, periodFilter.to])

  const isMultiDay = dateListInRange.length > 1

  const fetchData = async () => {
    try {
      const fromDate = periodFilter.from
      const toDate = periodFilter.to
      const start = new Date(`${fromDate}T00:00:00+07:00`).toISOString()
      const end = new Date(`${toDate}T23:59:59+07:00`).toISOString()

      const [outRes, stfRes, mapRes, attRes, catRes, recRes, opnRes] = await Promise.all([
        supabase.from('outlets').select('id, name, is_active, region, lat, lng, address').eq('is_active', true),
        supabase.from('outlet_staff').select('id, name, outlet_id, role, is_active').eq('is_active', true).in('role', ['crew', 'leader', 'spv']),
        supabase.from('staff_outlets').select('staff_id, outlet_id'),
        supabase.from('attendance')
          .select('outlet_id, outlet_staff_id, type, ts_server')
          .gte('ts_server', start)
          .lte('ts_server', end)
          .order('ts_server', { ascending: true }),
        supabase.from('checklist_categories')
          .select('id, outlet_id, checklist_items(id, is_required)')
          .eq('phase', 'buka'),
        supabase.from('daily_checklist_records')
          .select('id, outlet_id, date')
          .gte('date', fromDate)
          .lte('date', toDate),
        supabase.from('opname')
          .select('id, outlet_id, created_at')
          .gte('created_at', start)
          .lte('created_at', end)
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
      setStaffOutletMappings((mapRes.data || []) as StaffOutletMap[])
      setAttendances((attRes.data || []) as Attendance[])
      setChecklistReq(reqMap)
      setChecklistTicks(ticksMap)
      setOpnames((opnRes.data || []) as Opname[])
      
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()

    const channelId = `monitoring_${Math.random().toString(36).substring(7)}`
    const sub = supabase.channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_checklist_ticks' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_checklist_records' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'opname' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_outlets' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'outlet_staff' }, () => fetchData())
      .subscribe()

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
  }, [periodFilter.from, periodFilter.to])

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

  const allCrewsForMap = [...crewLocations]
  const presentStaffIds = new Set(attendances.map(a => a.outlet_staff_id))
  
  staffList.forEach(staff => {
    if (presentStaffIds.has(staff.id)) {
      const isLive = crewLocations.some(c => c.staff_id === staff.id)
      if (!isLive) {
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

  // Helper render per outlet card for a specific date
  const renderOutletCardForDate = (outlet: Outlet, targetDateStr: string) => {
    // 1. Staff belonging to this outlet (either primary outlet_id OR mapped in staff_outlets) OR spv
    const outletStaff = staffList.filter(s => 
      s.role === 'spv' ||
      s.outlet_id === outlet.id || 
      staffOutletMappings.some(m => m.staff_id === s.id && m.outlet_id === outlet.id)
    )
    
    // Filter attendance for this outlet on targetDateStr
    const outletAttDate = attendances.filter(a => a.outlet_id === outlet.id && getWIBDateStr(a.ts_server) === targetDateStr)
    
    // Filter attendance for ALL outlets on targetDateStr to know cross-outlet attendance for leaders
    const allAttDate = attendances.filter(a => getWIBDateStr(a.ts_server) === targetDateStr)
    const staffAttMap = new Map<string, Attendance[]>()
    allAttDate.forEach(a => {
      if (!staffAttMap.has(a.outlet_staff_id)) {
        staffAttMap.set(a.outlet_staff_id, [])
      }
      staffAttMap.get(a.outlet_staff_id)!.push(a)
    })

    // Check opname record & timestamp on targetDateStr
    const opnameRecord = opnames.find(o => o.outlet_id === outlet.id && getWIBDateStr(o.created_at) === targetDateStr)
    const opnameTimeStr = opnameRecord ? formatWIBTime(opnameRecord.created_at) : null

    // Extract Buka Shift (first IN) and Tutup Shift (last OUT) timestamps for THIS outlet
    const inAtts = outletAttDate.filter(a => a.type === 'in')
    const outAtts = outletAttDate.filter(a => a.type === 'out')

    const firstIn = inAtts.length > 0
      ? inAtts.reduce((earliest, curr) => new Date(curr.ts_server) < new Date(earliest.ts_server) ? curr : earliest)
      : null
    const openingTimeStr = firstIn ? formatWIBTime(firstIn.ts_server) : null

    const lastOut = outAtts.length > 0
      ? outAtts.reduce((latest, curr) => new Date(curr.ts_server) > new Date(latest.ts_server) ? curr : latest)
      : null
    const closingTimeStr = lastOut ? formatWIBTime(lastOut.ts_server) : null

    // POS Kuncian status calculation for THIS outlet
    const thisOutletStaffState = new Map<string, { type: 'in' | 'out'; timeStr: string }>()
    outletAttDate.forEach(a => {
      thisOutletStaffState.set(a.outlet_staff_id, {
        type: a.type,
        timeStr: formatWIBTime(a.ts_server)
      })
    })

    let posStatus = 'Terkunci - Menunggu Absen'
    let posColor = 'bg-red-50 text-red-700 border-red-200'
    let PosIcon = Lock
    
    const hasAnyoneIn = Array.from(thisOutletStaffState.values()).some(s => s.type === 'in')
    const isEveryoneOut = thisOutletStaffState.size > 0 && Array.from(thisOutletStaffState.values()).every(s => s.type === 'out')

    if (isEveryoneOut) {
      posStatus = closingTimeStr ? `Terkunci - Tutup Shift (${closingTimeStr})` : 'Terkunci - Tutup'
      posColor = 'bg-slate-100 text-slate-700 border-slate-200'
    } else if (hasAnyoneIn) {
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

    // Filter staff for crewStatusFilter
    const visibleStaff = outletStaff.filter(staff => {
      const staffAtts = staffAttMap.get(staff.id) || []
      const isPresent = staffAtts.some(a => a.type === 'in')
      if (crewStatusFilter === 'PRESENT' && !isPresent) return false
      if (crewStatusFilter === 'NOT_PRESENT' && isPresent) return false
      return true
    })

    // Apply POS status filter
    const isOpen = posStatus.startsWith('Terbuka')
    if (posStatusFilter === 'OPEN' && !isOpen) return null
    if (posStatusFilter === 'LOCKED' && isOpen) return null

    if (crewStatusFilter !== 'ALL' && visibleStaff.length === 0) return null

    // Multi-day filter: if multi-day view, only show crew who actually attended on that day
    const displayedStaff = isMultiDay 
      ? visibleStaff.filter(s => staffAttMap.has(s.id)) 
      : visibleStaff

    if (isMultiDay && displayedStaff.length === 0) return null

    return (
      <div key={`${outlet.id}-${targetDateStr}`} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-all duration-200 flex flex-col h-full group">
        {/* Card Header */}
        <div className={`p-4 border-b flex flex-col gap-3 flex-shrink-0 relative ${opnameTimeStr ? 'border-blue-50 bg-blue-50/20' : 'border-slate-50'}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <Store className={`w-5 h-5 shrink-0 mt-0.5 ${opnameTimeStr ? 'text-blue-500' : 'text-slate-400'}`} />
              <div>
                <h3 className="font-bold text-slate-900 leading-tight" title={outlet.name}>{outlet.name}</h3>
                {isMultiDay && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 mt-0.5">
                    <Calendar size={10} /> {formatIndonesianDate(targetDateStr)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-1.5 items-end">
              {opnameTimeStr ? (
                <span title={`Telah melakukan Opname harian pada ${opnameTimeStr}`} className="flex shrink-0 items-center justify-center rounded-md bg-blue-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-blue-800 border border-blue-300/80 shadow-xs animate-pulse">
                  <ClipboardCheck className="w-3 h-3 mr-1 text-blue-600" />
                  Opname {opnameTimeStr}
                </span>
              ) : (
                <span title="Belum melakukan Opname harian" className="flex shrink-0 items-center justify-center rounded-md bg-slate-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400 border border-slate-200">
                  Belum Opname
                </span>
              )}
              <span title={connectedPrinters.has(outlet.id) ? "Printer Bluetooth Terhubung" : "Printer Bluetooth Terputus"} className={`flex shrink-0 items-center justify-center rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${connectedPrinters.has(outlet.id) ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                {connectedPrinters.has(outlet.id) ? <BluetoothConnected className="w-3 h-3 mr-1" /> : <Bluetooth className="w-3 h-3 mr-1" />}
                Printer
              </span>
            </div>
          </div>

          {/* Status Kuncian POS */}
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold self-start w-full sm:w-auto ${posColor}`}>
            <PosIcon className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{posStatus}</span>
          </div>

          {/* Jam Operasional Shift & Opname Sub-Bar */}
          {(openingTimeStr || closingTimeStr || opnameTimeStr) && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px] font-bold border-t border-slate-100">
              {openingTimeStr && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200/70" title="Waktu Buka Shift (Kru Pertama Masuk)">
                  <Clock size={10} className="text-emerald-600 shrink-0" />
                  <span>Buka: {openingTimeStr}</span>
                </span>
              )}
              {closingTimeStr && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200/80" title="Waktu Tutup Shift (Kru Terakhir Pulang)">
                  <Lock size={10} className="text-slate-600 shrink-0" />
                  <span>Tutup Shift: {closingTimeStr}</span>
                </span>
              )}
              {opnameTimeStr && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200/80" title="Waktu Input Opname Harian">
                  <ClipboardCheck size={10} className="text-blue-600 shrink-0" />
                  <span>Opname: {opnameTimeStr}</span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Card Body - Crew List with exact date & time */}
        <div className="p-2 flex-grow">
          {displayedStaff.length === 0 ? (
            <div className="py-8 px-4 flex flex-col items-center justify-center text-center">
              <Users className="w-8 h-8 text-slate-200 mb-2" />
              <span className="text-xs text-slate-400 font-medium">Tidak ada crew aktif pada tanggal ini</span>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {displayedStaff.map(staff => {
                const staffAtts = staffAttMap.get(staff.id) || []
                const attAtThisOutlet = staffAtts.filter(a => a.outlet_id === outlet.id)
                const latestAttThisOutlet = attAtThisOutlet.length > 0 ? attAtThisOutlet[attAtThisOutlet.length - 1] : null

                let attLabel = 'Belum Absen'
                let attColor = 'bg-red-100 text-red-700 border border-red-100'
                let attDot = 'bg-red-500'
                let timeStr = ''

                if (latestAttThisOutlet) {
                  if (latestAttThisOutlet.type === 'in') {
                    attLabel = 'Hadir'
                    attColor = 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    attDot = 'bg-emerald-500'
                  } else {
                    attLabel = 'Pulang'
                    attColor = 'bg-slate-100 text-slate-700 border border-slate-200'
                    attDot = 'bg-slate-400'
                  }
                  timeStr = formatWIBTime(latestAttThisOutlet.ts_server)
                } else if (staffAtts.length > 0) {
                  const latestRemoteAtt = staffAtts[staffAtts.length - 1]
                  const remoteOutlet = outlets.find(o => o.id === latestRemoteAtt.outlet_id)
                  const remoteShortName = remoteOutlet ? cleanOutletShortName(remoteOutlet.name) : 'Outlet Lain'
                  
                  if (latestRemoteAtt.type === 'in') {
                    attLabel = `Hadir di ${remoteShortName}`
                    attColor = 'bg-blue-100 text-blue-800 border border-blue-200 shadow-2xs font-extrabold'
                    attDot = 'bg-blue-500'
                  } else {
                    attLabel = `Pulang di ${remoteShortName}`
                    attColor = 'bg-slate-100 text-slate-700 border border-slate-200'
                    attDot = 'bg-slate-400'
                  }
                  timeStr = formatWIBTime(latestRemoteAtt.ts_server)
                }

                const livePresence = crewLocations.find(c => c.staff_id === staff.id)
                
                return (
                  <li key={`${staff.id}-${targetDateStr}`} className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-2 pr-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-indigo-50 border border-indigo-100/50 flex items-center justify-center shrink-0">
                        <User className="w-3.5 h-3.5 text-indigo-500" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-slate-800 truncate block" title={staff.name}>{staff.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] uppercase font-bold text-suka-orange block">{staff.role}</span>
                          {livePresence && (livePresence.device_os || livePresence.device_model) && (
                            <span className="text-[8px] font-bold text-purple-600 bg-purple-50 border border-purple-100 px-1 rounded uppercase tracking-tighter" title={`Device: ${livePresence.device_model || 'Unknown'} - ${livePresence.device_os || 'Unknown'}`}>
                              {livePresence.device_model || livePresence.device_os}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end shrink-0">
                      <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold ${attColor}`}>
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${attDot}`} />
                        <span className="whitespace-nowrap uppercase">{attLabel}</span>
                      </div>
                      {timeStr && (
                        <span className="text-[9px] font-mono font-bold text-slate-500 flex items-center gap-0.5 mt-0.5">
                          <Clock size={9} /> {timeStr}
                        </span>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto">
      
      {/* Header & Tabs */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Monitoring Aktivitas</h1>
            <p className="text-sm font-semibold text-slate-500 mt-1">Pantau status POS, absensi kru, jam opname, dan waktu tutup shift secara real-time</p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <button
            onClick={() => setActiveTab('POS')}
            className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-colors flex items-center gap-2
              ${activeTab === 'POS' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}
          >
            <Monitor className="w-4 h-4" />
            POS &amp; Crew
          </button>
          <button
            onClick={() => setActiveTab('LOCATION')}
            className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-colors flex items-center gap-2
              ${activeTab === 'LOCATION' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}
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
          {/* Unified Clean Filter Toolbar Bar */}
          <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3 relative z-30">
            {/* Sleek Modern Date Presets */}
            <div className="bg-slate-100/90 p-1 rounded-xl border border-slate-200/60 flex flex-wrap sm:flex-nowrap items-center gap-1 text-xs font-bold">
              {(['yesterday', 'today', '7d', '30d'] as const).map((p) => {
                const isActive = currentPreset === p
                const label = p === 'today' ? 'Hari ini' : p === 'yesterday' ? 'Kemarin' : p === '7d' ? '7 Hari' : '30 Hari'
                return (
                  <button
                    key={p}
                    onClick={() => setPeriodFilter({ ...periodFilter, ...presetRange(p) })}
                    className={`px-3 py-1.5 rounded-lg whitespace-nowrap text-xs transition-all active:scale-95 cursor-pointer ${
                      isActive
                        ? 'bg-suka-orange text-white shadow-sm font-extrabold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/80 font-bold'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
              <CustomDateRangePopover
                from={periodFilter.from}
                to={periodFilter.to}
                onChange={(range) => setPeriodFilter({ ...periodFilter, from: range.from, to: range.to })}
                isActive={currentPreset === null}
              />
            </div>

            {/* Status Dropdowns */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <Select 
                value={posStatusFilter}  
                onChange={setPosStatusFilter}
                placeholder="Status POS..."
                className="w-full sm:w-[170px]"
                options={[
                  { label: 'Semua Status POS', value: 'ALL', icon: <Monitor className="w-4 h-4 text-slate-400" /> },
                  { label: 'POS Terbuka', value: 'OPEN', icon: <Unlock className="w-4 h-4 text-emerald-500" /> },
                  { label: 'POS Terkunci', value: 'LOCKED', icon: <Lock className="w-4 h-4 text-red-500" /> }
                ]}
              />
              <Select 
                value={crewStatusFilter} 
                onChange={setCrewStatusFilter}
                placeholder="Status Crew..."
                className="w-full sm:w-[170px]"
                options={[
                  { label: 'Semua Status Crew', value: 'ALL', icon: <Users className="w-4 h-4 text-slate-400" /> },
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
                className="w-full sm:w-[220px]"
                options={[
                  { label: 'Semua Cabang', value: 'ALL', icon: <MapPin className="w-4 h-4 text-slate-400" /> },
                  ...outlets.map(o => ({ label: o.name, value: o.id, icon: <Store className="w-4 h-4 text-indigo-500" /> }))
                ]}
              />
            </div>
          </div>

          {/* ── Multi-Day vs Single-Day Render Layout ───────────────────── */}
          <div className="space-y-12">
            {dateListInRange.map((dateStr) => {
              // Group outlets for this date
              const regionKeys = Object.keys(groupedOutlets).sort()
              
              // Count total rendered cards for this date to avoid empty date headers
              let dateCardCount = 0
              regionKeys.forEach(regionName => {
                const regionOutlets = groupedOutlets[regionName].filter(outlet => selectedOutletId === 'ALL' || outlet.id === selectedOutletId)
                regionOutlets.forEach(o => {
                  if (renderOutletCardForDate(o, dateStr) !== null) dateCardCount++
                })
              })

              if (dateCardCount === 0) return null

              return (
                <div key={dateStr} className="space-y-6">
                  {/* Date Header Section */}
                  <div className="flex items-center gap-3 bg-slate-100/80 px-4 py-2.5 rounded-2xl border border-slate-200/80 backdrop-blur-sm">
                    <Calendar className="w-5 h-5 text-suka-orange shrink-0" />
                    <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                      {formatIndonesianDate(dateStr)}
                    </h2>
                    <span className="ml-auto text-xs font-bold text-slate-600 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm">
                      {dateCardCount} Outlet Beraktivitas
                    </span>
                  </div>

                  {/* Regions & Outlet Cards for dateStr */}
                  <div className="space-y-8 pl-1 sm:pl-2">
                    {regionKeys.map(regionName => {
                      const regionOutlets = groupedOutlets[regionName].filter(outlet => selectedOutletId === 'ALL' || outlet.id === selectedOutletId)
                      
                      const renderedCards = regionOutlets
                        .map(outlet => renderOutletCardForDate(outlet, dateStr))
                        .filter(card => card !== null)

                      if (renderedCards.length === 0) return null

                      return (
                        <div key={`${regionName}-${dateStr}`} className="space-y-3">
                          <div className="flex items-center gap-3">
                            <h3 className="text-sm font-extrabold text-slate-700 flex items-center gap-1.5">
                              <MapPin className="w-4 h-4 text-suka-orange" />
                              {regionName}
                            </h3>
                            <div className="h-px bg-slate-200 flex-1"></div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                            {renderedCards}
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
