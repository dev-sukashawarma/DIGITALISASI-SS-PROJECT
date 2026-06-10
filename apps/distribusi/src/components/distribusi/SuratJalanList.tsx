'use client'
import Link from 'next/link'
import { Card, Badge, Button } from '@suka/design-system'
import type { SuratJalan } from '@/types/distribusi'

const statusLabel: Record<string, { label: string; variant: 'success' | 'warning' | 'error' | 'info' }> = {
  draft: { label: 'Draft', variant: 'info' },
  dikirim: { label: 'Dikirim', variant: 'warning' },
  diterima_sebagian: { label: 'Diterima Sebagian', variant: 'warning' },
  diterima_lengkap: { label: 'Diterima Lengkap', variant: 'success' },
}

export function SuratJalanList({ items }: { items: SuratJalan[] }) {
  const draftCount = items.filter(s => s.status === 'draft').length
  const dikirimCount = items.filter(s => s.status === 'dikirim').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">{draftCount} draft · {dikirimCount} sedang dikirim</p>
        <Link href="/distribusi/surat-jalan/new">
          <Button>+ Surat Jalan Baru</Button>
        </Link>
      </div>
      <div className="space-y-2">
        {items.map(sj => (
          <Link key={sj.id} href={`/distribusi/surat-jalan/${sj.id}`}>
            <Card className="p-4 flex justify-between items-center cursor-pointer hover:shadow-md transition">
              <div>
                <p className="font-semibold">Outlet {sj.outlet_id.slice(0, 8)}…</p>
                <p className="text-xs text-gray-500">{new Date(sj.created_at).toLocaleDateString('id-ID')}</p>
              </div>
              <Badge variant={statusLabel[sj.status].variant}>
                {statusLabel[sj.status].label}
              </Badge>
            </Card>
          </Link>
        ))}
        {items.length === 0 && <p className="text-center text-gray-400 py-8">Belum ada Surat Jalan.</p>}
      </div>
    </div>
  )
}
