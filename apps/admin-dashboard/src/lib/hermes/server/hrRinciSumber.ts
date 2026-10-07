// Loader data HR rinci (kasbon & gaji per orang) — hanya untuk kunci ber-scope 'hr_rinci'.
// Tidak pernah membaca/mengembalikan: alasan kasbon, catatan bebas gaji, rekening, kontak.
import type { SupabaseClient } from '@supabase/supabase-js'
import { isTestOrDevStaff, tanggalWib } from '@suka/hr-rumus'
import type { GajiRinci, KasbonRinci, KonteksHrRinci, StatusKasbon } from '../absensi/tipe'

const HALAMAN = 1000
const STAF_SELECT = 'name, username, role, account_category, outlet_id, outlets!outlet_staff_outlet_id_fkey(id, name, slug)'

async function semuaHalaman<T>(build: () => any): Promise<T[]> {
  const hasil: T[] = []
  for (let dari = 0; ; dari += HALAMAN) {
    const { data, error } = await build().range(dari, dari + HALAMAN - 1)
    if (error) throw new Error(error.message)
    hasil.push(...((data ?? []) as T[]))
    if (!data || data.length < HALAMAN) return hasil
  }
}

const satu = <T>(x: T | T[] | null | undefined): T | undefined => (Array.isArray(x) ? x[0] : (x ?? undefined))
const angka = (x: unknown) => Number(x ?? 0) || 0

/** Sama dengan layar Kasbon HR (useCashAdvances). null = tak masuk kategori mana pun. */
export function statusKasbon(statusHr: string | null | undefined, status: string): StatusKasbon | null {
  const hr = statusHr ?? 'pending'
  if (status === 'paid_off') return 'lunas'
  if (hr === 'rejected') return 'ditolak'
  if (hr === 'pending') return 'menunggu'
  if (hr === 'approved' && status === 'active') return 'aktif'
  return null
}

export function buatKonteksHrRinci(svc: SupabaseClient, _sekarang: Date): KonteksHrRinci {
  async function kasbonDaftar(): Promise<KasbonRinci[]> {
    const data = await semuaHalaman<any>(() =>
      svc
        .from('cash_advances')
        .select(`id, staff_id, amount, remaining, installment_months, status, status_hr, created_at, outlet_staff!cash_advances_staff_id_fkey!inner(${STAF_SELECT})`)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false }),
    )
    const hasil: KasbonRinci[] = []
    for (const r of data) {
      const st = satu<any>(r.outlet_staff)
      if (!st || isTestOrDevStaff(st)) continue
      const status = statusKasbon(r.status_hr, r.status)
      if (!status) continue
      hasil.push({ id: r.id, nama: st.name ?? '-', outletId: st.outlet_id ?? null, nominal: angka(r.amount), sisa: angka(r.remaining ?? r.amount), cicilanBulan: r.installment_months ?? null, status, tanggal: tanggalWib(new Date(r.created_at)) })
    }
    return hasil
  }

  async function gajiDaftar(bulan: number, tahun: number): Promise<GajiRinci[]> {
    const data = await semuaHalaman<any>(() =>
      svc
        .from('payroll_records')
        .select(`id, basic_salary, allowance_meal, allowance_transport, allowance_communication, allowance_position, allowance_presence, bonus, sales_bonus, deductions, deduction_kasbon, deduction_bpjs, total_salary, status, outlet_staff!payroll_records_staff_id_fkey!inner(${STAF_SELECT})`)
        .eq('period_month', bulan)
        .eq('period_year', tahun)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false }),
    )
    const hasil: GajiRinci[] = []
    for (const r of data) {
      const st = satu<any>(r.outlet_staff)
      if (!st || isTestOrDevStaff(st)) continue
      hasil.push({
        nama: st.name ?? '-',
        outletId: st.outlet_id ?? null,
        gajiPokok: angka(r.basic_salary),
        tunjangan: angka(r.allowance_position) + angka(r.allowance_presence) + angka(r.allowance_meal) + angka(r.allowance_transport) + angka(r.allowance_communication),
        bonus: angka(r.bonus) + angka(r.sales_bonus),
        potongan: angka(r.deductions) + angka(r.deduction_kasbon) + angka(r.deduction_bpjs),
        total: angka(r.total_salary),
        status: r.status,
      })
    }
    return hasil
  }

  return { kasbonDaftar, gajiDaftar }
}
