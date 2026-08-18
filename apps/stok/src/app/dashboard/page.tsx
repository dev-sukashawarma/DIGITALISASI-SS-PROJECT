'use client'

import { MonitoringPage } from '@/components/monitoring/MonitoringPage'
import { AppLayout } from '@/components/layout/AppLayout'

export default function DashboardPage() {
  return (
    <AppLayout>
      <MonitoringPage />
    </AppLayout>
  )
}
