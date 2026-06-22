import { Users, CalendarClock, Briefcase, CalendarHeart } from 'lucide-react'
import Link from 'next/link'

export default function HRDashboard() {
  const cards = [
    { title: 'Database Karyawan', desc: 'Kelola data staf dan kontrak', href: '/dashboard/hr/staff', icon: Users, color: 'bg-blue-50 text-blue-600' },
    { title: 'Absensi & Shift', desc: 'Rekap kehadiran & jam kerja', href: '/dashboard/hr/attendance', icon: CalendarClock, color: 'bg-green-50 text-green-600' },
    { title: 'Cuti & Izin', desc: 'Pengajuan cuti dan sakit', href: '/dashboard/hr/leave', icon: CalendarHeart, color: 'bg-purple-50 text-purple-600' },
    { title: 'Rekrutmen', desc: 'Onboarding pegawai baru', href: '/dashboard/hr/recruitment', icon: Briefcase, color: 'bg-orange-50 text-orange-600' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-suka-ink">Ringkasan HR</h1>
        <p className="text-sm text-suka-gray-500">Overview sistem manajemen sumber daya manusia.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Link key={card.href} href={card.href} className="block group">
            <div className="bg-white rounded-xl border border-suka-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow h-full">
              <div className={`w-12 h-12 rounded-lg ${card.color} flex items-center justify-center mb-4 group-hover:scale-105 transition-transform`}>
                <card.icon size={24} />
              </div>
              <h3 className="font-semibold text-suka-ink mb-1">{card.title}</h3>
              <p className="text-sm text-suka-gray-500">{card.desc}</p>
            </div>
          </Link>
        ))}
      </div>
      
      <div className="bg-white rounded-xl border border-suka-gray-200 p-6">
        <h3 className="font-semibold text-suka-ink mb-4">Aktivitas Terkini</h3>
        <div className="text-sm text-gray-500 italic">Belum ada data (tahap placeholder)</div>
      </div>
    </div>
  )
}
