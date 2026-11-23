import { describe, expect, it } from 'vitest'
import {
  ADAM_INDRA_SAMI_EMAIL,
  ADAM_INDRA_SAMI_ID,
  canAccessLabaRugi,
} from './labaRugiAccess'

describe('canAccessLabaRugi (Dashboard Manager)', () => {
  it('mengizinkan Indra Adam Sami lewat ID atau email rm@ss.com', () => {
    expect(
      canAccessLabaRugi({
        id: ADAM_INDRA_SAMI_ID,
        role: 'regional_manager',
        status: 'active',
      }),
    ).toBe(true)

    expect(
      canAccessLabaRugi(
        { id: 'other-id', role: 'regional_manager', status: 'active' },
        ADAM_INDRA_SAMI_EMAIL,
      ),
    ).toBe(true)
  })

  it('menolak Area Manager dan akun regional_manager lain', () => {
    expect(
      canAccessLabaRugi({
        id: 'caf351f1-ea40-4fff-99ce-a4af71c59d47',
        email: 'tririzky@ss.com',
        role: 'area_manager',
        status: 'active',
      }),
    ).toBe(false)

    expect(
      canAccessLabaRugi({
        id: 'f68af25c-e7b7-4c40-8497-cc782b001543',
        email: null,
        role: 'regional_manager',
        status: 'active',
      }),
    ).toBe(false)
  })

  it('menolak jika akun nonaktif', () => {
    expect(
      canAccessLabaRugi({
        id: ADAM_INDRA_SAMI_ID,
        email: ADAM_INDRA_SAMI_EMAIL,
        role: 'regional_manager',
        status: 'inactive',
      }),
    ).toBe(false)
  })

  it('mengizinkan developer, owner, dan admin aktif', () => {
    expect(canAccessLabaRugi({ id: 'dev-1', role: 'developer', status: 'active' })).toBe(true)
    expect(canAccessLabaRugi({ id: 'own-1', role: 'owner', status: 'active' })).toBe(true)
    expect(canAccessLabaRugi({ id: 'adm-1', role: 'admin', status: 'active' })).toBe(true)
  })
})
