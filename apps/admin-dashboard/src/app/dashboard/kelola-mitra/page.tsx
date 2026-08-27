import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function KelolaMitraRedirectPage() {
  redirect('/dashboard/owner/kelola-mitra')
}
