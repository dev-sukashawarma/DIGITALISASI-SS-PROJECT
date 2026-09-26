import { getCurrentUser } from '@/lib/auth'
import Link from 'next/link'
import { Lock } from 'lucide-react'
import MarcomEomClosingClient from './MarcomEomClosingClient'

export const dynamic = 'force-dynamic'

export default async function MarcomEomClosingPage() {
  const user = await getCurrentUser()
  const isDeveloper = user?.role?.toLowerCase() === 'developer'

  if (!isDeveloper) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4 text-amber-500">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
          Akses Terbatas: Tahap Development
        </h2>
        <p className="text-sm text-slate-500 max-w-md mb-6 leading-relaxed">
          Modul <strong>EOM Closing Satelit Marketing & Marcom</strong> saat ini masih dalam tahap pengembangan aktif dan hanya dapat diakses oleh akun dengan role <span className="font-semibold text-amber-600 dark:text-amber-400">Developer</span>.
        </p>
        <Link
          href="/dashboard"
          className="px-5 py-2.5 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-sm font-semibold hover:opacity-90 transition-all shadow-sm"
        >
          Kembali ke Dashboard Marketing
        </Link>
      </div>
    )
  }

  return <MarcomEomClosingClient />
}
