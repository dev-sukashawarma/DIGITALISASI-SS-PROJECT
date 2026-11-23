import { render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SsoHandoffPage from './page'

describe('SsoHandoffPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    window.history.replaceState({}, '', '/')
  })

  it('menghapus token dari URL lalu menyerahkannya ke API same-origin', async () => {
    const fetchMock = vi.fn(() => new Promise<Response>(() => undefined))
    vi.stubGlobal('fetch', fetchMock)
    window.history.replaceState(
      {},
      '',
      `/auth/sso#access_token=${encodeURIComponent('access-token-from-pos')}` +
        `&refresh_token=${encodeURIComponent('refresh-token-from-pos')}` +
        '&next=%2Fdashboard'
    )

    render(<SsoHandoffPage />)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    expect(window.location.hash).toBe('')
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/sso',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
        body: JSON.stringify({
          accessToken: 'access-token-from-pos',
          refreshToken: 'refresh-token-from-pos',
          access_token: 'access-token-from-pos',
          refresh_token: 'refresh-token-from-pos',
        }),
      })
    )
  })

  it('token lewat query ikut dihapus dari URL, next dipertahankan', async () => {
    const fetchMock = vi.fn(() => new Promise<Response>(() => undefined))
    vi.stubGlobal('fetch', fetchMock)
    window.history.replaceState(
      {},
      '',
      '/auth/sso?access_token=akses-q&refresh_token=refresh-q&next=%2Fstok%2Fopname'
    )

    render(<SsoHandoffPage />)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    expect(window.location.search).toBe('?next=%2Fstok%2Fopname')
    expect(window.location.href).not.toContain('akses-q')
    expect(window.location.href).not.toContain('refresh-q')
  })
})
