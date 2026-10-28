import { describe, it, expect } from 'vitest'
import { createHeadGeometry, createBrainNetwork } from './HologramHead3D'

describe('HologramHead3D Geometry & Neural Engine', () => {
  it('menghasilkan geometri kepala robot 3D yang valid dan simetris', () => {
    const geom = createHeadGeometry()

    expect(geom.baseVertices.length).toBeGreaterThan(30)
    expect(geom.edges.length).toBeGreaterThan(40)
    expect(geom.jawIndices.length).toBeGreaterThan(5)

    // Validasi tidak ada vertex yang bernilai NaN atau tak hingga
    geom.baseVertices.forEach(([x, y, z]) => {
      expect(Number.isFinite(x)).toBe(true)
      expect(Number.isFinite(y)).toBe(true)
      expect(Number.isFinite(z)).toBe(true)
    })

    // Validasi engsel rahang (TMJ pivot) terdefinisi dengan benar
    expect(geom.jawPivotY).toBeCloseTo(0.22)
    expect(geom.jawPivotZ).toBeCloseTo(0.05)

    // Validasi indeks rahang merujuk ke vertex yang valid
    geom.jawIndices.forEach((idx) => {
      expect(idx).toBeGreaterThanOrEqual(0)
      expect(idx).toBeLessThan(geom.baseVertices.length)
    })

    // Validasi sensor mata dan mulut ada
    expect(geom.eyeLeftCore).toBeGreaterThanOrEqual(0)
    expect(geom.eyeRightCore).toBeGreaterThanOrEqual(0)
    expect(geom.mouthCenterUpper).toBeGreaterThanOrEqual(0)
    expect(geom.mouthCenterLower).toBeGreaterThanOrEqual(0)
  })

  it('menghasilkan jaringan neural otak 3D dengan sinapsis aktif', () => {
    const brain = createBrainNetwork()

    // Harus memiliki setidaknya 35 node otak (belahan kiri, kanan, dan corpus callosum)
    expect(brain.nodes.length).toBeGreaterThanOrEqual(35)
    expect(brain.synapses.length).toBeGreaterThan(15)

    brain.nodes.forEach((node) => {
      expect(Number.isFinite(node.pos[0])).toBe(true)
      expect(Number.isFinite(node.pos[1])).toBe(true)
      expect(Number.isFinite(node.pos[2])).toBe(true)
      expect(node.size).toBeGreaterThan(0)
    })

    // Validasi sinapsis menghubungkan node yang valid
    brain.synapses.forEach((syn) => {
      expect(syn.from).toBeGreaterThanOrEqual(0)
      expect(syn.from).toBeLessThan(brain.nodes.length)
      expect(syn.to).toBeGreaterThanOrEqual(0)
      expect(syn.to).toBeLessThan(brain.nodes.length)
      expect(syn.signalProgress).toBeGreaterThanOrEqual(0)
      expect(syn.signalProgress).toBeLessThanOrEqual(1)
    })
  })
})
