'use client'

import { useState, useEffect } from 'react'
import { Button } from '@suka/design-system'
import type { StaffContract } from '@/lib/types'

interface ContractEditModalProps {
  contract: StaffContract | null
  onClose: () => void
  onSave: (values: {
    staff_id: string
    contract_type: string
    join_date: string
    resign_date: string | null
  }) => void
}

const inputClass =
  'w-full rounded-xl border border-suka-gray-200 px-3 py-2.5 outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange transition-all bg-white text-suka-ink text-sm'
const labelClass = 'mb-1 block text-xs font-bold text-suka-brown'

export function ContractEditModal({ contract, onClose, onSave }: ContractEditModalProps) {
  const [contractType, setContractType] = useState('contract')
  const [joinDate, setJoinDate] = useState('')
  const [resignDate, setResignDate] = useState('')

  useEffect(() => {
    if (contract) {
      setContractType(contract.contract_type === 'Tetap' ? 'permanent' : 'contract')
      setJoinDate(contract.start_date?.split('T')[0] || '')
      setResignDate(contract.end_date?.split('T')[0] || '')
    }
  }, [contract])

  if (!contract) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      staff_id: contract.staff_id,
      contract_type: contractType,
      join_date: joinDate,
      resign_date: resignDate || null,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border border-suka-gray-200 bg-white p-6 shadow-xl space-y-4 animate-in zoom-in-95"
      >
        <h3 className="text-base font-extrabold text-suka-brown">Perbarui Masa Berlaku Kontrak</h3>
        <p className="text-xs text-suka-gray-500 font-medium">
          {contract.outlet_staff?.name} &bull; {contract.outlet_staff?.outlets?.name || 'Pusat'}
        </p>

        <div className="space-y-3 pt-2">
          <div>
            <label className={labelClass}>Jenis Perjanjian Kerja</label>
            <select
              className={inputClass}
              value={contractType}
              onChange={(e) => setContractType(e.target.value)}
            >
              <option value="contract">PKWT (Perjanjian Kerja Waktu Tertentu / Kontrak)</option>
              <option value="permanent">PKWTT (Karyawan Tetap)</option>
              <option value="intern">Magang (Internship)</option>
              <option value="daily">Harian / Freelance</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Tanggal Mulai Bekerja (Join Date)</label>
            <input
              type="date"
              className={inputClass}
              value={joinDate}
              onChange={(e) => setJoinDate(e.target.value)}
              required
            />
          </div>

          <div>
            <label className={labelClass}>Tanggal Berakhir Kontrak (Resign / End Date)</label>
            <input
              type="date"
              className={inputClass}
              value={resignDate}
              onChange={(e) => setResignDate(e.target.value)}
              placeholder="Kosongkan jika karyawan tetap"
            />
            <span className="text-[11px] text-suka-gray-400 mt-1 block">
              Kosongkan jika status Karyawan Tetap tanpa batas waktu berakhir.
            </span>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-2 pt-3 border-t border-suka-gray-100">
          <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl font-bold">
            Batal
          </Button>
          <Button
            type="submit"
            className="rounded-xl font-bold bg-suka-orange hover:bg-suka-orange/90 text-white"
          >
            Simpan Kontrak
          </Button>
        </div>
      </form>
    </div>
  )
}
