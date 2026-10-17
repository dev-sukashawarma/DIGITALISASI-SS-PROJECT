import { requireRole } from '@/lib/authz'
import { createServiceClient } from '@/lib/supabase/server'
import AksesBotTelegram from './AksesBotTelegram'

export const dynamic = 'force-dynamic'

export default async function HalamanAksesBotTelegram() {
  await requireRole(['owner', 'admin'])
  const service = createServiceClient()
  const [
    { data: bots, error: botsError },
    { data: staff, error: staffError },
    { data: stokisAccess, error: stokisAccessError },
    { data: otherAccess, error: otherAccessError },
    { data: links, error: linksError },
  ] = await Promise.all([
    service.from('hermes_bot_registry').select('slug, nama').order('nama'),
    service.from('outlet_staff').select('id, name, username, role').eq('status', 'active').order('name').limit(1000),
    service.from('bot_telegram_access').select('staff_id'),
    service.from('hermes_bot_user_access').select('bot_slug, staff_id'),
    service.from('bot_telegram_links').select('staff_id, telegram_user_id'),
  ])

  const linked = new Map((links ?? []).map((row) => [row.staff_id, String(row.telegram_user_id)]))
  const rows = (staff ?? []).map((row) => ({
    ...row,
    telegramUserId: linked.get(row.id) ?? null,
  }))
  const access = [
    ...(stokisAccess ?? []).map((row) => ({ botSlug: 'stokis', staffId: row.staff_id })),
    ...(otherAccess ?? []).map((row) => ({ botSlug: row.bot_slug, staffId: row.staff_id })),
  ]

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-bold">Akses Bot Telegram</h1>
        <p className="mt-2 text-sm text-gray-600">
          Pilih bot lebih dulu, lalu tentukan staf yang boleh memakai bot tersebut.
        </p>
      </header>
      {botsError || staffError || stokisAccessError || otherAccessError || linksError ? (
        <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          Daftar bot, staf, atau akses Telegram gagal dimuat. Pastikan migrasi katalog bot sudah diterapkan.
        </p>
      ) : <AksesBotTelegram initialBots={bots ?? []} initialStaff={rows} initialAccess={access} />}
      <p className="text-sm text-gray-600">
        Perubahan akses otomatis tersinkron ke allowlist Hermes. Admin memilih staf dan membuat link aktivasi untuk bot yang dipilih; staf cukup mengonfirmasi akun Telegram lalu menekan Start.
        Untuk Stokis, akses ini juga mengatur penerimaan alert Stok &amp; Distribusi.
      </p>
    </div>
  )
}
