'use client'
import { useState, useRef } from 'react'
import Papa from 'papaparse'
import { Upload, Check, AlertTriangle } from 'lucide-react'
import { Button, Spinner } from '@suka/design-system'
import { toast } from 'sonner'
import { useStaffMutations } from '@/hooks/useStaffMutations'
import { generateTempPassword } from '@/lib/generatePassword'
import type { Outlet, Role, StaffFormValues } from '@/lib/types'

interface BulkImportStaffProps {
  outlets: Outlet[]
  onComplete: () => void
  onCancel: () => void
}

interface ParsedRow {
  raw: any
  parsed: StaffFormValues | null
  error?: string
}

export function BulkImportStaff({ outlets, onComplete, onCancel }: BulkImportStaffProps) {
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { create } = useStaffMutations()

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedRows = results.data.map((row: any) => {
          try {
            // Find outlet
            const outletName = (row['Nama Outlet'] || '').trim().toLowerCase()
            const outlet = outlets.find(
              (o) => o.name.toLowerCase() === outletName || o.slug.toLowerCase() === outletName
            ) || (row['Role'] === 'staff_pusat' ? outlets.find(o => o.id === 'ffffffff-ffff-ffff-ffff-ffffffffffff') : null)

            if (!outlet && row['Role'] !== 'staff_pusat') {
              throw new Error(`Outlet '${row['Nama Outlet']}' tidak ditemukan`)
            }

            const parsed: StaffFormValues = {
              name: row['Nama Lengkap'] || '',
              username: row['Username'] || '',
              password: row['Password'] || generateTempPassword(),
              role: (row['Role'] || 'crew') as Role,
              outlet_id: outlet?.id || outlets[0]?.id || '',
              outlet_ids: [],
              nip: row['NIP'] || null,
              contract_type: row['Jenis Kontrak'] || 'contract',
              join_date: row['Tanggal Gabung (YYYY-MM-DD)'] || null,
              resign_date: row['Tanggal Keluar (YYYY-MM-DD)'] || null,
              leave_quota: Number(row['Kuota Cuti']) || 12,
              nik: row['NIK KTP'] || null,
              email: row['Email'] || null,
              phone: row['No Telepon'] || null,
              address_ktp: row['Alamat KTP'] || null,
              address_domicile: row['Alamat Domisili'] || null,
              birth_place: row['Tempat Lahir'] || null,
              birth_date: row['Tanggal Lahir (YYYY-MM-DD)'] || null,
              gender: (row['Jenis Kelamin (male/female)'] === 'male' || row['Jenis Kelamin (male/female)'] === 'female') ? row['Jenis Kelamin (male/female)'] : null,
              religion: row['Agama'] || null,
              emergency_name: row['Nama Kontak Darurat'] || null,
              emergency_relationship: row['Hubungan Kontak Darurat'] || null,
              emergency_phone: row['No Telepon Darurat'] || null,
              basic_salary: Number(row['Gaji Pokok']) || 0,
              allowance_position: Number(row['Tunjangan Jabatan']) || 0,
              allowance_presence: Number(row['Tunjangan Kehadiran']) || 0,
              bank_name: row['Nama Bank'] || '',
              bank_account_number: row['Nomor Rekening'] || '',
              bank_account_name: row['Nama Pemilik Rekening'] || '',
              npwp: row['NPWP'] || null,
              bpjs_ketenagakerjaan: row['BPJS Ketenagakerjaan'] || null,
              bpjs_kesehatan: row['BPJS Kesehatan'] || null,
            }

            if (!parsed.name || !parsed.username || !parsed.role) {
              throw new Error('Nama, Username, dan Role wajib diisi')
            }

            return { raw: row, parsed, error: undefined }
          } catch (err: any) {
            return { raw: row, parsed: null, error: err.message }
          }
        })

        setRows(parsedRows)
      },
      error: (error) => {
        toast.error(`Gagal membaca file: ${error.message}`)
      }
    })
  }

  async function handleImport() {
    const validRows = rows.filter(r => r.parsed && (!r.error || r.error === 'Sudah diimpor'))
    if (validRows.length === 0) {
      toast.error('Tidak ada data valid untuk diimpor')
      return
    }

    setIsProcessing(true)
    let successCount = 0
    let failCount = 0

    const updatedRows = [...rows]

    for (let i = 0; i < updatedRows.length; i++) {
      const row = updatedRows[i]
      if (!row.parsed || row.error) continue

      try {
        await create.mutateAsync(row.parsed)
        row.error = 'Berhasil'
        successCount++
      } catch (err: any) {
        row.error = `Gagal: ${err.message}`
        failCount++
      }
      setRows([...updatedRows])
    }

    setIsProcessing(false)
    if (failCount === 0) {
      toast.success(`${successCount} staff berhasil diimpor!`)
      setTimeout(onComplete, 1500)
    } else {
      toast.warning(`Selesai. ${successCount} berhasil, ${failCount} gagal. Periksa baris yang gagal.`)
    }
  }

  const hasData = rows.length > 0
  const validCount = rows.filter(r => r.parsed && (!r.error || r.error === 'Berhasil')).length
  const errorCount = rows.filter(r => r.error && r.error !== 'Berhasil').length

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 border-b border-suka-gray-100 pb-4">
        <div>
          <input 
            type="file" 
            accept=".csv" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
          />
          <Button
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2"
          >
            <Upload size={16} /> Pilih File CSV
          </Button>
        </div>
        <div className="text-sm text-suka-gray-500">
          Atau <a href="/template_import_karyawan.csv" download className="text-suka-orange underline font-semibold">Download Template CSV</a>
        </div>
      </div>

      {hasData && (
        <div className="space-y-4">
          <div className="flex gap-4 p-3 bg-suka-cream/30 rounded-xl">
            <div className="flex-1">
              <p className="text-xs text-suka-gray-500">Total Baris</p>
              <p className="font-bold text-suka-ink">{rows.length}</p>
            </div>
            <div className="flex-1">
              <p className="text-xs text-suka-gray-500">Valid (Siap Import)</p>
              <p className="font-bold text-emerald-600">{validCount}</p>
            </div>
            <div className="flex-1">
              <p className="text-xs text-suka-gray-500">Error</p>
              <p className="font-bold text-red-500">{errorCount}</p>
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto rounded-xl border border-suka-gray-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-suka-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 font-semibold text-suka-gray-600">Baris</th>
                  <th className="px-3 py-2 font-semibold text-suka-gray-600">Nama</th>
                  <th className="px-3 py-2 font-semibold text-suka-gray-600">Username</th>
                  <th className="px-3 py-2 font-semibold text-suka-gray-600">Password</th>
                  <th className="px-3 py-2 font-semibold text-suka-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-suka-gray-100">
                {rows.map((r, i) => (
                  <tr key={i} className={r.error && r.error !== 'Berhasil' ? 'bg-red-50' : r.error === 'Berhasil' ? 'bg-emerald-50' : ''}>
                    <td className="px-3 py-2">{i + 1}</td>
                    <td className="px-3 py-2">{r.raw['Nama Lengkap'] || '-'}</td>
                    <td className="px-3 py-2">{r.raw['Username'] || '-'}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.parsed?.password || '-'}</td>
                    <td className="px-3 py-2 text-xs">
                      {r.error === 'Berhasil' ? (
                        <span className="flex items-center gap-1 text-emerald-600"><Check size={14} /> Berhasil</span>
                      ) : r.error ? (
                        <span className="flex items-center gap-1 text-red-600"><AlertTriangle size={14} /> {r.error}</span>
                      ) : (
                        <span className="text-suka-gray-500">Siap</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={onCancel} disabled={isProcessing}>Batal</Button>
            <Button 
              onClick={handleImport} 
              disabled={isProcessing || validCount === 0 || validCount === rows.filter(r => r.error === 'Berhasil').length}
              className="flex items-center gap-2"
            >
              {isProcessing ? <Spinner className="w-4 h-4" /> : <Upload size={16} />}
              Import {validCount - rows.filter(r => r.error === 'Berhasil').length} Data
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
