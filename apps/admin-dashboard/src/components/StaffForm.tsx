'use client'
import { useState } from 'react'
import { Button } from '@suka/design-system'
import { useAuth } from '@suka/auth'
import { OutletMultiSelect } from './OutletMultiSelect'
import type { Outlet, StaffFormValues, Role } from '@/lib/types'

const ROLES: Role[] = ['admin', 'admin_hr', 'owner', 'spv', 'kitchen', 'leader', 'crew', 'kiosk', 'mitra', 'staff_pusat']

export function StaffForm({
  outlets, onSubmit, submitting, initial, isPrivileged: customIsPrivileged,
}: {
  outlets: Outlet[]
  onSubmit: (values: StaffFormValues) => void
  submitting: boolean
  initial?: Partial<StaffFormValues>
  isPrivileged?: boolean
}) {
  console.log('StaffForm render start')
  // Determine if user has privileged HR access
  let isPrivileged = customIsPrivileged ?? true
  const auth = useAuth()
  console.log('StaffForm auth:', auth)
  if (customIsPrivileged === undefined && auth?.outletStaff?.role) {
    isPrivileged = ['owner', 'admin_hr', 'admin'].includes(auth.outletStaff.role)
  }

  const isEditing = !!initial?.name

  const [activeTab, setActiveTab] = useState<'utama' | 'pribadi' | 'darurat' | 'keuangan'>('utama')

  // 1. Informasi Utama
  const [name, setName] = useState(initial?.name ?? '')
  const [username, setUsername] = useState(initial?.username ?? '')
  const [password, setPassword] = useState(initial?.password ?? 'sukashawarma123')
  const [role, setRole] = useState<Role>(initial?.role ?? 'crew')
  const [outletId, setOutletId] = useState(initial?.outlet_id ?? (outlets[0]?.id ?? ''))
  const [outletIds, setOutletIds] = useState<string[]>(initial?.outlet_ids ?? [])
  const [nip, setNip] = useState(initial?.nip ?? '')
  const [contractType, setContractType] = useState(initial?.contract_type ?? 'contract')
  const [joinDate, setJoinDate] = useState(initial?.join_date ?? '')
  const [resignDate, setResignDate] = useState(initial?.resign_date ?? '')
  const [leaveQuota, setLeaveQuota] = useState(initial?.leave_quota ?? 12)

  // 2. Data Pribadi
  const [nik, setNik] = useState(initial?.nik ?? '')
  const [personalEmail, setPersonalEmail] = useState(initial?.email ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [addressKtp, setAddressKtp] = useState(initial?.address_ktp ?? '')
  const [addressDomicile, setAddressDomicile] = useState(initial?.address_domicile ?? '')
  const [birthPlace, setBirthPlace] = useState(initial?.birth_place ?? '')
  const [birthDate, setBirthDate] = useState(initial?.birth_date ?? '')
  const [gender, setGender] = useState<'male' | 'female' | ''>(initial?.gender ?? '')
  const [religion, setReligion] = useState(initial?.religion ?? '')

  // 3. Kontak Darurat
  const [emergencyName, setEmergencyName] = useState(initial?.emergency_name ?? '')
  const [emergencyRelationship, setEmergencyRelationship] = useState(initial?.emergency_relationship ?? '')
  const [emergencyPhone, setEmergencyPhone] = useState(initial?.emergency_phone ?? '')

  // 4. Keuangan & Rekening
  const [basicSalary, setBasicSalary] = useState<number>(initial?.basic_salary ?? 0)
  const [allowancePosition, setAllowancePosition] = useState<number>(initial?.allowance_position ?? 0)
  const [allowancePresence, setAllowancePresence] = useState<number>(initial?.allowance_presence ?? 0)
  const [bankName, setBankName] = useState(initial?.bank_name ?? '')
  const [bankAccountNumber, setBankAccountNumber] = useState(initial?.bank_account_number ?? '')
  const [bankAccountName, setBankAccountName] = useState(initial?.bank_account_name ?? '')
  const [npwp, setNpwp] = useState(initial?.npwp ?? '')
  const [bpjsKetenagakerjaan, setBpjsKetenagakerjaan] = useState(initial?.bpjs_ketenagakerjaan ?? '')
  const [bpjsKesehatan, setBpjsKesehatan] = useState(initial?.bpjs_kesehatan ?? '')

  const inputCls = 'w-full rounded-xl border border-suka-gray-200 px-3 py-2.5 outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange transition-all bg-white text-suka-ink text-sm'
  const labelCls = 'mb-1 block text-sm font-semibold text-suka-ink'

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    // Check validation for NIK if provided
    if (nik && nik.length !== 16) {
      alert('NIK harus tepat 16 digit angka!')
      setActiveTab('pribadi')
      return
    }

    const payload: StaffFormValues = {
      name,
      username,
      role,
      outlet_id: outletId,
      outlet_ids: role === 'leader' ? outletIds : [],
      // Personal
      nik: nik || null,
      email: personalEmail || null,
      phone: phone || null,
      address_ktp: addressKtp || null,
      address_domicile: addressDomicile || null,
      birth_place: birthPlace || null,
      birth_date: birthDate || null,
      gender: gender || null,
      religion: religion || null,
      // Emergency
      emergency_name: emergencyName || null,
      emergency_relationship: emergencyRelationship || null,
      emergency_phone: emergencyPhone || null,
      // Contract
      nip: nip || null,
      contract_type: contractType || null,
      join_date: joinDate || null,
      resign_date: resignDate || null,
      leave_quota: Number(leaveQuota),
    }

    // Only include password if creating
    if (!isEditing) {
      payload.password = password
    }

    // Only include financial details if privileged
    if (isPrivileged) {
      payload.basic_salary = Number(basicSalary)
      payload.allowance_position = Number(allowancePosition)
      payload.allowance_presence = Number(allowancePresence)
      payload.bank_name = bankName
      payload.bank_account_number = bankAccountNumber
      payload.bank_account_name = bankAccountName
      payload.npwp = npwp || null
      payload.bpjs_ketenagakerjaan = bpjsKetenagakerjaan || null
      payload.bpjs_kesehatan = bpjsKesehatan || null
    }

    onSubmit(payload)
  }

  const tabs = [
    { id: 'utama', label: 'Informasi Utama' },
    { id: 'pribadi', label: 'Data Pribadi' },
    { id: 'darurat', label: 'Kontak Darurat' },
    ...(isPrivileged ? [{ id: 'keuangan', label: 'Keuangan & Rekening' }] : [])
  ] as const

  const extendedOutlets = [...outlets]
  if (!extendedOutlets.find(o => o.id === 'ffffffff-ffff-ffff-ffff-ffffffffffff' || o.name.toLowerCase().includes('kantor pusat'))) {
    extendedOutlets.push({
      id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
      name: 'Kantor Pusat',
      slug: 'kantor-pusat',
      address: null,
      lat: 0,
      lng: 0,
      type: 'hq',
      is_active: true
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Premium Tab Selection */}
      <div className="flex flex-wrap gap-2 border-b border-suka-gray-200 pb-3">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 cursor-pointer ${
              activeTab === tab.id
                ? 'bg-suka-brown text-white shadow-md transform scale-[1.02]'
                : 'bg-suka-cream text-suka-brown hover:bg-suka-orange hover:text-white hover:shadow-sm'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      <div className="bg-suka-cream/20 rounded-2xl p-4 sm:p-6 border border-suka-gray-100 min-h-[300px]">
        {activeTab === 'utama' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="sf-name" className={labelCls}>Nama Lengkap</label>
              <input id="sf-name" className={inputCls} required value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama Karyawan" />
            </div>

            <div>
              <label htmlFor="sf-nip" className={labelCls}>NIP (Nomor Induk Pegawai)</label>
              <input id="sf-nip" className={inputCls} value={nip} onChange={(e) => setNip(e.target.value)} placeholder="NIP-XXXXX" />
            </div>

            <div>
              <label htmlFor="sf-username" className={labelCls}>Username</label>
              <input 
                id="sf-username" 
                className={inputCls} 
                required 
                value={username}
                disabled={isEditing}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} 
                placeholder="username_karyawan"
              />
              {isEditing && <span className="text-xs text-suka-gray-500 mt-1 block">Username tidak dapat diubah setelah dibuat.</span>}
            </div>

            {!isEditing && (
              <div>
                <label htmlFor="sf-password" className={labelCls}>Password Sementara</label>
                <input id="sf-password" type="text" className={inputCls} required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            )}

            <div>
              <label htmlFor="sf-role" className={labelCls}>Role</label>
              <select id="sf-role" className={inputCls} value={role} onChange={(e) => {
                const newRole = e.target.value as Role
                setRole(newRole)
                if (newRole === 'staff_pusat') {
                  const pusat = extendedOutlets.find(o => 
                    o.id === 'ffffffff-ffff-ffff-ffff-ffffffffffff' || 
                    o.name.toLowerCase().includes('kantor pusat')
                  )
                  if (pusat) setOutletId(pusat.id)
                }
              }}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="sf-outlet" className={labelCls}>Outlet Home</label>
              <select 
                id="sf-outlet" 
                className={inputCls} 
                value={outletId} 
                onChange={(e) => setOutletId(e.target.value)}
                disabled={role === 'staff_pusat'}
              >
                {extendedOutlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="sf-contract" className={labelCls}>Jenis Kontrak</label>
              <select id="sf-contract" className={inputCls} value={contractType} onChange={(e) => setContractType(e.target.value as any)}>
                <option value="permanent">Tetap (Permanent)</option>
                <option value="contract">Kontrak (Contract)</option>
                <option value="intern">Magang (Internship)</option>
                <option value="daily">Harian / Freelance (Daily)</option>
              </select>
            </div>

            <div>
              <label htmlFor="sf-leave" className={labelCls}>Kuota Cuti Tahunan (Hari)</label>
              <input id="sf-leave" type="number" min={0} className={inputCls} value={leaveQuota} onChange={(e) => setLeaveQuota(Number(e.target.value))} />
            </div>

            <div>
              <label htmlFor="sf-join" className={labelCls}>Tanggal Bergabung</label>
              <input id="sf-join" type="date" className={inputCls} value={joinDate} onChange={(e) => setJoinDate(e.target.value)} />
            </div>

            <div>
              <label htmlFor="sf-resign" className={labelCls}>Tanggal Resign (Jika ada)</label>
              <input id="sf-resign" type="date" className={inputCls} value={resignDate} onChange={(e) => setResignDate(e.target.value)} />
            </div>

            {role === 'leader' && (
              <div className="col-span-1 md:col-span-2 mt-2">
                <label className={labelCls}>Outlet Binaan</label>
                <OutletMultiSelect outlets={outlets} selected={outletIds} onChange={setOutletIds} />
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
                value={nik} 
                maxLength={16}
                onChange={(e) => setNik(e.target.value.replace(/\D/g, ''))} 
                placeholder="320xxxxxxxxxxxxx" 
              />
            </div>

            <div>
              <label htmlFor="sf-email" className={labelCls}>Email Pribadi</label>
              <input id="sf-email" type="email" className={inputCls} value={personalEmail} onChange={(e) => setPersonalEmail(e.target.value)} placeholder="nama@email.com" />
            </div>

            <div>
              <label htmlFor="sf-phone" className={labelCls}>No. WhatsApp / Telepon</label>
              <input id="sf-phone" className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08xxxxxxxxxx" />
            </div>

            <div>
              <label htmlFor="sf-gender" className={labelCls}>Jenis Kelamin</label>
              <select id="sf-gender" className={inputCls} value={gender} onChange={(e) => setGender(e.target.value as any)}>
                <option value="">Pilih Jenis Kelamin</option>
                <option value="male">Laki-laki</option>
                <option value="female">Perempuan</option>
              </select>
            </div>

            <div>
              <label htmlFor="sf-birthplace" className={labelCls}>Tempat Lahir</label>
              <input id="sf-birthplace" className={inputCls} value={birthPlace} onChange={(e) => setBirthPlace(e.target.value)} placeholder="Kota Lahir" />
            </div>

            <div>
              <label htmlFor="sf-birthdate" className={labelCls}>Tanggal Lahir</label>
              <input id="sf-birthdate" type="date" className={inputCls} value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
            </div>

            <div>
              <label htmlFor="sf-religion" className={labelCls}>Agama</label>
              <input id="sf-religion" className={inputCls} value={religion} onChange={(e) => setReligion(e.target.value)} placeholder="Agama" />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="sf-address-ktp" className={labelCls}>Alamat KTP</label>
              <textarea id="sf-address-ktp" rows={2} className={inputCls} value={addressKtp} onChange={(e) => setAddressKtp(e.target.value)} placeholder="Alamat lengkap sesuai KTP" />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="sf-address-domicile" className={labelCls}>Alamat Domisili (Saat Ini)</label>
              <textarea id="sf-address-domicile" rows={2} className={inputCls} value={addressDomicile} onChange={(e) => setAddressDomicile(e.target.value)} placeholder="Alamat tempat tinggal saat ini" />
            </div>
          </div>
        )}

        {activeTab === 'darurat' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 bg-suka-orange/10 rounded-xl p-3 text-xs text-suka-ink mb-2">
              ⚠️ Kontak darurat wajib dihubungi saat terjadi hal kritis/medis pada karyawan di outlet.
            </div>

            <div>
              <label htmlFor="sf-emg-name" className={labelCls}>Nama Lengkap Kontak Darurat</label>
              <input id="sf-emg-name" className={inputCls} value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} placeholder="Nama Orang Terdekat" />
            </div>

            <div>
              <label htmlFor="sf-emg-rel" className={labelCls}>Hubungan</label>
              <input id="sf-emg-rel" className={inputCls} value={emergencyRelationship} onChange={(e) => setEmergencyRelationship(e.target.value)} placeholder="Orang Tua / Suami / Istri / Saudara" />
            </div>

            <div>
              <label htmlFor="sf-emg-phone" className={labelCls}>Nomor Telepon Darurat</label>
              <input id="sf-emg-phone" className={inputCls} value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} placeholder="08xxxxxxxxxx" />
            </div>
          </div>
        )}

        {activeTab === 'keuangan' && isPrivileged && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 bg-suka-brown/10 border-l-4 border-suka-brown rounded-r-xl p-3 text-xs text-suka-brown mb-2 font-medium">
              🔒 Informasi Keuangan Terlindungi RLS. Data ini hanya dapat diakses oleh Owner, Admin, dan Admin HR.
            </div>

            <div>
              <label htmlFor="sf-basic-salary" className={labelCls}>Gaji Pokok (Rp)</label>
              <input id="sf-basic-salary" type="number" min={0} className={inputCls} value={basicSalary} onChange={(e) => setBasicSalary(Number(e.target.value))} />
            </div>

            <div>
              <label htmlFor="sf-allowance-pos" className={labelCls}>Tunjangan Jabatan (Rp)</label>
              <input id="sf-allowance-pos" type="number" min={0} className={inputCls} value={allowancePosition} onChange={(e) => setAllowancePosition(Number(e.target.value))} />
            </div>

            <div>
              <label htmlFor="sf-allowance-pres" className={labelCls}>Tunjangan Kehadiran (Rp)</label>
              <input id="sf-allowance-pres" type="number" min={0} className={inputCls} value={allowancePresence} onChange={(e) => setAllowancePresence(Number(e.target.value))} />
            </div>

            <div>
              <label htmlFor="sf-npwp" className={labelCls}>NPWP</label>
              <input id="sf-npwp" className={inputCls} value={npwp} onChange={(e) => setNpwp(e.target.value)} placeholder="Nomor NPWP" />
            </div>

            <div>
              <label htmlFor="sf-bpjs-ket" className={labelCls}>BPJS Ketenagakerjaan</label>
              <input id="sf-bpjs-ket" className={inputCls} value={bpjsKetenagakerjaan} onChange={(e) => setBpjsKetenagakerjaan(e.target.value)} placeholder="No. BPJS Ketenagakerjaan" />
            </div>

            <div>
              <label htmlFor="sf-bpjs-kes" className={labelCls}>BPJS Kesehatan</label>
              <input id="sf-bpjs-kes" className={inputCls} value={bpjsKesehatan} onChange={(e) => setBpjsKesehatan(e.target.value)} placeholder="No. BPJS Kesehatan" />
            </div>

            <div className="md:col-span-2 border-t border-suka-gray-200 my-2 pt-2">
              <h4 className="text-sm font-bold text-suka-ink mb-3">Informasi Rekening Bank</h4>
            </div>

            <div>
              <label htmlFor="sf-bank-name" className={labelCls}>Nama Bank</label>
              <input id="sf-bank-name" className={inputCls} value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="BCA / Mandiri / BNI / BRI" />
            </div>

            <div>
              <label htmlFor="sf-bank-acc-num" className={labelCls}>Nomor Rekening</label>
              <input id="sf-bank-acc-num" className={inputCls} value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} placeholder="Nomor Rekening" />
            </div>

            <div>
              <label htmlFor="sf-bank-acc-name" className={labelCls}>Nama Pemilik Rekening</label>
              <input id="sf-bank-acc-name" className={inputCls} value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} placeholder="Nama Sesuai Buku Tabungan" />
            </div>
          </div>
        )}
      </div>

      {/* Form Submission Actions */}
      <div className="flex justify-end gap-3 pt-3 border-t border-suka-gray-100">
        <Button type="submit" disabled={submitting} className="rounded-xl px-6 py-2.5 font-bold hover:shadow-lg transition-all">
          {submitting ? 'Menyimpan...' : 'Simpan Profil Karyawan'}
        </Button>
      </div>
    </form>
  )
}
