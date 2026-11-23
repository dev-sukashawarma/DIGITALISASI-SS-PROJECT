import { Tag } from 'lucide-react'

export default function ScheduledPromoBadge({ names, size = 'sm' }: { names?: string[] | null; size?: 'sm' | 'md' }) {
  const visible = (names || []).filter(Boolean)
  if (!visible.length) return null
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 text-violet-700 font-bold ${size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'}`} title={`Dibeli saat promo terjadwal: ${visible.join(', ')}`}>
      <Tag className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      Promo: {visible.join(', ')}
    </span>
  )
}
