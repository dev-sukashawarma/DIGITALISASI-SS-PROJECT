'use client'

import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button, CurrencyInput } from '@suka/design-system'
import { OutletMultiSelect } from './OutletMultiSelect'
import type { Outlet, StaffFormValues, Role } from '@/lib/types'
import { generateTempPassword } from '@/lib/generatePassword'

const ROLES: Role[] = [
  'admin',
  'admin_hr',
  'owner',
  'spv',
  'regional_manager',
  'kitchen',
  'leader',
  'crew',
  'mitra',
  'staff_pusat',
  'admin_finance',
  'area_manager',
  'purchasing',
]

const getStaffFormSchema = (isEditing: boolean) =>
  z.object({
    name: z.string().min(1, 'Nama Lengkap wajib diisi'),
    username: isEditing
      ? z.string().optional().or(z.literal(''))
      : z
          .string()
          .min(1, 'Username wajib diisi')
          .regex(/^[a-z0-9_]*$/, 'Username hanya boleh huruf kecil, angka, dan underscore'),
    password: isEditing ? z.string().optional() : z.string().min(1, 'Password Sementara wajib diisi'),
    role: z.enum([
      'admin',
      'admin_hr',
      'owner',
      'spv',
      'regional_manager',
      'kitchen',
      'leader',
      'crew',
      'kiosk',
      'mitra',
      'staff_pusat',
      'admin_finance',
      'area_manager',
      'purchasing',
    ]),
    outlet_id: z.string().min(1, 'Outlet Home wajib diisi'),
    outlet_ids: z.array(z.string()).default([]),
    is_bonus_eligible: z.boolean().default(true).optional(),
    nip: z.string().nullable().optional(),
    contract_type: z.enum(['permanent', 'contract', 'intern', 'daily']).nullable().optional(),
    join_date: z.string().nullable().optional(),
    resign_date: z.string().nullable().optional(),
    leave_quota: z.coerce.number().nullable().optional(),

    nik: z
      .string()
      .refine((val) => !val || val.length === 16, 'NIK harus tepat 16 digit angka!')
      .nullable()
      .optional(),
    email: z.string().email('Email tidak valid').or(z.literal('')).nullable().optional(),
    phone: z.string().nullable().optional(),
    address_ktp: z.string().nullable().optional(),
    address_domicile: z.string().nullable().optional(),
    birth_place: z.string().nullable().optional(),
    birth_date: z.string().nullable().optional(),
    gender: z.enum(['male', 'female', '']).nullable().optional(),
    religion: z.string().nullable().optional(),

    emergency_name: z.string().nullable().optional(),
    emergency_relationship: z.string().nullable().optional(),
    emergency_phone: z.string().nullable().optional(),

    basic_salary: z.coerce.number().nullable().optional(),
    allowance_position: z.coerce.number().nullable().optional(),
    allowance_presence: z.coerce.number().nullable().optional(),
    bank_name: z.string().nullable().optional(),
    bank_account_number: z.string().nullable().optional(),
    bank_account_name: z.string().nullable().optional(),
    npwp: z.string().nullable().optional(),
    bpjs_ketenagakerjaan: z.string().nullable().optional(),
    bpjs_kesehatan: z.string().nullable().optional(),
  })

type FormData = z.infer<ReturnType<typeof getStaffFormSchema>>

const stepFields: Record<string, (keyof FormData)[]> = {
  utama: ['name', 'username', 'password', 'role', 'outlet_id', 'outlet_ids', 'is_bonus_eligible', 'nip', 'contract_type', 'join_date', 'resign_date', 'leave_quota'],
  pribadi: ['nik', 'email', 'phone', 'address_ktp', 'address_domicile', 'birth_place', 'birth_date', 'gender', 'religion'],
  darurat: ['emergency_name', 'emergency_relationship', 'emergency_phone'],
  keuangan: ['basic_salary', 'allowance_position', 'allowance_presence', 'bank_name', 'bank_account_number', 'bank_account_name', 'npwp', 'bpjs_ketenagakerjaan', 'bpjs_kesehatan'],
}

