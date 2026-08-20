'use client'

import { BudgetOutletTabContent } from '@/components/monitoring/budget/BudgetOutletTabContent'
import { AppLayout } from '@/components/layout/AppLayout'

export default function BudgetOutletPage() {
  return (
    <AppLayout>
      <div className="min-h-screen bg-[#fff8f1]">
        <BudgetOutletTabContent />
      </div>
    </AppLayout>
  )
}
