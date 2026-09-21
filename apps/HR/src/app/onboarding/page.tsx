'use client'

import { useState, useMemo } from 'react'
import {
  GraduationCap,
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  Receipt,
  FileCheck,
  Lock,
  Search,
  Store,
} from 'lucide-react'
import { Button, Spinner } from '@suka/design-system'
import { PageHeader } from '@/components/ui/PageHeader'
import { useOnboarding, type TraineeRecord } from '@/hooks/useOnboarding'
import { useOutlets } from '@/hooks/useOutlets'
import { PettyCashVoucherModal } from '@/components/modules/PettyCashVoucherModal'
import { CrewEvaluationModal } from '@/components/modules/CrewEvaluationModal'
import { formatRupiah, formatDate } from '@/lib/format'
import { ONBOARDING_STAGE_LABELS, type OnboardingStage } from '@/lib/types'
import { toast } from 'sonner'

export default function OnboardingPage() {
  const [selectedOutlet, setSelectedOutlet] = useState<string>('all')
  const [selectedStage, setSelectedStage] = useState<string>('all')
  const [selectedSubRole, setSelectedSubRole] = useState<string>('all')
  const [search, setSearch] = useState<string>('')

  // Modals state
  const [voucherTrainee, setVoucherTrainee] = useState<TraineeRecord | null>(null)
  const [evalTrainee, setEvalTrainee] = useState<TraineeRecord | null>(null)

  const { data: outlets = [] } = useOutlets()
  const { data: trainees = [], isLoading, saveEvaluation, updateStage } = useOnboarding({
    outletId: selectedOutlet,
    stage: selectedStage,
    subRole: selectedSubRole,
  })

  // Filter trainees by search query
  const filteredTrainees = useMemo(() => {
    if (!search.trim()) return trainees
    const q = search.toLowerCase()
    return trainees.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.username && t.username.toLowerCase().includes(q)) ||
        t.outlet_name.toLowerCase().includes(q)
    )
  }, [trainees, search])

  // Aggregate metrics
  const metrics = useMemo(() => {
    const total = trainees.length
    const training7Days = trainees.filter((t) => t.onboarding_stage === 'training_7_days').length
    const ojt = trainees.filter((t) => t.onboarding_stage === 'ojt').length
    const evalReady = trainees.filter(
      (t) => t.is_evaluation_ready && t.onboarding_stage !== 'graduated' && t.onboarding_stage !== 'failed'
    ).length
    const totalPettyCash = trainees
      .filter((t) => t.onboarding_stage === 'training_7_days')
      .reduce((acc, t) => acc + t.training_meal_allowance, 0)

    return { total, training7Days, ojt, evalReady, totalPettyCash }
  }, [trainees])

  const handleStageChange = async (staffId: string, nextStage: OnboardingStage) => {
    try {
      const res = await updateStage.mutateAsync({ staff_id: staffId, stage: nextStage })
      if (!res.ok) throw new Error(res.error)
      toast.success(`Tahapan onboarding berhasil diperbarui menjadi ${ONBOARDING_STAGE_LABELS[nextStage] || nextStage}`)
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengubah tahapan onboarding')
    }
  }

  const handleSaveEvaluation = async (data: {
    staff_id: string
    day_count_at_eval: number
    decision: 'pass_pkwt' | 'extend_ojt' | 'failed'
    scores: {
      technical: number
      sop: number
      hygiene: number
      attendance: number
      attitude: number
    }
    notes: string
  }) => {
    const res = await saveEvaluation.mutateAsync({
      staff_id: data.staff_id,
      day_count_at_eval: data.day_count_at_eval,
      decision: data.decision,
      scores: data.scores,
      notes: data.notes,
    })
    if (!res.ok) {
      throw new Error(res.error || 'Gagal menyimpan evaluasi')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={GraduationCap}
        title="Onboarding & Training Kru Baru"
        description="Pantau siklus 2 tahap kru: Training 7 hari (uang makan kas kecil Rp 15.000/hari) & On Job Training (OJT 1-3 bulan dengan evaluasi kelayakan AM di hari ke-15+)."
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-suka-gray-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
              Training (7 Hari)
            </span>
            <div className="rounded-xl bg-orange-100 p-2 text-suka-orange">
              <Clock size={18} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-suka-ink font-mono">{metrics.training7Days}</span>
            <span className="text-xs text-stone-500 font-medium">Kru Tahap 1</span>
          </div>
          <p className="mt-1 text-[11px] text-stone-400">
            Kompensasi: Uang makan Rp 15.000 / hari riil
          </p>
        </div>

        <div className="rounded-2xl border border-suka-gray-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
              On Job Training (OJT)
            </span>
            <div className="rounded-xl bg-blue-100 p-2 text-blue-600">
              <Users size={18} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-suka-ink font-mono">{metrics.ojt}</span>
            <span className="text-xs text-stone-500 font-medium">Kru Tahap 2</span>
          </div>
          <p className="mt-1 text-[11px] text-stone-400">
            Durasi 1 - 3 Bulan di outlet penugasan
          </p>
        </div>

        <div className="rounded-2xl border border-suka-gray-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
              Siap Evaluasi AM (Hari &ge; 15)
            </span>
            <div className="rounded-xl bg-emerald-100 p-2 text-emerald-600">
              <FileCheck size={18} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-700 font-mono">{metrics.evalReady}</span>
            <span className="text-xs text-stone-500 font-medium">Siap dinilai</span>
          </div>
          <p className="mt-1 text-[11px] text-stone-400">
            Form kelayakan terbuka setelah hari ke-15
          </p>
        </div>

        <div className="rounded-2xl border border-suka-gray-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
              Total Uang Makan Kas Kecil
            </span>
            <div className="rounded-xl bg-amber-100 p-2 text-amber-700">
              <Receipt size={18} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-black text-amber-900 font-mono">
              {formatRupiah(metrics.totalPettyCash)}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-stone-400">
            Dicairkan via Petty Cash masing-masing outlet
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-suka-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          {/* Search Input */}
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={15} />
            <input
              type="text"
              placeholder="Cari nama kru atau outlet..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-suka-gray-200 text-xs font-semibold focus:border-suka-orange focus:ring-1 focus:ring-suka-orange outline-none bg-stone-50/50"
            />
          </div>

          {/* Outlet Filter */}
          <select
            value={selectedOutlet}
            onChange={(e) => setSelectedOutlet(e.target.value)}
            className="rounded-xl border border-suka-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-suka-brown outline-none focus:border-suka-orange"
          >
            <option value="all">Semua Outlet</option>
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>

          {/* Sub Role Filter */}
          <select
            value={selectedSubRole}
            onChange={(e) => setSelectedSubRole(e.target.value)}
            className="rounded-xl border border-suka-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-suka-brown outline-none focus:border-suka-orange"
          >
            <option value="all">Semua Sub-Role</option>
            <option value="crew_regular">Crew Reguler</option>
            <option value="crew_backup">Crew Backup</option>
          </select>

          {/* Stage Filter */}
          <select
            value={selectedStage}
            onChange={(e) => setSelectedStage(e.target.value)}
            className="rounded-xl border border-suka-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-suka-brown outline-none focus:border-suka-orange"
          >
            <option value="all">Semua Tahapan</option>
            <option value="training_7_days">Training 7 Hari</option>
            <option value="ojt">On Job Training (OJT)</option>
            <option value="graduated">Lulus PKWT</option>
            <option value="regular">Karyawan Reguler</option>
            <option value="failed">Gugur / Tidak Lolos</option>
          </select>
        </div>

        <span className="text-xs font-semibold text-stone-500">
          Menampilkan <strong>{filteredTrainees.length}</strong> kru
        </span>
      </div>

      {/* Trainees Data Table */}
      {isLoading ? (
        <div className="flex justify-center p-12 bg-white rounded-2xl border border-suka-gray-200">
          <Spinner />
        </div>
      ) : filteredTrainees.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-suka-gray-200 p-6">
          <GraduationCap className="mx-auto text-stone-300 mb-2" size={40} />
          <h3 className="text-sm font-bold text-stone-700">Tidak ada data kru onboarding</h3>
          <p className="text-xs text-stone-400 mt-1 max-w-sm mx-auto">
            Belum ada kru yang cocok dengan filter yang dipilih, atau tambahkan kru baru melalui menu Database Karyawan.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-suka-gray-200 bg-white shadow-xs">
          <table className="w-full text-left text-xs text-stone-700">
            <thead className="bg-stone-50 border-b border-suka-gray-200 text-stone-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Nama Kru &amp; Sub-Role</th>
                <th className="py-3 px-4">Outlet Home</th>
                <th className="py-3 px-4">Progress Masa Kerja</th>
                <th className="py-3 px-4">Tahap Onboarding</th>
                <th className="py-3 px-4">Kas Kecil 7 Hari</th>
                <th className="py-3 px-4">Form Kelayakan AM</th>
                <th className="py-3 px-4 text-center">Aksi Tahap</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-suka-gray-100">
              {filteredTrainees.map((trainee) => {
                const isTraining = trainee.onboarding_stage === 'training_7_days'
                const isOjt = trainee.onboarding_stage === 'ojt'
                const isGraduated = trainee.onboarding_stage === 'graduated'
                const isFailed = trainee.onboarding_stage === 'failed'

                // Day progress visualization
                const progressPct = isTraining
                  ? Math.min(100, Math.round((trainee.day_count / 7) * 100))
                  : Math.min(100, Math.round((trainee.day_count / 90) * 100))

                return (
                  <tr key={trainee.id} className="hover:bg-stone-50/60 transition-colors">
                    {/* Name & Sub-Role */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-suka-ink">{trainee.name}</div>
                      <div className="flex items-center gap-1.5 mt-1">
                        {trainee.sub_role === 'crew_backup' ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-purple-100 px-1.5 py-0.5 text-[10px] font-extrabold text-purple-800">
                            Crew Backup ({trainee.outlet_ids?.length || 0} floating)
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-extrabold text-emerald-800">
                            Crew Reguler
                          </span>
                        )}
                        {trainee.phone && (
                          <span className="text-[10px] text-stone-400 font-mono">&bull; {trainee.phone}</span>
                        )}
                      </div>
                    </td>

                    {/* Outlet */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-stone-800 flex items-center gap-1">
                        <Store size={13} className="text-stone-400" />
                        {trainee.outlet_name}
                      </div>
                    </td>

                    {/* Progress Masa Kerja */}
                    <td className="py-3 px-4 min-w-[170px]">
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-extrabold text-suka-brown">
                          Hari ke-{trainee.day_count}
                          {isTraining ? ' / 7' : isOjt ? ' (OJT)' : ''}
                        </span>
                        <span className="text-[10px] text-stone-400 font-mono">
                          Mulai: {formatDate(trainee.training_start_date || trainee.join_date)}
                        </span>
                      </div>
                      <div className="w-full bg-stone-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            isTraining
                              ? 'bg-suka-orange'
                              : trainee.is_evaluation_ready
                              ? 'bg-emerald-500'
                              : 'bg-blue-500'
                          }`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </td>

                    {/* Tahap Onboarding */}
                    <td className="py-3 px-4">
                      {isTraining && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-[11px] font-bold text-orange-800">
                          <Clock size={12} /> Training 7 Hari
                        </span>
                      )}
                      {isOjt && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-bold text-blue-800">
                          <Users size={12} /> Masa OJT
                        </span>
                      )}
                      {isGraduated && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                          <CheckCircle2 size={12} /> Lulus PKWT
                        </span>
                      )}
                      {isFailed && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-bold text-rose-800">
                          <AlertCircle size={12} /> Tidak Lolos
                        </span>
                      )}
                      {trainee.onboarding_stage === 'regular' && (
                        <span className="inline-flex items-center rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-bold text-stone-700">
                          Reguler
                        </span>
                      )}
                    </td>

                    {/* Petty Cash 7 Hari */}
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-1">
                        <div className="text-[11px]">
                          <span className="font-bold text-stone-800">
                            {formatRupiah(trainee.training_meal_allowance)}
                          </span>
                          <span className="text-[10px] text-stone-400 block">
                            ({trainee.training_attendance_days} hari hadir &times; Rp 15rb)
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setVoucherTrainee(trainee)}
                          className="h-6 text-[10px] font-bold px-2 rounded-lg border border-amber-300 bg-amber-50/60 hover:bg-amber-100 text-amber-900 gap-1 w-fit cursor-pointer"
                        >
                          <Receipt size={11} className="text-amber-700" /> Voucher Petty Cash
                        </Button>
                      </div>
                    </td>

                    {/* Form Kelayakan AM */}
                    <td className="py-3 px-4">
                      {trainee.day_count < 15 ? (
                        <div className="flex items-center gap-1.5 text-stone-400 text-[11px] font-semibold">
                          <Lock size={13} className="text-stone-400 shrink-0" />
                          <span>Terkunci (sisa {trainee.days_until_evaluation} hari)</span>
                        </div>
                      ) : trainee.latest_evaluation ? (
                        <button
                          type="button"
                          onClick={() => setEvalTrainee(trainee)}
                          className="cursor-pointer text-left group"
                        >
                          <span
                            className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-bold ${
                              trainee.latest_evaluation.decision === 'pass_pkwt'
                                ? 'bg-emerald-100 text-emerald-800'
                                : trainee.latest_evaluation.decision === 'extend_ojt'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            <FileCheck size={12} />
                            {trainee.latest_evaluation.decision === 'pass_pkwt'
                              ? 'Lulus PKWT'
                              : trainee.latest_evaluation.decision === 'extend_ojt'
                              ? 'Perpanjang OJT'
                              : 'Tidak Lolos'}
                          </span>
                          <span className="block text-[10px] text-stone-400 mt-0.5 group-hover:underline">
                            Lihat / Edit Form Evaluasi
                          </span>
                        </button>
                      ) : (
                        <Button
                          type="button"
                          onClick={() => setEvalTrainee(trainee)}
                          className="h-7 text-[11px] font-bold px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white gap-1 shadow-xs cursor-pointer"
                        >
                          <FileCheck size={12} /> Isi Form Kelayakan
                        </Button>
                      )}
                    </td>

                    {/* Quick Stage Actions */}
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {isTraining && (
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => handleStageChange(trainee.id, 'ojt')}
                            title="Lanjut ke Masa OJT (Tahap 2)"
                            className="h-7 text-[10px] font-bold px-2 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 cursor-pointer"
                          >
                            Naik ke OJT &rarr;
                          </Button>
                        )}
                        {isOjt && (
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => handleStageChange(trainee.id, 'graduated')}
                            title="Luluskan menjadi Crew Kontrak (PKWT)"
                            className="h-7 text-[10px] font-bold px-2 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                          >
                            Lulus PKWT
                          </Button>
                        )}
                        {(isGraduated || trainee.onboarding_stage === 'regular') && (
                          <span className="text-[10px] font-bold text-stone-400">Selesai</span>
                        )}
                        {isFailed && (
                          <span className="text-[10px] font-bold text-rose-500">Gugur</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Petty Cash Voucher Modal */}
      {voucherTrainee && (
        <PettyCashVoucherModal
          trainee={voucherTrainee}
          onClose={() => setVoucherTrainee(null)}
        />
      )}

      {/* Crew Evaluation Modal */}
      {evalTrainee && (
        <CrewEvaluationModal
          trainee={evalTrainee}
          onClose={() => setEvalTrainee(null)}
          onSubmit={handleSaveEvaluation}
          submitting={saveEvaluation.isPending}
        />
      )}
    </div>
  )
}