export function StaffForm({
  outlets,
  onSubmit,
  submitting,
  initial,
}: {
  outlets: Outlet[]
  onSubmit: (values: StaffFormValues) => void
  submitting: boolean
  initial?: Partial<StaffFormValues>
}) {
  const isEditing = !!initial?.name
  const schema = getStaffFormSchema(isEditing)

  const { register, handleSubmit: formHandleSubmit, trigger, control, watch, formState: { errors } } = useForm<any>({
    resolver: zodResolver(schema as any) as any,
    defaultValues: {
      name: initial?.name ?? '',
      username: initial?.username ?? '',
      password: initial?.password ?? (isEditing ? '' : generateTempPassword()),
      role: initial?.role ?? 'crew',
      outlet_id: initial?.outlet_id ?? (outlets[0]?.id ?? ''),
      outlet_ids: initial?.outlet_ids ?? [],
      is_bonus_eligible: initial?.is_bonus_eligible ?? true,
      nip: initial?.nip ?? '',
      contract_type: initial?.contract_type ?? 'contract',
      join_date: initial?.join_date ?? '',
      resign_date: initial?.resign_date ?? '',
      leave_quota: initial?.leave_quota ?? 12,
      nik: initial?.nik ?? '',
      email: initial?.email ?? '',
      phone: initial?.phone ?? '',
      address_ktp: initial?.address_ktp ?? '',
      address_domicile: initial?.address_domicile ?? '',
      birth_place: initial?.birth_place ?? '',
      birth_date: initial?.birth_date ?? '',
      gender: (initial?.gender ?? '') as any,
      religion: initial?.religion ?? '',
      emergency_name: initial?.emergency_name ?? '',
      emergency_relationship: initial?.emergency_relationship ?? '',
      emergency_phone: initial?.emergency_phone ?? '',
      basic_salary: initial?.basic_salary ?? 0,
      allowance_position: initial?.allowance_position ?? 0,
      allowance_presence: initial?.allowance_presence ?? 0,
      bank_name: initial?.bank_name ?? '',
      bank_account_number: initial?.bank_account_number ?? '',
      bank_account_name: initial?.bank_account_name ?? '',
      npwp: initial?.npwp ?? '',
      bpjs_ketenagakerjaan: initial?.bpjs_ketenagakerjaan ?? '',
      bpjs_kesehatan: initial?.bpjs_kesehatan ?? '',
    },
    mode: 'onChange',
  })

  const watchRole = watch('role')
  const [activeTab, setActiveTab] = useState<'utama' | 'pribadi' | 'darurat' | 'keuangan'>('utama')

  const inputCls =
    'w-full rounded-xl border border-suka-gray-200 px-3 py-2.5 outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange transition-all bg-white text-suka-ink text-sm'
  const labelCls = 'mb-1 block text-xs font-bold text-suka-brown'

  const tabs = [
    { id: 'utama', label: '1. Informasi Utama' },
    { id: 'pribadi', label: '2. Data Pribadi' },
    { id: 'darurat', label: '3. Kontak Darurat' },
    { id: 'keuangan', label: '4. Keuangan & Payroll' },
  ] as const

  const currentIndex = tabs.findIndex((t) => t.id === activeTab)
  const isLastStep = currentIndex === tabs.length - 1
  const isFirstStep = currentIndex === 0

  async function validateStep(stepId: string): Promise<boolean> {
    const fields = stepFields[stepId]
    return await trigger(fields as any)
  }

  async function validateThrough(targetIndex: number): Promise<boolean> {
    for (let i = 0; i <= targetIndex; i++) {
      const stepId = tabs[i].id
      const fields = stepFields[stepId]
      const isValid = await trigger(fields as any)
      if (!isValid) {
        setActiveTab(stepId as any)
        return false
      }
    }
    return true
  }

  async function handleNext() {
    if (await validateStep(activeTab)) {
      if (!isLastStep) setActiveTab(tabs[currentIndex + 1].id as any)
    }
  }

  function handlePrev() {
    if (!isFirstStep) setActiveTab(tabs[currentIndex - 1].id as any)
  }

  const onSubmitForm = async (rawData: any) => {
    const data = rawData as FormData
    if (!(await validateThrough(tabs.length - 1))) return

    const payload: StaffFormValues = {
      name: data.name,
      username: data.username || '',
      role: data.role,
      outlet_id: data.outlet_id,
      outlet_ids: data.role === 'leader' || data.role === 'area_manager' ? data.outlet_ids : [],
      is_bonus_eligible: data.is_bonus_eligible !== undefined ? data.is_bonus_eligible : true,
      nik: data.nik || null,
      email: data.email || null,
      phone: data.phone || null,
      address_ktp: data.address_ktp || null,
      address_domicile: data.address_domicile || null,
      birth_place: data.birth_place || null,
      birth_date: data.birth_date || null,
      gender: data.gender || null,
      religion: data.religion || null,
      emergency_name: data.emergency_name || null,
      emergency_relationship: data.emergency_relationship || null,
      emergency_phone: data.emergency_phone || null,
      nip: data.nip || null,
      contract_type: data.contract_type || null,
      join_date: data.join_date || null,
      resign_date: data.resign_date || null,
      leave_quota: data.leave_quota || 0,
      basic_salary: data.basic_salary || 0,
      allowance_position: data.allowance_position || 0,
      allowance_presence: data.allowance_presence || 0,
      bank_name: data.bank_name || undefined,
      bank_account_number: data.bank_account_number || undefined,
      bank_account_name: data.bank_account_name || undefined,
      npwp: data.npwp || null,
      bpjs_ketenagakerjaan: data.bpjs_ketenagakerjaan || null,
      bpjs_kesehatan: data.bpjs_kesehatan || null,
    }

    if (!isEditing && data.password) {
      payload.password = data.password
    }

    onSubmit(payload)
  }

  return (
    <form onSubmit={formHandleSubmit(onSubmitForm)} className="space-y-6">
      {/* Stepper Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-suka-gray-200 pb-3">
        {tabs.map((tab, idx) => (
          <button
            key={tab.id}
            type="button"
            onClick={async () => {
              if (idx < currentIndex) setActiveTab(tab.id as any)
              else if (idx > currentIndex) {
                if (await validateThrough(idx - 1)) setActiveTab(tab.id as any)
              }
            }}
            className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === tab.id
                ? 'bg-suka-brown text-white shadow-md'
                : idx < currentIndex
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-suka-cream text-suka-brown hover:bg-suka-orange hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-[#FDF9F3] rounded-2xl p-4 sm:p-6 border border-suka-brown/10">
        {activeTab === 'utama' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="sf-name" className={labelCls}>
                Nama Lengkap <span className="text-red-500">*</span>
              </label>
              <input id="sf-name" className={inputCls} placeholder="Nama Karyawan" {...register('name')} />
              {errors.name && <span className="text-xs text-red-500 mt-1 block">{errors.name.message?.toString()}</span>}
            </div>

            <div>
              <label htmlFor="sf-nip" className={labelCls}>NIP (Nomor Induk Pegawai)</label>
              <input id="sf-nip" className={inputCls} placeholder="NIP-XXXXX" {...register('nip')} />
            </div>

            <div>
              <label htmlFor="sf-username" className={labelCls}>
                Username <span className="text-red-500">*</span>
              </label>
              <input
                id="sf-username"
                className={inputCls}
                disabled={isEditing}
                placeholder="username_karyawan"
                {...register('username', {
                  onChange: (e) => {
                    e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
                  },
                })}
              />
              {errors.username && <span className="text-xs text-red-500 mt-1 block">{errors.username.message?.toString()}</span>}
            </div>

            {!isEditing && (
              <div>
                <label htmlFor="sf-password" className={labelCls}>
                  Password Sementara <span className="text-red-500">*</span>
                </label>
                <input id="sf-password" type="text" className={inputCls} {...register('password')} />
                {errors.password && <span className="text-xs text-red-500 mt-1 block">{errors.password.message?.toString()}</span>}
              </div>
            )}

            <div>
              <label htmlFor="sf-role" className={labelCls}>
                Role / Jabatan <span className="text-red-500">*</span>
              </label>
              <select id="sf-role" className={inputCls} {...register('role')}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r.replace('_', ' ').toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="sf-outlet" className={labelCls}>
                Outlet Penugasan <span className="text-red-500">*</span>
              </label>
              <select id="sf-outlet" className={inputCls} {...register('outlet_id')}>
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="sf-contract" className={labelCls}>Jenis Kontrak</label>
              <select id="sf-contract" className={inputCls} {...register('contract_type')}>
                <option value="permanent">Tetap (Permanent)</option>
                <option value="contract">Kontrak (PKWT)</option>
                <option value="intern">Magang (Internship)</option>
                <option value="daily">Harian / Freelance</option>
              </select>
            </div>

            <div>
              <label htmlFor="sf-leave" className={labelCls}>Kuota Cuti Tahunan (Hari)</label>
              <input id="sf-leave" type="number" min={0} className={inputCls} {...register('leave_quota')} />
            </div>

            <div>
              <label htmlFor="sf-join" className={labelCls}>Tanggal Mulai Bekerja</label>
              <input id="sf-join" type="date" className={inputCls} {...register('join_date')} />
            </div>

            <div>
              <label htmlFor="sf-resign" className={labelCls}>Tanggal Selesai / Habis Kontrak</label>
              <input id="sf-resign" type="date" className={inputCls} {...register('resign_date')} />
            </div>

            {(watchRole === 'leader' || watchRole === 'area_manager') && (
              <div className="col-span-1 md:col-span-2 mt-2">
                <label className={labelCls}>Outlet Binaan / Supervisi</label>
                <Controller
                  name="outlet_ids"
                  control={control}
                  render={({ field }) => (
                    <OutletMultiSelect outlets={outlets} selected={field.value} onChange={field.onChange} />
                  )}
                />
              </div>
            )}
          </div>
        )}

        {activeTab === 'pribadi' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="sf-nik" className={labelCls}>NIK KTP (16 Digit)</label>
              <input
                id="sf-nik"
                className={inputCls}
                maxLength={16}
                placeholder="320xxxxxxxxxxxxx"
                {...register('nik', {
                  onChange: (e) => {
                    e.target.value = e.target.value.replace(/\D/g, '')
                  },
                })}
              />
              {errors.nik && <span className="text-xs text-red-500 mt-1 block">{errors.nik.message?.toString()}</span>}
            </div>

            <div>
              <label htmlFor="sf-email" className={labelCls}>Email Pribadi</label>
              <input id="sf-email" type="email" className={inputCls} placeholder="nama@email.com" {...register('email')} />
            </div>

            <div>
              <label htmlFor="sf-phone" className={labelCls}>No. WhatsApp / Telepon</label>
              <input id="sf-phone" className={inputCls} placeholder="08xxxxxxxxxx" {...register('phone')} />
            </div>

            <div>
              <label htmlFor="sf-gender" className={labelCls}>Jenis Kelamin</label>
              <select id="sf-gender" className={inputCls} {...register('gender')}>
                <option value="">Pilih</option>
                <option value="male">Laki-laki</option>
                <option value="female">Perempuan</option>
              </select>
            </div>

            <div>
              <label htmlFor="sf-birthplace" className={labelCls}>Tempat Lahir</label>
              <input id="sf-birthplace" className={inputCls} placeholder="Kota Lahir" {...register('birth_place')} />
            </div>

            <div>
              <label htmlFor="sf-birthdate" className={labelCls}>Tanggal Lahir</label>
              <input id="sf-birthdate" type="date" className={inputCls} {...register('birth_date')} />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="sf-address-ktp" className={labelCls}>Alamat KTP</label>
              <textarea id="sf-address-ktp" rows={2} className={inputCls} placeholder="Alamat lengkap sesuai KTP" {...register('address_ktp')} />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="sf-address-domicile" className={labelCls}>Alamat Domisili Saat Ini</label>
              <textarea id="sf-address-domicile" rows={2} className={inputCls} placeholder="Alamat tempat tinggal saat ini" {...register('address_domicile')} />
            </div>
          </div>
        )}

        {activeTab === 'darurat' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 bg-amber-50 rounded-xl p-3 text-xs text-amber-900 border border-amber-200">
              ⚠️ Kontak darurat wajib dihubungi saat terjadi hal kritis atau darurat medis pada karyawan di outlet.
            </div>

            <div>
              <label htmlFor="sf-emg-name" className={labelCls}>Nama Lengkap Kontak Darurat</label>
              <input id="sf-emg-name" className={inputCls} placeholder="Nama Orang Terdekat" {...register('emergency_name')} />
            </div>

            <div>
              <label htmlFor="sf-emg-rel" className={labelCls}>Hubungan</label>
              <input id="sf-emg-rel" className={inputCls} placeholder="Orang Tua / Pasangan / Saudara" {...register('emergency_relationship')} />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="sf-emg-phone" className={labelCls}>Nomor Telepon Darurat</label>
              <input id="sf-emg-phone" className={inputCls} placeholder="08xxxxxxxxxx" {...register('emergency_phone')} />
            </div>
          </div>
        )}

        {activeTab === 'keuangan' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 bg-suka-orange/10 rounded-xl p-3 text-xs text-suka-brown border border-suka-orange/20 font-medium">
              🔒 Komponen Gaji & Nomor Rekening Transfer Bank Staf.
            </div>

            <div>
              <Controller
                name="basic_salary"
                control={control}
                render={({ field }) => (
                  <CurrencyInput
                    id="sf-basic-salary"
                    label="Gaji Pokok (Rp)"
                    className={inputCls}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>

            <div>
              <Controller
                name="allowance_position"
                control={control}
                render={({ field }) => (
                  <CurrencyInput
                    id="sf-allowance-pos"
                    label="Tunjangan Jabatan (Rp)"
                    className={inputCls}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>

            <div>
              <Controller
                name="allowance_presence"
                control={control}
                render={({ field }) => (
                  <CurrencyInput
                    id="sf-allowance-pres"
                    label="Tunjangan Kehadiran (Rp)"
                    className={inputCls}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>

            <div>
              <label htmlFor="sf-npwp" className={labelCls}>NPWP</label>
              <input id="sf-npwp" className={inputCls} placeholder="Nomor NPWP" {...register('npwp')} />
            </div>

            <div className="md:col-span-2 border-t border-suka-gray-200 my-2 pt-2">
              <h4 className="text-xs font-bold text-suka-brown uppercase tracking-wider mb-2">Informasi Rekening Bank</h4>
            </div>

            <div>
              <label htmlFor="sf-bank-name" className={labelCls}>Nama Bank</label>
              <input id="sf-bank-name" className={inputCls} placeholder="BCA / Mandiri / BNI / BRI" {...register('bank_name')} />
            </div>

            <div>
              <label htmlFor="sf-bank-acc-num" className={labelCls}>Nomor Rekening</label>
              <input id="sf-bank-acc-num" className={inputCls} placeholder="Nomor Rekening" {...register('bank_account_number')} />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="sf-bank-acc-name" className={labelCls}>Nama Pemilik Rekening</label>
              <input id="sf-bank-acc-name" className={inputCls} placeholder="Nama Sesuai Buku Tabungan" {...register('bank_account_name')} />
            </div>
          </div>
        )}
      </div>

      {/* Buttons */}
      <div className="flex justify-between items-center pt-3 border-t border-suka-brown/10">
        <Button
          type="button"
          variant="secondary"
          disabled={isFirstStep}
          onClick={handlePrev}
          className="rounded-xl px-5 py-2 font-bold"
        >
          Sebelumnya
        </Button>

        {!isLastStep ? (
          <Button
            type="button"
            onClick={handleNext}
            className="rounded-xl px-5 py-2 font-bold bg-suka-orange hover:bg-suka-orange/90 text-white"
          >
            Selanjutnya
          </Button>
        ) : (
          <Button
            type="submit"
            disabled={submitting}
            className="rounded-xl px-6 py-2.5 font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {submitting ? 'Menyimpan...' : 'Simpan Profil Karyawan'}
          </Button>
        )}
      </div>
    </form>
  )
}
