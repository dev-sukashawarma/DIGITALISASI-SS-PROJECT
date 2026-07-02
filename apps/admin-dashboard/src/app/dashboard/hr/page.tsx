'use client'
import { Users, CalendarClock, CalendarHeart, Banknote, Clock, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { Spinner } from '@suka/design-system'
import { useHrActivity } from '@/hooks/useHrActivity'

export default function HRDashboard() {
  const cards = [
    { title: 'Database Karyawan', desc: 'Kelola data staf dan kontrak', href: '/dashboard/hr/staff', icon: Users, color: 'bg-blue-50 text-blue-600' },
    { title: 'Absensi & Shift', desc: 'Rekap kehadiran & jam kerja', href: '/dashboard/hr/attendance', icon: CalendarClock, color: 'bg-green-50 text-green-600' },
    { title: 'Cuti & Izin', desc: 'Pengajuan cuti dan sakit', href: '/dashboard/hr/leave', icon: CalendarHeart, color: 'bg-purple-50 text-purple-600' },
    { title: 'Payroll & Kasbon', desc: 'Slip gaji & pinjaman karyawan', href: '/dashboard/hr/payroll', icon: Banknote, color: 'bg-orange-50 text-orange-600' },
  ]

  const { data: activities, isLoading } = useHrActivity()

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
        <h3 className="font-semibold text-suka-ink mb-4 flex items-center gap-2">
          <Clock size={18} /> Aktivitas Terkini
        </h3>
        
        {isLoading ? (
          <div className="flex justify-center p-6"><Spinner /></div>
        ) : activities && activities.length > 0 ? (
          <div className="space-y-4">
            {activities.map((act) => (
              <div key={act.id} className="flex gap-4 items-start border-b border-suka-gray-50 pb-4 last:border-0 last:pb-0">
                <div className="mt-1">
                  {act.type === 'attendance' && <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center"><CalendarClock size={16} /></div>}
                  {act.type === 'leave' && <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center"><CalendarHeart size={16} /></div>}
                  {act.type === 'cash_advance' && <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center"><Banknote size={16} /></div>}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm text-suka-ink">{act.title}</p>
                  <p className="text-sm text-suka-gray-600">{act.description}</p>
                  <p className="text-xs text-suka-gray-400 mt-1">
                    {new Date(act.timestamp).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </div>
                {act.status && (
                  <div>
                    <span className={`px-2 py-1 text-[10px] font-bold rounded-md uppercase tracking-wider
                      ${act.status === 'hadir' || act.status === 'approved' || act.status === 'paid_off' ? 'bg-emerald-100 text-emerald-700' : ''}
                      ${act.status === 'pending' || act.status === 'terlambat' || act.status === 'active' ? 'bg-amber-100 text-amber-700' : ''}
                      ${act.status === 'rejected' || act.status === 'alfa' ? 'bg-red-100 text-red-700' : ''}
                      ${act.status === 'sakit' || act.status === 'izin' || act.status === 'cuti' ? 'bg-blue-100 text-blue-700' : ''}
                      ${!['hadir','approved','paid_off','pending','terlambat','active','rejected','alfa','sakit','izin','cuti'].includes(act.status) ? 'bg-gray-100 text-gray-700' : ''}
                    `}>
                      {act.status}
                    </span>
                  </div>
                )}
              </div>
            ))}
            <Link href="/dashboard/hr/staff" className="flex items-center justify-center gap-1 mt-2 text-sm font-semibold text-suka-orange hover:underline">
              Lihat Detail Semua Karyawan <ArrowRight size={14} />
            </Link>
          </div>
        ) : (
          <div className="text-sm text-gray-500 italic p-4 text-center bg-suka-gray-50 rounded-xl">Belum ada aktivitas HR sejauh ini.</div>
        )}
      </div>
    </div>
  )
}
