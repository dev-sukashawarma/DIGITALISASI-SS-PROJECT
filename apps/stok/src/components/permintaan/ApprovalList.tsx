'use client'
import { useState } from 'react'
import { Card } from '@suka/design-system'
import { useApprovalList } from '@/hooks/usePermintaan'
import type { PermintaanWithItems } from '@/types/permintaan'
import { ApprovalModal } from './ApprovalModal'

export function ApprovalList() {
  const { permintaan, loading, error, refresh } = useApprovalList()
  const [selected, setSelected] = useState<PermintaanWithItems | null>(null)

  if (loading) return <p className="text-xs text-[#544437]/60">Memuat…</p>
  if (error) return <p className="text-xs text-[#ba1a1a]">{error}</p>
  if (permintaan.length === 0)
    return <p className="text-xs text-[#544437]/60">Tidak ada permintaan yang menunggu persetujuan.</p>

  return (
    <>
      <div className="space-y-3">
        {permintaan.map(p => (
          <Card
            key={p.id}
            onClick={() => setSelected(p)}
            className="p-4 border border-[#d9c2b2]/45 rounded-2xl bg-white cursor-pointer hover:bg-[#fdf6f0] transition space-y-1"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[#1e1b15]">
                {p.outlet_name ?? p.outlet_id}
              </span>
              <span className="text-[10px] text-[#544437]/60">
                {new Date(p.created_at).toLocaleString('id-ID')}
              </span>
            </div>
            <p className="text-xs text-[#544437]/70">
              {p.items.length} item
            </p>
          </Card>
        ))}
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
