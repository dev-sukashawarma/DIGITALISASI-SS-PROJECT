import { getCurrentUser } from '@/lib/auth'
import { getMonthlyBudgetMatrix } from '@/app/actions/budgets'
import { getOpexData } from '@/app/actions/opex'
import { prisma, ensureDatabaseSchema } from '@/lib/prisma'
import BudgetMatrixView from './BudgetMatrixView'

export const dynamic = 'force-dynamic'

export default async function BudgetPage() {
  await ensureDatabaseSchema()
  const user = await getCurrentUser()
  const now = new Date()
  const defaultMonth = now.getMonth() + 1
  const defaultYear = now.getFullYear()

  const [data, opexSummary, outlets] = await Promise.all([
    getMonthlyBudgetMatrix(defaultMonth, defaultYear),
    getOpexData(defaultMonth, defaultYear),
    prisma.outlet.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, type: true },
    }),
  ])

  const serializedOutlets = outlets.map((o) => ({
    id: o.id.toString(),
    name: o.name,
    type: o.type,
  }))

  return (
    <BudgetMatrixView
      initialData={data}
      initialOpexSummary={opexSummary}
      outlets={serializedOutlets}
      userRole={user?.role || 'MARCOM'}
    />
  )
}
