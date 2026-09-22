import { redirect } from 'next/navigation'

// Live camera monitoring sudah dihapus; satu-satunya fitur app ini adalah peta staff.
export default function DashboardPage() {
  redirect('/lokasi')
}
