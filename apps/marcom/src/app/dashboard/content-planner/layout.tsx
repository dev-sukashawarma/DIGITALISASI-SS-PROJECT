import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { isPutriHambali } from '@/lib/access-control'

export default async function ContentPlannerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  if (isPutriHambali(user?.email)) {
    redirect('/dashboard')
  }

  return <>{children}</>
}
