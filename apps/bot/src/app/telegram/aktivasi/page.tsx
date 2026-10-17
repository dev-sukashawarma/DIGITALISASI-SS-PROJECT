const messages: Record<string, { title: string; body: string }> = {
  invalid: { title: 'Link aktivasi tidak valid', body: 'Minta admin membuat link aktivasi baru.' },
  expired: { title: 'Link aktivasi sudah kedaluwarsa', body: 'Minta admin membuat link aktivasi baru.' },
  access_revoked: { title: 'Akses bot sudah dicabut', body: 'Hubungi admin jika Anda masih perlu memakai bot ini.' },
  linked_elsewhere: { title: 'Akun Telegram sudah dipakai', body: 'Akun Telegram ini sudah terhubung ke staf lain. Hubungi admin untuk memperbaikinya.' },
  unavailable: { title: 'Aktivasi belum bisa diproses', body: 'Layanan sedang mengalami kendala. Coba lagi beberapa saat atau minta admin membuat link baru.' },
}

export const dynamic = 'force-dynamic'

export default async function HalamanStatusAktivasi({ searchParams }: {
  searchParams: Promise<{ status?: string }>
}) {
  const status = (await searchParams).status ?? 'invalid'
  const message = messages[status] ?? messages.invalid
  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-12 text-zinc-100">
      <section className="mx-auto max-w-lg rounded-2xl border border-zinc-700 bg-zinc-900 p-6">
        <h1 className="text-xl font-bold">{message.title}</h1>
        <p className="mt-3 text-sm text-zinc-300">{message.body}</p>
        <p className="mt-5 text-xs text-zinc-400">Demi keamanan, jangan teruskan link aktivasi kepada orang lain.</p>
      </section>
    </main>
  )
}
