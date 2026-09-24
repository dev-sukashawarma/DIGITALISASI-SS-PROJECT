import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { isMelani } from '@/lib/access-control'

export default async function AdsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  if (isMelani(user?.email)) {
    redirect('/dashboard/content-planner')
  }

  return <>{children}</>
}
