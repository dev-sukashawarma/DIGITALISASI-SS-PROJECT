import { AuthGuard } from '@/components/common/AuthGuard'

export default function StokLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>
}
