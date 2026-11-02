import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ select: vi.fn(), eq: vi.fn(), update: vi.fn(), from: vi.fn(), revalidate: vi.fn() }))
vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [] }) }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }))
vi.mock('@suka/auth', () => ({ createSupabaseServerClient: () => ({ from: mocks.from }) }))
vi.mock('./order-online-sync', () => ({ syncMenuToOrderOnline: vi.fn() }))

import { nonaktifkanMenu, setMenuHiddenPos } from './actions'

describe('setMenuHiddenPos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.from.mockReturnValue({ update: mocks.update })
    mocks.update.mockReturnValue({ eq: mocks.eq })
    mocks.eq.mockReturnValue({ select: mocks.select })
  })
  it('updates only POS visibility and confirms the persisted value', async () => {
    mocks.select.mockResolvedValue({ data: [{ id: 'm1', is_hidden_pos: true }], error: null })
    await expect(setMenuHiddenPos('m1', true)).resolves.toBe(true)
    expect(mocks.from).toHaveBeenCalledWith('menu_items')
    expect(mocks.update).toHaveBeenCalledWith({ is_hidden_pos: true })
    expect(mocks.eq).toHaveBeenCalledWith('id', 'm1')
    expect(mocks.revalidate).toHaveBeenCalledWith('/dashboard/pos-admin/menu')
  })
  it('reports a denied update instead of showing a false success', async () => {
    mocks.select.mockResolvedValue({ data: [], error: null })
    await expect(setMenuHiddenPos('m1', false)).rejects.toThrow()
    expect(mocks.revalidate).not.toHaveBeenCalled()
  })
  it('hides menu from POS when nonaktifkanMenu is called for non-deletable menus', async () => {
    mocks.select.mockResolvedValue({
      data: [{ id: 'm1', is_available: false, is_available_online: false, tampil_di_app: false, is_hidden_pos: true, is_published_order_online: false }],
      error: null,
    })
    await expect(nonaktifkanMenu('m1')).resolves.toEqual({ ok: true })
    expect(mocks.update).toHaveBeenCalledWith({
      is_available: false,
      is_available_online: false,
      tampil_di_app: false,
      is_hidden_pos: true,
    })
  })
})
