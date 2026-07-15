'use client'
import { useState } from 'react'
import { useApprovalList } from '@/hooks/usePermintaan'
import type { PermintaanWithItems } from '@/types/permintaan'
import { ApprovalModal } from './ApprovalModal'

export function ApprovalList() {
  const { permintaan, loading, error, refresh } = useApprovalList()
  const [selected, setSelected] = useState<PermintaanWithItems | null>(null)

  if (loading) return <p className="text-xs text-[#544437]/60">Memuat…</p>
  if (error) return <p className="text-xs text-[#ba1a1a]">{error}</p>
  if (permintaan.length === 0)
    return (
      <div className="bg-white border border-[#d9c2b2]/40 rounded-2xl p-5 text-center shadow-sm">
        <p className="text-xs text-[#544437]/60">Tidak ada permintaan yang menunggu persetujuan.</p>
      </div>
    )

  return (
    <>
      <div className="space-y-3">
        {permintaan.map(p => {
          const reqCode = `#REQ-${p.id.slice(0, 4).toUpperCase()}`
          
          let omzetKotor = 0
          if (Array.isArray(p.target_metadata)) {
            omzetKotor = p.target_metadata.reduce((acc, tm) => acc + (tm.qty * (tm.harga_jual || 0)), 0)
          }
          
          return (
            <div
              key={p.id}
              onClick={() => setSelected(p)}
              className="bg-white border border-[#d9c2b2]/40 rounded-2xl p-5 shadow-sm hover:bg-[#faf2e9] cursor-pointer transition active:scale-[0.99] flex items-center justify-between group"
            >
              <div className="space-y-2 flex-1 min-w-0 pr-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold bg-[#ffdcc2] text-[#6d3900] px-2.5 py-1 rounded-lg uppercase">
                    Persetujuan
                  </span>
                  <span className="text-xs font-semibold text-[#544437]">{reqCode}</span>
                  {omzetKotor > 0 && (
                    <span className="text-[10px] font-bold bg-[#e3f5d5] text-[#2b5914] px-2 py-0.5 rounded-md border border-[#c3e3af]">
                      Potensi Omzet: Rp {omzetKotor.toLocaleString('id-ID')}
                    </span>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-[#701604] text-base truncate">
                      {p.outlet_name ?? p.outlet_id}
                    </h3>
                    {p.staff_name && (
                      <span className="text-[10px] font-medium text-[#544437]/70 bg-[#f5ede3] px-2 py-0.5 rounded-full border border-[#d9c2b2]/30">
                        Oleh: {p.staff_name}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-[#1e1b15] mt-0.5">
                    {p.items.length} item bahan baku
                  </p>
                  <div className="mt-2 space-y-1">
                    {p.items.slice(0, 3).map(it => (
                      <div key={it.bahan_baku_id} className="text-[11px] text-[#544437] flex justify-between items-center bg-[#faf2e9] px-2 py-1 rounded-md border border-[#d9c2b2]/20">
                        <span className="truncate pr-2 font-medium">{it.nama ?? it.bahan_baku_id}</span>
                        <span className="font-bold whitespace-nowrap text-[#701604]">{it.qty_diminta} {it.satuan ?? ''}</span>
                      </div>
                    ))}
                    {p.items.length > 3 && (
                      <p className="text-[10px] text-[#544437]/70 font-bold italic pt-1">+ {p.items.length - 3} item lainnya...</p>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-[#544437]/50 mt-1">
                  Dibuat: {new Date(p.created_at).toLocaleString('id-ID', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
              <span className="text-[#877365] group-hover:translate-x-1 transition-transform flex-shrink-0 text-xl font-bold">
                →
              </span>
            </div>
          )
        })}
      </div>

      {selected && (
        <ApprovalModal
          permintaan={selected}
          onClose={() => setSelected(null)}
          onDone={() => {
            setSelected(null)
            refresh()
          }}
        />
      )}
    </>
  )
}
