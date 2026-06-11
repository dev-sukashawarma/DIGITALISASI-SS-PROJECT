import { AuthGuard } from '@/components/common/AuthGuard'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>
}
