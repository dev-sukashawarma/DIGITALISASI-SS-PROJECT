'use client'
import { usePermintaanList } from '@/hooks/usePermintaan'
import type { PermintaanStatus } from '@/types/permintaan'

const STATUS_STYLE: Record<PermintaanStatus, string> = {
  menunggu: 'bg-amber-50 text-amber-700 border-amber-200 px-2.5 py-1 rounded-lg border uppercase',
  disetujui: 'bg-green-50 text-green-700 border-green-200 px-2.5 py-1 rounded-lg border uppercase',
  ditolak: 'bg-red-50 text-red-700 border-red-200 px-2.5 py-1 rounded-lg border uppercase',
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
      {permintaan.map(p => {
        const reqCode = `#REQ-${p.id.slice(0, 4).toUpperCase()}`
        const totalQty = p.items.reduce((acc, it) => acc + (it.qty_diminta || 0), 0)
        
        return (
          <div key={p.id} className="bg-white border border-[#d9c2b2]/40 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-bold ${STATUS_STYLE[p.status]}`}>
                  {STATUS_LABEL[p.status]}
                </span>
                <span className="text-xs font-semibold text-[#544437]">{reqCode}</span>
              </div>
              <span className="text-[12px] text-[#544437]/60">
                {new Date(p.created_at).toLocaleString('id-ID', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>

            <div className="space-y-2">
              <p className="font-bold text-[#1e1b15] text-base">
                {p.items.length} item bahan baku ({totalQty} unit)
              </p>
              
              <ul className="text-xs text-[#544437] space-y-1.5 bg-[#fff8f1] rounded-xl p-3 border border-[#d9c2b2]/20">
                {p.items.map(it => (
                  <li key={it.id} className="flex justify-between items-center">
                    <span className="font-medium text-[#1e1b15]">{it.nama ?? it.bahan_baku_id}</span>
                    <span className="font-semibold text-[#1e1b15]">
                      {it.qty_diminta}
                      {it.qty_disetujui != null && it.qty_disetujui !== it.qty_diminta && (
                        <span className="text-[#f29744] font-bold"> → {it.qty_disetujui}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {p.status === 'ditolak' && p.catatan_kitchen && (
              <p className="text-[11px] font-medium text-[#ba1a1a] bg-[#ffdad6] border border-[#ba1a1a]/20 p-2.5 rounded-xl">
                Alasan: {p.catatan_kitchen}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
