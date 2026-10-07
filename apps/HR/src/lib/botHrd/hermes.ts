// Klien Hermes API server (OpenAI-compatible) profil `hrd`. Riwayat disimpan Hermes per sesi — kirim pesan baru saja. Server-only:
// kunci tak pernah sampai ke browser. Kontrak diverifikasi di runbook Hermes Â§7.
export async function tanyaHermes(opsi: {
  baseUrl: string
  kunci: string
  sesiId: string
  pesan: string
  fetchFn?: typeof fetch
  batasMs?: number
}): Promise<string> {
  const f = opsi.fetchFn ?? fetch
  const res = await f(`${opsi.baseUrl.replace(/\/+$/, '')}/p/hrd/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opsi.kunci}`,
      'X-Hermes-Session-Id': opsi.sesiId,
    },
    body: JSON.stringify({ model: 'hrd', stream: false, messages: [{ role: 'user', content: opsi.pesan }] }),
    signal: AbortSignal.timeout(opsi.batasMs ?? 90_000),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Bot HRD sedang tidak tersedia (HTTP ${res.status})`)
  const body = (await res.json().catch(() => null)) as { choices?: { message?: { content?: string | null } }[] } | null
  const isi = body?.choices?.[0]?.message?.content?.trim()
  if (!isi) throw new Error('Bot HRD tidak memberi jawaban')
  return isi
}
