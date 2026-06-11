import { AuthGuard } from '@/components/common/AuthGuard'

export default function DistribusiLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>
}
