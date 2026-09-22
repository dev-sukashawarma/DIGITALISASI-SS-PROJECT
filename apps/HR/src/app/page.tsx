'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import {
  Users,
  UserCheck,
  Clock,
  FileCheck,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  TrendingUp,
  DollarSign,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { useStaff } from '@/hooks/useStaff'
import { useAttendance } from '@/hooks/useAttendance'
import { useLeaveRequests } from '@/hooks/useLeaveRequests'
import { useCashAdvances } from '@/hooks/useCashAdvances'
import { useContracts } from '@/hooks/useContracts'
import { useHrActivity } from '@/hooks/useHrActivity'

export default function HrDashboardOverview() {
  const todayStr = new Date().toISOString().split('T')[0]

  const { data: staffList = [] } = useStaff()
  const { data: todayAttendance = [] } = useAttendance({
    dateFrom: todayStr,
    dateTo: todayStr,
    outletId: 'all',
    status: 'all',
  })
  const { data: leaveRequests = [] } = useLeaveRequests()
  const { data: kasbonList = [] } = useCashAdvances()
  const { data: contracts = [] } = useContracts('all')
  const { data: activities = [] } = useHrActivity()

  // KPI Calculations
  const totalActiveStaff = useMemo(
    () => staffList.filter((s) => s.status === 'active').length,
    [staffList]
  )

  const todayPresent = useMemo(
    () => todayAttendance.filter((a) => a.clock_in).length,
    [todayAttendance]
  )

  const todayLate = useMemo(
    () => todayAttendance.filter((a) => a.status === 'terlambat').length,
    [todayAttendance]
  )

  const pendingLeaves = useMemo(
    () => leaveRequests.filter((l) => l.status === 'pending').length,
    [leaveRequests]
  )

  const pendingKasbon = useMemo(
    () => kasbonList.filter((k) => k.status === 'pending').length,
    [kasbonList]
  )

  const totalPendingRequests = pendingLeaves + pendingKasbon

  const expiringContracts = useMemo(
    () => contracts.filter((c) => c.status === 'expiring_soon' || c.status === 'expired').length,
    [contracts]
  )

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Dashboard HR &amp; Personalia"
        description="Pusat komando manajemen SDM, presensi, penggajian, dan performa tim Suka Shawarma."
      >
        <div className="flex items-center gap-2">
          <Link
            href="/staff"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-stone-50 border border-suka-gray-200 text-suka-ink rounded-xl text-xs font-bold shadow-2xs transition-all"
          >
            <Users size={14} className="text-suka-orange" />
            <span>Kelola Staf</span>
          </Link>
          <Link
            href="/payroll"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-suka-orange hover:bg-suka-orange/90 text-white rounded-xl text-xs font-bold shadow-2xs transition-all"
          >
            <DollarSign size={14} />
            <span>Proses Payroll</span>
          </Link>
        </div>
      </PageHeader>

      {/* Top 4 KPI Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {/* Total Staf */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-suka-gray-200 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-orange-50 text-suka-orange flex items-center justify-center shrink-0 border border-orange-100">
            <Users size={22} />
          </div>
          <div>
            <p className="text-xs font-bold text-suka-gray-500 uppercase tracking-wider">Karyawan Aktif</p>
            <p className="text-2xl font-black text-suka-ink mt-0.5">{totalActiveStaff} Orang</p>
          </div>
        </div>

        {/* Kehadiran Hari Ini */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-suka-gray-200 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
            <UserCheck size={22} />
          </div>
          <div>
            <p className="text-xs font-bold text-suka-gray-500 uppercase tracking-wider">Presensi Hari Ini</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <p className="text-2xl font-black text-suka-ink">{todayPresent}</p>
              {todayLate > 0 && (
                <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200">
                  {todayLate} telat
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Pengajuan Pending (Cuti + Kasbon) */}
        <Link
          href="/perizinan/izin"
          className="bg-white p-4 sm:p-5 rounded-2xl border border-suka-gray-200 shadow-sm flex items-center gap-3.5 hover:border-suka-orange/50 hover:shadow-md transition-all group cursor-pointer"
        >
          <div className="w-11 h-11 rounded-xl bg-orange-50 text-suka-orange flex items-center justify-center shrink-0 border border-orange-100 group-hover:scale-105 transition-transform">
            <FileCheck size={22} />
          </div>
          <div>
            <p className="text-xs font-bold text-suka-gray-500 uppercase tracking-wider group-hover:text-suka-orange transition-colors">
              Pengajuan Pending
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <p className="text-2xl font-black text-suka-ink">{totalPendingRequests}</p>
              {totalPendingRequests > 0 && (
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200">
                  {pendingLeaves} izin / {pendingKasbon} kasbon
                </span>
              )}
            </div>
          </div>
        </Link>

        {/* Kontrak Habis / H-30 */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-suka-gray-200 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
            <AlertTriangle size={22} />
          </div>
          <div>
            <p className="text-xs font-bold text-suka-gray-500 uppercase tracking-wider">Kontrak Segera Habis</p>
            <p className="text-2xl font-black text-suka-ink mt-0.5">{expiringContracts} Staf</p>
          </div>
        </div>
      </div>

      {/* Main Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Shortcut Menu Cards + Live Presensi */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Access Menu Tiles */}
          <div className="bg-white p-5 rounded-2xl border border-suka-gray-200 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-suka-brown uppercase tracking-wider flex items-center gap-2">
              <Sparkles size={16} className="text-suka-orange" />
              <span>Modul Layanan HR Unggulan</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <Link
                href="/staff"
                className="p-4 rounded-xl border border-suka-brown/10 bg-[#FDF9F3] hover:bg-orange-50/60 hover:border-suka-orange/40 transition-all group cursor-pointer"
              >
                <div className="w-9 h-9 rounded-lg bg-orange-100 text-suka-orange flex items-center justify-center mb-2.5 font-bold group-hover:scale-105 transition-transform">
                  <Users size={18} />
                </div>
                <h4 className="font-extrabold text-suka-ink text-sm group-hover:text-suka-orange transition-colors">
                  Database Karyawan
                </h4>
                <p className="text-xs text-suka-gray-500 mt-0.5">
                  Profil, NIK KTP, gaji, dan riwayat kontak.
                </p>
              </Link>

              <Link
                href="/attendance"
                className="p-4 rounded-xl border border-suka-brown/10 bg-[#FDF9F3] hover:bg-orange-50/60 hover:border-suka-orange/40 transition-all group cursor-pointer"
              >
                <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mb-2.5 font-bold group-hover:scale-105 transition-transform">
                  <UserCheck size={18} />
                </div>
                <h4 className="font-extrabold text-suka-ink text-sm group-hover:text-suka-orange transition-colors">
                  Presensi &amp; Foto Selfie
                </h4>
                <p className="text-xs text-suka-gray-500 mt-0.5">
                  Audit foto selfie kamera dan GPS outlet.
                </p>
              </Link>

              <Link
                href="/perizinan/izin"
                className="p-4 rounded-xl border border-suka-brown/10 bg-[#FDF9F3] hover:bg-orange-50/60 hover:border-suka-orange/40 transition-all group cursor-pointer"
              >
                <div className="w-9 h-9 rounded-lg bg-orange-100 text-suka-orange flex items-center justify-center mb-2.5 font-bold group-hover:scale-105 transition-transform">
                  <FileCheck size={18} />
                </div>
                <h4 className="font-extrabold text-suka-ink text-sm group-hover:text-suka-orange transition-colors">
                  Perizinan &amp; Kasbon
                </h4>
                <p className="text-xs text-suka-gray-500 mt-0.5">
                  Approval cuti, izin sakit, dan pinjaman kasbon.
                </p>
              </Link>

              <Link
                href="/payroll"
                className="p-4 rounded-xl border border-suka-brown/10 bg-[#FDF9F3] hover:bg-orange-50/60 hover:border-suka-orange/40 transition-all group cursor-pointer"
              >
                <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center mb-2.5 font-bold group-hover:scale-105 transition-transform">
                  <DollarSign size={18} />
                </div>
                <h4 className="font-extrabold text-suka-ink text-sm group-hover:text-suka-orange transition-colors">
                  Payroll &amp; Slip Gaji
                </h4>
                <p className="text-xs text-suka-gray-500 mt-0.5">
                  Kalkulasi gaji, cetak slip A5, dan kirim via WA.
                </p>
              </Link>

              <Link
                href="/roster"
                className="p-4 rounded-xl border border-suka-brown/10 bg-[#FDF9F3] hover:bg-orange-50/60 hover:border-suka-orange/40 transition-all group cursor-pointer"
              >
                <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center mb-2.5 font-bold group-hover:scale-105 transition-transform">
                  <Clock size={18} />
                </div>
                <h4 className="font-extrabold text-suka-ink text-sm group-hover:text-suka-orange transition-colors">
                  Shift Roster
                </h4>
                <p className="text-xs text-suka-gray-500 mt-0.5">
                  Jadwal shift kerja tim outlet mingguan.
                </p>
              </Link>

              <Link
                href="/contracts"
                className="p-4 rounded-xl border border-suka-brown/10 bg-[#FDF9F3] hover:bg-orange-50/60 hover:border-suka-orange/40 transition-all group cursor-pointer"
              >
                <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center mb-2.5 font-bold group-hover:scale-105 transition-transform">
                  <FileCheck size={18} />
                </div>
                <h4 className="font-extrabold text-suka-ink text-sm group-hover:text-suka-orange transition-colors">
                  Masa Kontrak PKWT
                </h4>
                <p className="text-xs text-suka-gray-500 mt-0.5">
                  Monitoring H-30 dan perpanjangan kontrak.
                </p>
              </Link>

              <Link
                href="/performance"
                className="p-4 rounded-xl border border-suka-brown/10 bg-[#FDF9F3] hover:bg-orange-50/60 hover:border-suka-orange/40 transition-all group cursor-pointer"
              >
                <div className="w-9 h-9 rounded-lg bg-red-100 text-red-700 flex items-center justify-center mb-2.5 font-bold group-hover:scale-105 transition-transform">
                  <TrendingUp size={18} />
                </div>
                <h4 className="font-extrabold text-suka-ink text-sm group-hover:text-suka-orange transition-colors">
                  Evaluasi KPI &amp; Bonus
                </h4>
                <p className="text-xs text-suka-gray-500 mt-0.5">
                  Skor ketepatan waktu dan insentif crew.
                </p>
              </Link>
            </div>
          </div>

          {/* Today's Attendance Snapshot */}
          <div className="bg-white p-5 rounded-2xl border border-suka-gray-200 shadow-sm space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-extrabold text-suka-brown uppercase tracking-wider">
                  Presensi Masuk Hari Ini ({todayStr})
                </h3>
                <p className="text-xs text-suka-gray-500">Log kehadiran karyawan shift aktif hari ini.</p>
              </div>
              <Link
                href="/attendance"
                className="text-xs font-bold text-suka-orange hover:underline flex items-center gap-1"
              >
                <span>Lihat Semua</span>
                <ArrowRight size={13} />
              </Link>
            </div>

            <div className="divide-y divide-suka-gray-100">
              {todayAttendance.slice(0, 5).map((a) => (
                <div key={a.id} className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-orange-100 text-suka-orange flex items-center justify-center font-black text-xs">
                      {a.outlet_staff?.name?.charAt(0) || 'S'}
                    </div>
                    <div>
                      <p className="font-bold text-suka-ink text-xs">{a.outlet_staff?.name || 'Staff'}</p>
                      <p className="text-[11px] text-suka-gray-500">
                        {a.outlets?.name || 'Pusat'} &bull; {a.outlet_staff?.role}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        a.status === 'hadir'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {a.status === 'hadir' ? 'Tepat Waktu' : `Telat (${a.late_minutes}m)`}
                    </span>
                    <p className="text-[11px] font-mono text-suka-gray-500 mt-0.5">
                      {a.clock_in ? new Date(a.clock_in).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                    </p>
                  </div>
                </div>
              ))}

              {todayAttendance.length === 0 && (
                <p className="py-6 text-center text-xs text-suka-gray-400">
                  Belum ada presensi yang tercatat untuk hari ini.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Live Activity Feed + Pending Approvals */}
        <div className="space-y-6">
          {/* Pending Approvals Alert Box */}
          {totalPendingRequests > 0 && (
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-4.5 space-y-2.5 shadow-xs">
              <div className="flex items-center gap-2 text-amber-900 font-extrabold text-sm">
                <AlertCircleIcon className="w-5 h-5 text-amber-600" />
                <span>Persetujuan Menunggu HR</span>
              </div>
              <p className="text-xs text-amber-800 font-medium leading-relaxed">
                Terdapat <strong>{pendingLeaves} cuti/izin</strong> dan <strong>{pendingKasbon} pinjaman kasbon</strong> yang memerlukan persetujuan Admin HR.
              </p>
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                {pendingLeaves > 0 && (
                  <Link
                    href="/perizinan?tab=izin"
                    className="inline-flex items-center gap-1.5 text-xs font-black text-amber-900 bg-amber-200/80 hover:bg-amber-200 px-3 py-1.5 rounded-xl transition-all"
                  >
                    <span>Cuti/Izin ({pendingLeaves})</span>
                    <ArrowRight size={13} />
                  </Link>
                )}
                {pendingKasbon > 0 && (
                  <Link
                    href="/perizinan?tab=kasbon"
                    className="inline-flex items-center gap-1.5 text-xs font-black text-amber-900 bg-amber-200/80 hover:bg-amber-200 px-3 py-1.5 rounded-xl transition-all"
                  >
                    <span>Kasbon ({pendingKasbon})</span>
                    <ArrowRight size={13} />
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Activity Feed */}
          <div className="bg-white p-5 rounded-2xl border border-suka-gray-200 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-suka-brown uppercase tracking-wider">
              Aktivitas HR Terbaru
            </h3>

            <div className="space-y-3">
              {activities.map((act) => {
                const href =
                  act.type === 'leave'
                    ? '/perizinan?tab=izin'
                    : act.type === 'cash_advance'
                    ? '/perizinan?tab=kasbon'
                    : '/attendance'

                return (
                  <Link
                    key={act.id}
                    href={href}
                    className="flex gap-3 text-xs pb-3 border-b border-suka-gray-100 last:border-0 last:pb-0 hover:bg-orange-50/40 p-1.5 -mx-1.5 rounded-xl transition-all group"
                  >
                    <div className="w-2 h-2 rounded-full bg-suka-orange mt-1.5 shrink-0 group-hover:scale-125 transition-transform" />
                    <div className="flex-1">
                      <p className="font-bold text-suka-ink group-hover:text-suka-orange transition-colors">{act.title}</p>
                      <p className="text-suka-gray-500 mt-0.5">{act.description}</p>
                      <span className="text-[10px] font-mono text-suka-gray-400 mt-1 block">
                        {new Date(act.timestamp).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    </div>
                  </Link>
                )
              })}

              {activities.length === 0 && (
                <p className="py-6 text-center text-xs text-suka-gray-400">
                  Belum ada log aktivitas.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function AlertCircleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}
