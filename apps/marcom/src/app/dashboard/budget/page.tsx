import { getCurrentUser } from '@/lib/auth'
import { getMonthlyBudgetMatrix } from '@/app/actions/budgets'
import BudgetMatrixView from './BudgetMatrixView'

export const dynamic = 'force-dynamic'

export default async function BudgetPage() {
  const user = await getCurrentUser()
  // Default to current budget period: Month 9 (September), Year 2026
  const data = await getMonthlyBudgetMatrix(9, 2026)

  return (
    <BudgetMatrixView
      initialData={data}
      userRole={user?.role || 'MARCOM'}
    />
  )
}
