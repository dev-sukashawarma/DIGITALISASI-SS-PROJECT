import { describe, expect, it } from 'vitest'
import { jepitPosisi, posisiAwal, posisiPanel, posisiTab, sudahGeser, UKURAN_TAB, ukuranPanel } from './posisi'

const DESKTOP = { w: 1440, h: 900 }
const HP = { w: 390, h: 844 }
const CHEF_D = { w: 80, h: 140 }
const CHEF_HP = { w: 63, h: 110 }

describe('sudahGeser', () => {
  it('di bawah 5 px masih dianggap klik', () => {
    expect(sudahGeser(3, 4)).toBe(false)
    expect(sudahGeser(4, 4)).toBe(true)
  })
})

describe('jepitPosisi & posisiAwal', () => {
  it('chef tidak bisa keluar layar', () => {
    expect(jepitPosisi({ x: -50, y: 2000 }, CHEF_D, DESKTOP)).toEqual({ x: 8, y: 900 - 140 - 8 })
    expect(jepitPosisi({ x: 5000, y: -9 }, CHEF_D, DESKTOP)).toEqual({ x: 1440 - 80 - 8, y: 8 })
  })
  it('posisi awal di pojok kanan bawah', () => {
    expect(posisiAwal(CHEF_D, DESKTOP)).toEqual({ x: 1440 - 80 - 16, y: 900 - 140 - 16 })
  })
})

describe('ukuranPanel', () => {
  it('desktop 384x576, HP selebar layar dikurangi margin', () => {
    expect(ukuranPanel(DESKTOP)).toEqual({ w: 384, h: 576 })
    expect(ukuranPanel(HP)).toEqual({ w: 358, h: 576 })
  })
})

describe('posisiPanel', () => {
  it('chef di kanan: panel di kiri chef, sejajar bawah', () => {
    const chef = { x: 1344, y: 744, ...CHEF_D }
    expect(posisiPanel(chef, ukuranPanel(DESKTOP), DESKTOP)).toEqual({ x: 1344 - 12 - 384, y: 744 + 140 - 576, w: 384, h: 576 })
  })
  it('chef di kiri: panel di kanan chef', () => {
    const chef = { x: 16, y: 744, ...CHEF_D }
    expect(posisiPanel(chef, ukuranPanel(DESKTOP), DESKTOP)).toEqual({ x: 16 + 80 + 12, y: 744 + 140 - 576, w: 384, h: 576 })
  })
  it('chef di atas: panel tetap di dalam layar (dijepit ke bawah)', () => {
    const chef = { x: 1344, y: 20, ...CHEF_D }
    expect(posisiPanel(chef, ukuranPanel(DESKTOP), DESKTOP).y).toBe(16)
  })
  it('HP, chef di bawah: panel di atas chef tanpa menutupinya', () => {
    const chef = { x: 274, y: 718, ...CHEF_HP }
    expect(posisiPanel(chef, ukuranPanel(HP), HP)).toEqual({ x: 16, y: 718 - 12 - 576, w: 358, h: 576 })
  })
  it('HP, chef di atas: panel di bawah chef', () => {
    const chef = { x: 20, y: 40, ...CHEF_HP }
    expect(posisiPanel(chef, ukuranPanel(HP), HP)).toEqual({ x: 16, y: 40 + 110 + 12, w: 358, h: 576 })
  })
  it('HP pendek: panel dipendekkan agar muat di atas chef', () => {
    const layar = { w: 375, h: 600 }
    const chef = { x: 300, y: 474, ...CHEF_HP }
    expect(posisiPanel(chef, ukuranPanel(layar), layar)).toEqual({ x: 16, y: 16, w: 343, h: 474 - 12 - 16 })
  })
  it('ruang terlalu sempit: tinggi minimal 280 dipertahankan (boleh menutupi chef)', () => {
    const layar = { w: 375, h: 500 }
    const chef = { x: 300, y: 150, ...CHEF_HP }
    expect(posisiPanel(chef, ukuranPanel(layar), layar).h).toBe(280)
  })
})

describe('ukuranPanel dengan ukuran pilihan', () => {
  it('memakai ukuran dasar yang diberikan, tetap dijepit layar', () => {
    expect(ukuranPanel(DESKTOP, { w: 448, h: 680 })).toEqual({ w: 448, h: 680 })
    expect(ukuranPanel({ w: 1440, h: 700 }, { w: 448, h: 680 })).toEqual({ w: 448, h: 588 })
    expect(ukuranPanel(HP, { w: 448, h: 680 })).toEqual({ w: 358, h: 680 })
  })
})

describe('posisiTab', () => {
  it('menempel di tepi kanan, setinggi tengah chef', () => {
    expect(posisiTab({ y: 500, h: 140 }, DESKTOP)).toEqual({ x: 1440 - UKURAN_TAB, y: 500 + 70 - UKURAN_TAB / 2 })
  })
  it('tetap di dalam layar', () => {
    expect(posisiTab({ y: 880, h: 140 }, DESKTOP).y).toBe(900 - UKURAN_TAB - 8)
    expect(posisiTab({ y: -100, h: 140 }, DESKTOP).y).toBe(8)
  })
})
