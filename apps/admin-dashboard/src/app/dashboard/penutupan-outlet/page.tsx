import Link from 'next/link'
import { ChevronRight, Store, DoorClosed } from 'lucide-react'
import { requireRole } from '@/lib/authz'
import { Card, EmptyState, PageHeader } from '@/components/ui'
import { OutletTabs } from '@/components/outlet/OutletTabs'
import { ringkasPenutupan } from '@/lib/penutupanOutlet/petakan'
import { createClient } from '@/lib/supabase/server'
import { ambilDaftarPenutupan } from './actions'

export const dynamic = 'force-dynamic'

async function hitungPersiapan(): Promise<number> {
  const supabase = await createClient()
  const { count } = await supabase.from('outlets').select('id', { count: 'exact', head: true }).eq('status', 'pending')
  return count ?? 0
}

export default async function PenutupanOutletPage() {
  const { role } = await requireRole(['admin', 'owner'])
  const bolehTulis = role === 'admin' || role === 'developer'
  const [daftar, jumlahPersiapan] = await Promise.all([ambilDaftarPenutupan(), hitungPersiapan()])

  return (
    <div className="space-y-6">
      <PageHeader
        // Admin/developer: tab "Penutupan" di menu Outlet. Owner hanya punya
        // halaman ini (tidak bisa membuka /dashboard/outlets), jadi tanpa tab.
        title={bolehTulis ? 'Outlet' : 'Penutupan Outlet'}
        description="Outlet yang sudah ditutup dan masih dibereskan. Kemajuan tiap langkah terbaca otomatis dari data."
        icon={bolehTulis ? Store : DoorClosed}
      />

      {bolehTulis && (
        <OutletTabs aktif="penutupan" jumlahPersiapan={jumlahPersiapan} jumlahPenutupan={daftar.length} />
      )}

      {daftar.length === 0 ? (
        <Card>
          <EmptyState
            icon={DoorClosed}
            title="Tidak ada penutupan yang masih berjalan."
            description={bolehTulis ? 'Untuk menutup outlet, pakai tombol Tutup di tab Semua Outlet.' : undefined}
          />
        </Card>
      ) : (
        <div className="grid gap-3">
          {daftar.map(s => {
            const r = ringkasPenutupan(s.langkah)
            return (
              <Link key={s.outletId} href={`/dashboard/penutupan-outlet/${s.outletId}`}>
                <Card className="hover:border-suka-orange transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-suka-ink">{s.nama}</span>
                        <span className="rounded-full bg-suka-cream px-2 py-0.5 text-xs font-semibold text-suka-brown">
                          {s.jenis === 'mitra' ? 'Mitra' : 'Internal'}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-suka-ink/70">
                        Tutup{' '}
                        {s.nonaktifAt
                          ? new Date(`${s.nonaktifAt}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                          : '—'}
                        {' · '}
                        {r.selesai}/{r.total} wajib
                        {r.tertahan && <> · menunggu {r.tertahan.toLowerCase()}</>}
                      </p>
                    </div>
                    {s.siapSelesai && (
                      <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-800">Siap ditandai selesai</span>
                    )}
                    <ChevronRight className="h-5 w-5 shrink-0 text-suka-ink/40" />
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
