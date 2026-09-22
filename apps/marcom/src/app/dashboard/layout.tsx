import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { ensureDatabaseSchema } from '@/lib/prisma'
import DashboardShell from '@/components/dashboard/DashboardShell'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await ensureDatabaseSchema()
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <DashboardShell user={user}>
      {children}
    </DashboardShell>
  )
}
