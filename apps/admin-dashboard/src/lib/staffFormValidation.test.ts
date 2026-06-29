import { describe, it, expect } from 'vitest'
import {
  validateStaffStep,
  validateStaffThrough,
  type StaffStepId,
  type StaffStepValues,
} from './staffFormValidation'

const valid: StaffStepValues = {
  name: 'Budi',
  username: 'budi',
  password: 'rahasia123',
  nik: '3201234567890123', // 16 digit
  isEditing: false,
}

const STEPS_PRIVILEGED: StaffStepId[] = ['utama', 'pribadi', 'darurat', 'keuangan']
const STEPS_BASIC: StaffStepId[] = ['utama', 'pribadi', 'darurat']

describe('validateStaffStep', () => {
  it('utama: butuh name, username, password (saat create)', () => {
    expect(validateStaffStep('utama', valid)).toBeNull()
    expect(validateStaffStep('utama', { ...valid, name: '' })).toMatch(/Nama/)
    expect(validateStaffStep('utama', { ...valid, username: '' })).toMatch(/Username/)
    expect(validateStaffStep('utama', { ...valid, password: '' })).toMatch(/Password/)
  })

  it('utama: password TIDAK wajib saat edit', () => {
    expect(validateStaffStep('utama', { ...valid, password: '', isEditing: true })).toBeNull()
  })

  it('pribadi: NIK wajib 16 digit kalau diisi, boleh kosong', () => {
    expect(validateStaffStep('pribadi', valid)).toBeNull()
    expect(validateStaffStep('pribadi', { ...valid, nik: '' })).toBeNull()
    expect(validateStaffStep('pribadi', { ...valid, nik: '12345' })).toMatch(/NIK/)
    expect(validateStaffStep('pribadi', { ...valid, nik: '320123456789012' })).toMatch(/NIK/) // 15
  })

  it('darurat & keuangan tidak punya validasi wajib', () => {
    expect(validateStaffStep('darurat', { ...valid, name: '', nik: '12' })).toBeNull()
    expect(validateStaffStep('keuangan', { ...valid, name: '', nik: '12' })).toBeNull()
  })
})

describe('validateStaffThrough — cegah bypass via lompat step', () => {
  it('semua valid → null', () => {
    expect(validateStaffThrough(STEPS_PRIVILEGED, 3, valid)).toBeNull()
  })

  it('regresi NIK: lompat utama→keuangan tetap menangkap NIK invalid di pribadi', () => {
    // Skenario bug: user isi NIK invalid di pribadi, mundur, lalu submit dari step terakhir.
    const badNik = { ...valid, nik: '12345' }
    const fail = validateStaffThrough(STEPS_PRIVILEGED, 3, badNik)
    expect(fail).not.toBeNull()
    expect(fail!.stepId).toBe('pribadi')
    expect(fail!.message).toMatch(/NIK/)
  })

  it('berlaku juga untuk non-privileged (3 step, last = darurat)', () => {
    const badNik = { ...valid, nik: '99' }
    const fail = validateStaffThrough(STEPS_BASIC, STEPS_BASIC.length - 1, badNik)
    expect(fail?.stepId).toBe('pribadi')
  })

  it('mengembalikan step pertama yang invalid (utama sebelum pribadi)', () => {
    const fail = validateStaffThrough(STEPS_PRIVILEGED, 3, { ...valid, name: '', nik: '12345' })
    expect(fail?.stepId).toBe('utama') // utama dicek lebih dulu
  })

  it('targetIndex membatasi cakupan (tak cek step setelah target)', () => {
    // Hanya validasi sampai utama (idx 0): NIK invalid di pribadi belum dicek.
    expect(validateStaffThrough(STEPS_PRIVILEGED, 0, { ...valid, nik: '12345' })).toBeNull()
  })
})
