import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { ensureDatabaseSchema } from '@/lib/prisma'
import { pastikanOutletPosTersinkron } from '@/lib/outletPosSyncServer'
import DashboardShell from '@/components/dashboard/DashboardShell'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await ensureDatabaseSchema()
  const [user] = await Promise.all([
    getCurrentUser(),
    pastikanOutletPosTersinkron(),
  ])

  if (!user) {
    redirect('/login')
  }

  return (
    <DashboardShell user={user}>
      {children}
    </DashboardShell>
  )
}
