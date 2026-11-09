import { Metadata } from 'next'
import { PurchasingDashboardClient } from './PurchasingDashboardClient'
import { TugasHariIni } from '@/components/purchasing/TugasHariIni'

export const metadata: Metadata = {
  title: 'Tugas Hari Ini - Suka Purchasing',
  description: 'Pekerjaan purchasing yang perlu dilakukan sekarang, plus ringkasan pengadaan bulan ini.'
}

export default function PurchasingDashboardPage() {
  return (
    <div className="w-full max-w-7xl mx-auto space-y-8">
      <TugasHariIni />
      {/* Ringkasan lama disimpan, tapi tertutup supaya beranda tidak melelahkan. */}
      <details className="group rounded-3xl border border-suka-brown/10 bg-white/60 p-4">
        <summary className="cursor-pointer select-none font-bold text-suka-brown">
          Ringkasan pengadaan bulan ini
        </summary>
        <div className="mt-4">
          <PurchasingDashboardClient />
        </div>
      </details>
    </div>
  )
}
