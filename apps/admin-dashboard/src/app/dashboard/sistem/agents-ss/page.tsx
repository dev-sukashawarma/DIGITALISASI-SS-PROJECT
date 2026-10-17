import Link from 'next/link'
import { KeyRound, UserCheck } from 'lucide-react'
import { requireRole } from '@/lib/authz'

export const dynamic = 'force-dynamic'

export default async function HalamanAgentsSS() {
  await requireRole(['owner', 'admin'])

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-bold">Agents SS</h1>
        <p className="mt-2 text-sm text-gray-600">Kelola kunci akses agen dan staf yang boleh memakai bot Telegram.</p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/dashboard/sistem/hermes" className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md">
          <KeyRound className="mb-3 text-blue-700" size={24} />
          <h2 className="font-semibold text-gray-900">Kunci Hermes</h2>
          <p className="mt-1 text-sm text-gray-600">Buat dan kelola kunci API untuk profil agen.</p>
        </Link>
        <Link href="/dashboard/sistem/bot-telegram" className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md">
          <UserCheck className="mb-3 text-blue-700" size={24} />
          <h2 className="font-semibold text-gray-900">Akses Bot Telegram</h2>
          <p className="mt-1 text-sm text-gray-600">Pilih bot, lalu tentukan staf yang mendapat akses.</p>
        </Link>
      </div>
    </div>
  )
}
