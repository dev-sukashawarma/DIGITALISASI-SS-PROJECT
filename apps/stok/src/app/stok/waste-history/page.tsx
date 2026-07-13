'use client'
import { useEffect, useId, useRef, useState } from 'react'
import { useAuth } from '@suka/auth'
import { toast } from 'sonner'
import { Card } from '@suka/design-system'
import { fetchMyWasteReports } from '@/app/actions/waste'
import { useRealtimeChannel } from '@/lib/realtime/useRealtimeChannel'
import { BottomNav } from '@/components/common/BottomNav'
import type { WasteReport, WasteStatus } from '@/types/stok'

const STATUS_LABEL: Record<WasteStatus, string> = {
  PENDING: 'Menunggu',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
}

const STATUS_CLASS: Record<WasteStatus, string> = {
  PENDING: 'text-yellow-600',
  APPROVED: 'text-green-600',
  REJECTED: 'text-red-600',
}

export default function WasteHistoryPage() {
  const { outletStaff } = useAuth()
  const staffId = outletStaff?.id
  const instanceId = useId()
  const [reports, setReports] = useState<WasteReport[]>([])
  const [loading, setLoading] = useState(true)
  const prevStatusRef = useRef<Map<string, WasteStatus>>(new Map())

  const load = async () => {
    if (!staffId) { setLoading(false); return }
    const data = await fetchMyWasteReports(staffId)
    const list = (data ?? []) as WasteReport[]

    list.forEach((r) => {
      const prev = prevStatusRef.current.get(r.id)
      if (prev === 'PENDING' && r.status === 'APPROVED') {
        toast.success(`Waste report ${r.bahan_baku?.nama ?? ''} disetujui`)
      } else if (prev === 'PENDING' && r.status === 'REJECTED') {
        toast.error(`Waste report ${r.bahan_baku?.nama ?? ''} ditolak`)
      }
    })
    prevStatusRef.current = new Map(list.map((r) => [r.id, r.status]))

    setReports(list)
    setLoading(false)
  }

  useEffect(() => { load() }, [staffId])

  useRealtimeChannel({
    channelName: `waste_history_${staffId ?? 'anon'}_${instanceId}`,
    enabled: !!staffId,
    subs: [
      {
        table: 'stok_waste_reports',
        event: '*',
        filter: staffId ? `reported_by=eq.${staffId}` : undefined,
        handler: () => { load() },
      },
    ],
  })

  if (loading) return <div className="p-4">Memuat...</div>

  return (
    <div className="space-y-4 p-4 max-w-2xl mx-auto pb-28">
      <h1 className="text-xl font-bold text-suka-brown">Riwayat Waste Saya</h1>

      {reports.length === 0 ? (
        <p className="text-gray-500 text-sm">Belum ada laporan waste.</p>
      ) : (
        reports.map((r) => (
          <Card key={r.id} className="p-4 flex flex-col gap-1">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold">{r.bahan_baku?.nama}</p>
                <p className="text-xs text-gray-500">{new Date(r.created_at).toLocaleString('id-ID')}</p>
              </div>
              <span className={`text-xs font-bold uppercase ${STATUS_CLASS[r.status]}`}>
                {STATUS_LABEL[r.status]}
              </span>
            </div>
            <p className="text-sm text-gray-700">{r.qty} {r.bahan_baku?.satuan} — {r.reason}</p>
            {r.status === 'REJECTED' && r.rejection_reason && (
              <p className="text-xs text-red-600">Alasan ditolak: {r.rejection_reason}</p>
            )}
          </Card>
        ))
      )}

      <BottomNav />
    </div>
  )
}
