'use client'
import { Power } from 'lucide-react'
import type { StaffStatus } from '@/lib/types'

export function StatusToggle({
  status, onToggle,
}: {
  status: StaffStatus
  onToggle: (next: StaffStatus) => void
}) {
  const active = status === 'active'
  return (
    <button
      onClick={() => onToggle(active ? 'inactive' : 'active')}
      className={`rounded-lg p-2 ${active ? 'text-amber-600 hover:bg-amber-50' : 'text-suka-green hover:bg-green-50'}`}
      title={active ? 'Nonaktifkan' : 'Aktifkan'}
    >
      <Power size={16} />
    </button>
  )
}
