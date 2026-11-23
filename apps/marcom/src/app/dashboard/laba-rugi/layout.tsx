import { redirect } from 'next/navigation'
import { Toaster } from 'sonner'
import { getCurrentUser } from '@/lib/auth'
import { getDefaultDashboardPath, isAdminLike, isMelani } from '@/lib/access-control'

export const dynamic = 'force-dynamic'

export default async function LabaRugiLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }

  if (!isMelani(user.email) && !isAdminLike(user.role)) {
    redirect(getDefaultDashboardPath(user.email))
  }

  return (
    <div className="w-full p-3 sm:p-6 lg:p-8">
      <Toaster position="top-center" richColors />
      {children}
    </div>
  )
}
