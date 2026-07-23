import { redirect } from 'next/navigation'

export default function ReportsIndexPage() {
  // Redirect to the first tab (Rangkuman Penjualan)
  redirect('/dashboard/reports/pos')
}
