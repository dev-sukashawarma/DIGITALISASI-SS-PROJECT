'use client'

import { Wallet } from 'lucide-react'
import { useRole } from '@/components/layout/RoleContext'
import { PageHeader } from '@/components/ui/PageHeader'
import { BudgetOutletList } from '@/components/budget/BudgetOutletList'

export default function BudgetOutletPage() {
  const { role } = useRole()

  if (role !== 'OWNER') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 px-4 text-center">
        <p className="text-suka-brown font-bold">Halaman ini khusus owner.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Budget Outlet"
        description="Atur plafon belanja bulanan/mingguan/harian tiap outlet."
        icon={Wallet}
      />
      <BudgetOutletList />
    </div>
  )
}
