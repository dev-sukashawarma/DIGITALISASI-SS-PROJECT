import { Badge } from '@suka/design-system'
import type { StokLevel } from '@/types/stok'

const MAP: Record<StokLevel, { label: string; icon: string; variant: string }> = {
  aman:    { label: 'Aman',    icon: '🟢', variant: 'success' },
  menipis: { label: 'Menipis', icon: '🟡', variant: 'warning' },
  kritis:  { label: 'Kritis',  icon: '🔴', variant: 'danger' },
  unknown: { label: 'Belum ada batas', icon: '⚪', variant: 'default' },
}

export function StokStatusBadge({ level }: { level: StokLevel }) {
  const m = MAP[level]
  return <Badge variant={m.variant as any}>{m.icon} {m.label}</Badge>
}
