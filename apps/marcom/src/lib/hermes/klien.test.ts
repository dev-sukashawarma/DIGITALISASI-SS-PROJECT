import { describe, it, expect, vi, beforeEach } from 'vitest'
import { tanyaHermesMarcom } from './klien'

describe('klien Hermes Marcom', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    process.env.HERMES_API_URL = 'http://hermes-mock.local'
    process.env.HERMES_API_KEY = 'kunci-mock-123'
  })

  it('mengirim pesan ke endpoint Hermes dengan format OpenAI yang tepat', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Halo! Jadwal konten hari ini ada 2 video TikTok.',
            },
          },
        ],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const jawaban = await tanyaHermesMarcom('Jadwal konten hari ini?', [], 'sesi-123')

    expect(fetchMock).toHaveBeenCalledWith(
      'http://hermes-mock.local/p/marcom/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer kunci-mock-123',
          'X-Hermes-Session-Id': 'sesi-123',
        }),
      })
    )
    expect(jawaban).toBe('Halo! Jadwal konten hari ini ada 2 video TikTok.')
  })

  it('menangani error jaringan/timeout dengan pesan ramah', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('Failed to connect to Hermes'))
    vi.stubGlobal('fetch', fetchMock)

    const jawaban = await tanyaHermesMarcom('Halo?', [])
    expect(jawaban).toContain('Maaf, saat ini Bot Marcom sedang tidak dapat terhubung')
  })
})
