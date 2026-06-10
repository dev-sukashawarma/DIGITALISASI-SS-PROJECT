'use client'
import { Card, Badge } from '@suka/design-system'
import { SignatureFlow } from './SignatureFlow'
import { useSuratJalanDetail } from '@/hooks/useSuratJalan'

const statusLabel: Record<string, string> = {
  draft: 'Draft',
  dikirim: 'Dikirim',
  diterima_sebagian: 'Diterima Sebagian',
  diterima_lengkap: 'Diterima Lengkap',
}

export function SuratJalanDetail({ suratJalanId }: { suratJalanId: string }) {
  const { sj, items, loading } = useSuratJalanDetail(suratJalanId)

  if (loading) return <p>Memuat…</p>
  if (!sj) return <p>Surat Jalan tidak ditemukan</p>

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="p-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-bold text-lg">Surat Jalan {sj.id.slice(0, 8)}…</h2>
          <Badge variant={sj.status === 'draft' ? 'info' as any : 'success' as any}>
            {statusLabel[sj.status]}
          </Badge>
        </div>
        <p className="text-sm text-gray-600">Outlet: {sj.outlet_id.slice(0, 8)}…</p>
        <p className="text-sm text-gray-600">Dibuat: {new Date(sj.created_at).toLocaleString('id-ID')}</p>
        {sj.notes && <p className="text-sm mt-2">{sj.notes}</p>}
      </Card>

      {/* Items */}
      <Card className="p-4">
        <h3 className="font-semibold mb-3">Item ({items.length})</h3>
        <div className="space-y-2">
          {items.map(it => (
            <div key={it.id} className="border rounded p-3 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">{it.bahan_baku_id.slice(0, 8)}…</span>
                <span>Dikirim: {it.qty_dikirim}</span>
              </div>
              {it.qty_terima !== null && (
                <div className="text-gray-600 text-xs mt-1">
                  Terima: {it.qty_terima} | Selisih: {it.selisih}
                  {it.flagged && <span className="ml-2 text-red-600 font-bold">⚠️ FLAGGED</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Signature Flow (if draft) */}
      {sj.status === 'draft' && <SignatureFlow sj={sj} />}
    </div>
  )
}
