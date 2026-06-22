import { getChannel } from '@/lib/channels'

// Badge channel eksternal dengan brand color + mark. Dipakai di kartu order
// pada papan kasir & histori. Ukuran 'sm' untuk badge inline, 'md' untuk chip.
export default function ChannelBadge({
  channel,
  size = 'sm',
}: {
  channel: string | null | undefined
  size?: 'sm' | 'md'
}) {
  const cfg = getChannel(channel)
  if (!cfg) return null

  const isMd = size === 'md'

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-bold uppercase tracking-wider rounded-md ${
        isMd ? 'text-xs px-2.5 py-1' : 'text-[10px] px-2 py-0.5'
      }`}
      style={{ backgroundColor: cfg.bg, color: cfg.fg }}
    >
      {cfg.logoPath ? (
        <span className={`inline-flex items-center justify-center flex-shrink-0 ${isMd ? 'w-4 h-4' : 'w-3.5 h-3.5'}`}>
          <svg viewBox="0 0 24 24" className="w-full h-full fill-current">
            <path d={cfg.logoPath} />
          </svg>
        </span>
      ) : (
        <span
          className={`inline-flex items-center justify-center rounded-full bg-white/25 font-extrabold leading-none ${
            isMd ? 'w-4 h-4 text-[9px]' : 'w-3.5 h-3.5 text-[8px]'
          }`}
        >
          {cfg.mark}
        </span>
      )}
      {cfg.label}
    </span>
  )
}
