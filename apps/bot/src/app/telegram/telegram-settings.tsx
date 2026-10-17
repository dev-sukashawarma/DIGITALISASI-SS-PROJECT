type Props = { awalTerhubung: boolean; username: string | null }

export default function TelegramSettings({ awalTerhubung, username }: Props) {
  return (
    <section className="mt-6 space-y-3">
      {awalTerhubung ? (
        <p className="text-sm font-semibold text-emerald-300">
          ✓ Telegram terhubung {username ? `(@${username})` : ''}
        </p>
      ) : (
        <p className="rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-sm text-zinc-300">
          Aktivasi dilakukan oleh admin. Minta link undangan jika Anda belum menerimanya.
        </p>
      )}
    </section>
  )
}
