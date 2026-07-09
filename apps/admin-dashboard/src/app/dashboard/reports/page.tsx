import { redirect } from 'next/navigation'

export default function ReportsIndexPage() {
  // Redirect to the first tab. Both OWNER and ADMIN have access to voids.
  redirect('/dashboard/reports/voids')
}
