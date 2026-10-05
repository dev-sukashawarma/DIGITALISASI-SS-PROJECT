import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient, getOutletStaff, getVerifiedUserId } from '@suka/auth'
import HalamanAsisten from '@/components/sukaBot/HalamanAsisten'

export default async function AsistenPage() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({ getAll: () => cookieStore.getAll(), setAll: () => {} })
  const userId = await getVerifiedUserId(supabase)
  if (!userId) redirect('/')
  const { staff } = await getOutletStaff(supabase, userId)
  if (!staff || staff.status !== 'active' || !['admin', 'owner', 'developer'].includes(staff.role)) redirect('/launcher')

  const host = (await headers()).get('host') || ''
  const lokal = host.includes('localhost') || host.includes('127.0.0.1')
  const apiBase = lokal ? 'http://localhost:3005' : (process.env.NEXT_PUBLIC_APP_URL_ADMIN_DASHBOARD || 'https://admin.sukashawarma.com')

  return (
    <main className="min-h-screen bg-suka-cream p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-4">
        <Link href="/launcher" className="text-sm text-suka-brown font-semibold">← Kembali ke portal</Link>
        <HalamanAsisten apiBase={apiBase} />
      </div>
    </main>
  )
}
