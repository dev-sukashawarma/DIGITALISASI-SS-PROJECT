import { redirect } from 'next/navigation'
import { ambilIdentitasTelegram } from '@/lib/server/identitasTelegram'

export const dynamic = 'force-dynamic'

export default async function HalamanAksesStokist() {
  const identity = await ambilIdentitasTelegram()
  if (!identity || !['owner', 'admin'].includes(identity.role)) redirect('/telegram')
  redirect('https://admin.sukashawarma.com/dashboard/sistem/bot-telegram')
}
