'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Card, Badge } from '@suka/design-system'
import type { Opname, OpnameItem } from '@/types/stok'

export function OpnameDetail({ opnameId }: { opnameId: string }) {
  const [opname, setOpname] = useState<Opname | null>(null)
  const [items, setItems] = useState<OpnameItem[]>([])
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    setError(null)
    const supabase = createClient()
    const load = async () => {
      try {
        const [opnameRes, itemsRes] = await Promise.all([
          supabase.from('opname').select('*').eq('id', opnameId).single(),
          supabase.from('opname_item').select('*').eq('opname_id', opnameId)
        ])
        
        if (opnameRes.error) throw opnameRes.error
        if (itemsRes.error) throw itemsRes.error

        setOpname(opnameRes.data as Opname)
        setItems((itemsRes.data as OpnameItem[]) ?? [])
      } catch (err: any) {
        setError(`Gagal memuat detail opname: ${err.message || err}`)
      }
    }
    load()
  }, [opnameId])
  if (error) return <p className="text-red-600">{error}</p>
  if (!opname) return <p>Memuat…</p>
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex justify-between">
          <div>
            <p className="font-semibold">{opname.tanggal}</p>
            <p className="text-xs text-gray-500 capitalize">{opname.tipe}</p>
          </div>
          <Badge variant={opname.status==='finalized'?'success' as any:'default' as any}>
            {opname.status==='finalized'?'Selesai':'Draft'}
          </Badge>
        </div>
        {opname.notes && <p className="mt-2 text-sm">{opname.notes}</p>}
      </Card>
      <div className="space-y-1">
        {items.map(it => (
          <Card key={it.id} className={`p-3 flex justify-between ${it.flagged?'border-2 border-red-400':''}`}>
            <span className="text-sm">{it.bahan_baku_id.slice(0,8)}…</span>
            <span className="text-sm">fisik {it.qty_fisik ?? '-'} / sistem {it.qty_system}</span>
            <span className={`text-sm ${it.flagged?'text-red-600 font-bold':''}`}>
              {it.selisih>0?'+':''}{it.selisih}
            </span>
          </Card>
        ))}
      </div>
    </div>
  )
}
