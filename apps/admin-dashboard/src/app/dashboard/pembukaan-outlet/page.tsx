import Link from 'next/link'
import { Sparkles, Store, ChevronRight } from 'lucide-react'
import { requireRole } from '@/lib/authz'
import { Card, EmptyState, PageHeader } from '@/components/ui'
import { ambilDaftarPersiapan } from './actions'
import { hitungPenutupanTerbuka } from '../penutupan-outlet/actions'
import { hitungMundur, ringkasLangkahWajib } from '@/lib/pembukaanOutlet/petakan'
import { hariIniWib } from '@/lib/pembukaanOutlet/konstanta'
import { OutletTabs } from '@/components/outlet/OutletTabs'

export const dynamic = 'force-dynamic'

export default async function PembukaanOutletPage() {
  const { role } = await requireRole(['admin', 'owner'])
  const bolehTulis = role === 'admin' || role === 'developer'
  const [daftar, jumlahPenutupan] = await Promise.all([ambilDaftarPersiapan(), hitungPenutupanTerbuka()])
  const hariIni = hariIniWib()

  return (
    <div className="space-y-6">
      <PageHeader
        // Admin/developer: tab "Persiapan" di menu Outlet. Owner hanya punya
        // halaman ini (tidak bisa membuka /dashboard/outlets), jadi tanpa tab.
        title={bolehTulis ? 'Outlet' : 'Pembukaan Outlet'}
        description="Outlet yang sedang disiapkan. Kemajuan tiap langkah terbaca otomatis dari data."
        icon={bolehTulis ? Store : Sparkles}
      >
        {bolehTulis && (
          <Link
            href="/dashboard/pembukaan-outlet/baru"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-suka-orange px-4 py-2.5 text-sm font-bold text-white hover:opacity-90"
          >
            <Store className="h-4 w-4" /> Tambah Outlet
          </Link>
        )}
      </PageHeader>

      {bolehTulis && <OutletTabs aktif="persiapan" jumlahPersiapan={daftar.length} jumlahPenutupan={jumlahPenutupan} />}

      {daftar.length === 0 ? (
        <Card>
          <EmptyState
            icon={Store}
            title="Tidak ada outlet yang sedang dipersiapkan."
            description={bolehTulis ? 'Tekan "Tambah Outlet" untuk memulai.' : undefined}
          />
        </Card>
      ) : (
        <div className="grid gap-3">
          {daftar.map(s => {
            const r = ringkasLangkahWajib(s.langkah)
            const mundur = hitungMundur(s.tanggalGrandOpening, hariIni)
            const terlambat = mundur.startsWith('Lewat')
            return (
              <Link key={s.outletId} href={`/dashboard/pembukaan-outlet/${s.outletId}`}>
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
                        Grand opening{' '}
                        {s.tanggalGrandOpening ? (
                          <>
                            {new Date(`${s.tanggalGrandOpening}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {' · '}
                            <span className={terlambat ? 'font-semibold text-red-600' : 'font-semibold'}>{mundur}</span>
                          </>
                        ) : (
                          <span className="font-semibold text-amber-700">belum ditentukan</span>
                        )}
                        {' · '}
                        {r.selesai}/{r.total} wajib
                        {r.tertahan && <> · menunggu {r.tertahan.toLowerCase()}</>}
                      </p>
                    </div>
                    {s.siapGoLive && (
                      <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-800">Siap Go-Live</span>
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
