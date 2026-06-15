'use client'
import { Card } from '@suka/design-system'
import { usePermintaanList } from '@/hooks/usePermintaan'
import type { PermintaanStatus } from '@/types/permintaan'

const STATUS_STYLE: Record<PermintaanStatus, string> = {
  menunggu: 'bg-amber-50 text-amber-700 border-amber-200',
  disetujui: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ditolak: 'bg-red-50 text-red-700 border-red-200',
}
const STATUS_LABEL: Record<PermintaanStatus, string> = {
  menunggu: 'Menunggu', disetujui: 'Disetujui', ditolak: 'Ditolak',
}

export function PermintaanList({ outletId }: { outletId: string }) {
  const { permintaan, loading, error } = usePermintaanList(outletId)

  if (loading) return <p className="text-xs text-[#544437]/60">Memuat…</p>
  if (error) return <p className="text-xs text-[#ba1a1a]">{error}</p>
  if (permintaan.length === 0) return <p className="text-xs text-[#544437]/60">Belum ada permintaan.</p>

  return (
    <div className="space-y-3">
      {permintaan.map(p => (
        <Card key={p.id} className="p-4 border border-[#d9c2b2]/45 rounded-2xl bg-white space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#544437]/60 font-semibold">
              {new Date(p.created_at).toLocaleString('id-ID')}
            </span>
            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${STATUS_STYLE[p.status]}`}>
              {STATUS_LABEL[p.status]}
            </span>
          </div>
          <ul className="text-xs text-[#1e1b15] space-y-0.5">
            {p.items.map(it => (
              <li key={it.id} className="flex justify-between">
                <span>{it.bahan_baku_id}</span>
                <span>
                  {it.qty_diminta}
                  {it.qty_disetujui != null && it.qty_disetujui !== it.qty_diminta && (
                    <span className="text-[#f29744] font-bold"> → {it.qty_disetujui}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {p.status === 'ditolak' && p.catatan_kitchen && (
            <p className="text-[11px] text-red-600">Alasan: {p.catatan_kitchen}</p>
          )}
        </Card>
      ))}
    </div>
  )
}
