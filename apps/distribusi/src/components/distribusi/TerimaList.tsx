'use client'
import Link from 'next/link'
import { Card, Button } from '@suka/design-system'
import type { SuratJalan } from '@/types/distribusi'

export function TerimaList({ items }: { items: SuratJalan[] }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">{items.length} Surat Jalan menunggu verifikasi</p>
      <div className="space-y-2">
        {items.map(sj => (
          <Card key={sj.id} className="p-4 flex justify-between items-center">
            <div>
              <p className="font-semibold">Dari Gudang Pusat</p>
              <p className="text-xs text-gray-500">{new Date(sj.created_at).toLocaleDateString('id-ID')}</p>
            </div>
            <Link href={`/distribusi/terima/${sj.id}`}>
              <Button>Verifikasi</Button>
            </Link>
          </Card>
        ))}
        {items.length === 0 && <p className="text-center text-gray-400 py-8">Tidak ada barang masuk.</p>}
      </div>
    </div>
  )
}
