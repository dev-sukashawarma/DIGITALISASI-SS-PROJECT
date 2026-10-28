'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { mainkanSuaraHud } from '@/lib/audioHud'
import { Mic, Volume2, Radio, FileBarChart2 } from 'lucide-react'
import type { StatusArcReactor, AnomaliItem } from '@/components/jarvis/ArcReactor'

interface HologramHead3DProps {
  status: StatusArcReactor
  compact?: boolean
  stageMode?: 'center-hero' | 'standalone'
  voiceLoopAktif?: boolean
  spektrumSuara?: number[]
  transkripLive?: string
  anomaliItems?: AnomaliItem[]
  onClickCore?: () => void
  onPilihAnomali?: (item: AnomaliItem) => void
  onBukaDailyBriefing?: () => void
  onBukaChatLengkap?: () => void
  tampilkanTombolBawah?: boolean
  sizeMode?: 'compact' | 'normal' | 'large' | 'muka-doang'
  isMukaDoang?: boolean
  onToggleMukaDoang?: () => void
}

const DEFAULT_SPEKTRUM = [0, 0, 0, 0, 0, 0, 0, 0, 0]

// Tipe Titik 3D [x, y, z]
type Vec3 = [number, number, number]

// Struktur Node Otak Neural
interface NeuralNode {
  pos: Vec3
  aktif: number // 0 - 1
  size: number
}

interface Synapse {
  from: number
  to: number
  signalProgress: number // 0 - 1
  speed: number
  active: boolean
}

// Model Geometri Kepala Cybernetic (Normalisasi radius ~ 1.0 - 1.2)
export function createHeadGeometry() {
  const vertices: Vec3[] = []
  const edges: [number, number][] = []

  const addV = (p: Vec3): number => {
    vertices.push(p)
    return vertices.length - 1
  }
  const addE = (a: number, b: number) => {
    edges.push([a, b])
  }

  // --- 1. CRANIUM / TENGKORAK ATAS ---
  const crown = addV([0, -1.75, 0.05]) // 0: Puncak kepala

  // Cincin Tengkorak Atas (Y = -1.4, R ~ 0.72)
  const ring1: number[] = []
  const nRing1 = 8
  for (let i = 0; i < nRing1; i++) {
    const ang = (i / nRing1) * Math.PI * 2
    const x = Math.sin(ang) * 0.72
    const z = Math.cos(ang) * 0.78 - 0.05
    const idx = addV([x, -1.4, z])
    ring1.push(idx)
    addE(crown, idx)
    if (i > 0) addE(ring1[i - 1], idx)
  }
  addE(ring1[nRing1 - 1], ring1[0])

  // Cincin Pelipis & Dahi (Y = -0.9, R ~ 0.98)
  const ring2: number[] = []
  const nRing2 = 10
  for (let i = 0; i < nRing2; i++) {
    const ang = (i / nRing2) * Math.PI * 2
    const x = Math.sin(ang) * 0.96
    const z = Math.cos(ang) * 0.98 - 0.02
    const idx = addV([x, -0.9, z])
    ring2.push(idx)
    if (i > 0) addE(ring2[i - 1], idx)
    // Sambungkan ke ring1 yang berdekatan
    const r1Idx = ring1[Math.floor((i / nRing2) * nRing1)]
    addE(r1Idx, idx)
  }
  addE(ring2[nRing2 - 1], ring2[0])

  // Pelat Dahi Tengah (Cyber Hexagonal Center Plate)
  const foreheadCenter = addV([0, -0.95, 1.0])
  const foreheadLeft = addV([-0.38, -0.85, 0.94])
  const foreheadRight = addV([0.38, -0.85, 0.94])
  addE(crown, foreheadCenter)
  addE(foreheadCenter, foreheadLeft)
  addE(foreheadCenter, foreheadRight)
  addE(foreheadLeft, foreheadRight)

  // --- 2. ALIS & VISOR CYBERNETIC (MATA HOLOGRAM) ---
  const browCenter = addV([0, -0.42, 1.02])
  const browLeft = addV([-0.52, -0.45, 0.88])
  const browRight = addV([0.52, -0.45, 0.88])
  const templeLeft = addV([-0.95, -0.35, 0.45])
  const templeRight = addV([0.95, -0.35, 0.45])

  addE(foreheadCenter, browCenter)
  addE(foreheadLeft, browLeft)
  addE(foreheadRight, browRight)
  addE(browLeft, browCenter)
  addE(browCenter, browRight)
  addE(browLeft, templeLeft)
  addE(browRight, templeRight)

  // Visor Mata Kiri (Hexagonal cyber eye socket)
  const eyeL_out = addV([-0.62, -0.32, 0.82])
  const eyeL_in = addV([-0.14, -0.3, 0.94])
  const eyeL_top = addV([-0.38, -0.4, 0.9])
  const eyeL_bot = addV([-0.38, -0.22, 0.86])
  const eyeL_core = addV([-0.38, -0.31, 0.9]) // Titik pupil
  addE(eyeL_out, eyeL_top)
  addE(eyeL_top, eyeL_in)
  addE(eyeL_in, eyeL_bot)
  addE(eyeL_bot, eyeL_out)
  addE(eyeL_top, eyeL_core)
  addE(eyeL_bot, eyeL_core)
  addE(eyeL_out, eyeL_core)
  addE(eyeL_in, eyeL_core)

  // Visor Mata Kanan
  const eyeR_out = addV([0.62, -0.32, 0.82])
  const eyeR_in = addV([0.14, -0.3, 0.94])
  const eyeR_top = addV([0.38, -0.4, 0.9])
  const eyeR_bot = addV([0.38, -0.22, 0.86])
  const eyeR_core = addV([0.38, -0.31, 0.9]) // Titik pupil
  addE(eyeR_out, eyeR_top)
  addE(eyeR_top, eyeR_in)
  addE(eyeR_in, eyeR_bot)
  addE(eyeR_bot, eyeR_out)
  addE(eyeR_top, eyeR_core)
  addE(eyeR_bot, eyeR_core)
  addE(eyeR_out, eyeR_core)
  addE(eyeR_in, eyeR_core)

  // Sambungan hidung tengah antara mata
  addE(browCenter, eyeL_in)
  addE(browCenter, eyeR_in)

  // --- 3. HIDUNG & TULANG PIPI (MID-FACE) ---
  const noseTip = addV([0, 0.15, 1.1])
  const noseBase = addV([0, 0.32, 0.98])
  const cheekL = addV([-0.72, 0.05, 0.72])
  const cheekR = addV([0.72, 0.05, 0.72])

  addE(eyeL_in, noseTip)
  addE(eyeR_in, noseTip)
  addE(noseTip, noseBase)
  addE(eyeL_bot, cheekL)
  addE(eyeR_bot, cheekR)
  addE(cheekL, templeLeft)
  addE(cheekR, templeRight)
  addE(cheekL, noseBase)
  addE(cheekR, noseBase)

  // Bibir Atas (Terkunci pada tengkorak)
  const upperLipCenter = addV([0, 0.46, 0.92])
  const upperLipLeft = addV([-0.28, 0.48, 0.85])
  const upperLipRight = addV([0.28, 0.48, 0.85])
  addE(noseBase, upperLipCenter)
  addE(upperLipLeft, upperLipCenter)
  addE(upperLipCenter, upperLipRight)

  // Sensor Telinga / Audio Receiver Transducer (Kiri & Kanan)
  const earL = addV([-1.02, 0.05, 0.05])
  const earR = addV([1.02, 0.05, 0.05])
  addE(templeLeft, earL)
  addE(templeRight, earR)

  // --- 4. RAHANG CYBERNETIC (MANDIBLE / JAW) YANG BISA GERAK / NGOMONG ---
  // Titik engsel rahang (TMJ pivot)
  const jawHingeL = addV([-0.88, 0.22, 0.05])
  const jawHingeR = addV([0.88, 0.22, 0.05])
  addE(earL, jawHingeL)
  addE(earR, jawHingeR)

  // Titik-titik rahang bawah yang berartikulasi (disimpan index-nya)
  const jawIndices: number[] = []

  const addJawV = (p: Vec3): number => {
    const idx = addV(p)
    jawIndices.push(idx)
    return idx
  }

  const chinCenter = addJawV([0, 1.12, 0.82])
  const chinLeft = addJawV([-0.24, 1.06, 0.78])
  const chinRight = addJawV([0.24, 1.06, 0.78])
  const jawAngleL = addJawV([-0.72, 0.72, 0.38])
  const jawAngleR = addJawV([0.72, 0.72, 0.38])
  const lowerLipCenter = addJawV([0, 0.62, 0.88])
  const lowerLipLeft = addJawV([-0.26, 0.58, 0.82])
  const lowerLipRight = addJawV([0.26, 0.58, 0.82])
  const chinBottom = addJawV([0, 1.25, 0.45])

  // Koneksi Rahang
  addE(jawHingeL, jawAngleL)
  addE(jawHingeR, jawAngleR)
  addE(jawAngleL, chinLeft)
  addE(jawAngleR, chinRight)
  addE(chinLeft, chinCenter)
  addE(chinRight, chinCenter)
  addE(chinCenter, chinBottom)
  addE(chinLeft, chinBottom)
  addE(chinRight, chinBottom)

  // Bibir Bawah
  addE(lowerLipLeft, lowerLipCenter)
  addE(lowerLipCenter, lowerLipRight)
  addE(lowerLipCenter, chinCenter)
  addE(lowerLipLeft, chinLeft)
  addE(lowerLipRight, chinRight)

  // Garis mulut tertutup (koneksi upper lip ke lower lip)
  addE(upperLipLeft, lowerLipLeft)
  addE(upperLipRight, lowerLipRight)

  // --- 5. LEHER & BASE PROJEKTOR HOLOGRAM (CYBER PEDESTAL) ---
  const neckBaseL = addV([-0.42, 1.55, 0.0])
  const neckBaseR = addV([0.42, 1.55, 0.0])
  const neckFront = addV([0, 1.5, 0.45])
  const neckBack = addV([0, 1.6, -0.45])
  addE(chinBottom, neckFront)
  addE(jawAngleL, neckBaseL)
  addE(jawAngleR, neckBaseR)
  addE(neckBaseL, neckFront)
  addE(neckBaseR, neckFront)
  addE(neckBaseL, neckBack)
  addE(neckBaseR, neckBack)

  return {
    baseVertices: vertices,
    edges,
    jawIndices,
    jawPivotY: 0.22,
    jawPivotZ: 0.05,
    eyeLeftCore: eyeL_core,
    eyeRightCore: eyeR_core,
    earLeft: earL,
    earRight: earR,
    mouthCenterUpper: upperLipCenter,
    mouthCenterLower: lowerLipCenter,
  }
}

// Generate Jaringan Neural Otak di dalam Kubah Kepala (3D Cortex)
export function createBrainNetwork(): { nodes: NeuralNode[]; synapses: Synapse[] } {
  const nodes: NeuralNode[] = []
  const synapses: Synapse[] = []

  // Titik-titik otak terdistribusi di dalam belahan kiri & kanan
  // Y dari -1.45 hingga -0.65, R ~ 0.58
  const hemisphereCount = 18

  // Belahan Kiri (X < 0)
  for (let i = 0; i < hemisphereCount; i++) {
    const u = i / hemisphereCount
    const phi = u * Math.PI
    const theta = (i * 2.399963) % (Math.PI * 2) // golden angle
    const r = 0.5 + Math.sin(phi * 3) * 0.1
    const x = -0.12 - Math.sin(phi) * Math.cos(theta) * r * 0.85
    const y = -1.42 + phi * 0.28
    const z = Math.sin(phi) * Math.sin(theta) * r * 0.85 - 0.05
    nodes.push({
      pos: [x, y, z],
      aktif: 0.2 + Math.random() * 0.5,
      size: 2.2 + Math.random() * 1.8,
    })
  }

  // Belahan Kanan (X > 0)
  for (let i = 0; i < hemisphereCount; i++) {
    const u = i / hemisphereCount
    const phi = u * Math.PI
    const theta = (i * 2.399963) % (Math.PI * 2)
    const r = 0.5 + Math.sin(phi * 3) * 0.1
    const x = 0.12 + Math.sin(phi) * Math.cos(theta) * r * 0.85
    const y = -1.42 + phi * 0.28
    const z = Math.sin(phi) * Math.sin(theta) * r * 0.85 - 0.05
    nodes.push({
      pos: [x, y, z],
      aktif: 0.2 + Math.random() * 0.5,
      size: 2.2 + Math.random() * 1.8,
    })
  }

  // Jembatan Corpus Callosum (Tengah)
  for (let i = 0; i < 6; i++) {
    const y = -1.25 + i * 0.12
    nodes.push({
      pos: [(Math.random() - 0.5) * 0.12, y, -0.1 + (Math.random() - 0.5) * 0.2],
      aktif: 0.5,
      size: 2.8,
    })
  }

  // Hubungkan sinapsis terdekat
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[i].pos[0] - nodes[j].pos[0]
      const dy = nodes[i].pos[1] - nodes[j].pos[1]
      const dz = nodes[i].pos[2] - nodes[j].pos[2]
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
      if (dist < 0.42 && Math.random() > 0.35) {
        synapses.push({
          from: i,
          to: j,
          signalProgress: Math.random(),
          speed: 0.015 + Math.random() * 0.025,
          active: true,
        })
      }
    }
  }

  return { nodes, synapses }
}

export default function HologramHead3D({
  status = 'optimal',
  compact = false,
  voiceLoopAktif = false,
  spektrumSuara = DEFAULT_SPEKTRUM,
  transkripLive = '',
  onClickCore,
  onBukaDailyBriefing,
  tampilkanTombolBawah = true,
  sizeMode,
  isMukaDoang = false,
  onToggleMukaDoang,
}: HologramHead3DProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Status internal untuk interaksi drag & mouse tracking
  const [isDragging, setIsDragging] = useState(false)
  const [demoSpeaking] = useState(false)
  const lastMousePos = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  // Variabel sudut rotasi (Pitch, Yaw, Roll)
  const rotTarget = useRef<{ pitch: number; yaw: number }>({ pitch: 0.05, yaw: 0 })
  const rotCurrent = useRef<{ pitch: number; yaw: number }>({ pitch: 0.05, yaw: 0 })

  // Data 3D statis (hanya dibuat sekali)
  const geomRef = useRef(createHeadGeometry())
  const brainRef = useRef(createBrainNetwork())

  // Partikel kuantum hologram melayang
  const particlesRef = useRef(
    Array.from({ length: 35 }, () => ({
      x: (Math.random() - 0.5) * 3.5,
      y: (Math.random() - 0.5) * 4.0,
      z: (Math.random() - 0.5) * 3.0,
      vy: -0.008 - Math.random() * 0.015,
      alpha: 0.2 + Math.random() * 0.6,
      size: 1.2 + Math.random() * 2.0,
    }))
  )

  const spektrumRef = useRef(spektrumSuara)
  spektrumRef.current = spektrumSuara

  const statusRef = useRef(status)
  statusRef.current = status

  const demoSpeakingRef = useRef(demoSpeaking)
  demoSpeakingRef.current = demoSpeaking

  // Envelope Follower & Damped Spring Interpolator untuk artikulasi rahang yang fluid
  const jawAngleRef = useRef(0)
  const smoothedAudioEnergyRef = useRef(0)

  // Rata-rata & puncak energi suara aktual untuk UI state
  const maxEnergy = Math.max(...spektrumSuara, 0)
  const avgEnergy =
    spektrumSuara.reduce((acc, v) => acc + v, 0) / (spektrumSuara.length || 1)
  const adaAudioNyata = status === 'speaking' && (maxEnergy > 0.05 || avgEnergy > 0.025)

  // Warna status aksen hologram
  const getColors = useCallback(() => {
    switch (status) {
      case 'warning':
        return {
          primary: '#f59e0b',
          glow: 'rgba(245, 158, 11, 0.45)',
          core: '#fbbf24',
          brain: '#f59e0b',
          eye: '#ef4444',
        }
      case 'listening':
        return {
          primary: '#10b981',
          glow: 'rgba(16, 185, 129, 0.55)',
          core: '#34d399',
          brain: '#10b981',
          eye: '#059669',
        }
      case 'processing':
        return {
          primary: '#38bdf8',
          glow: 'rgba(56, 189, 248, 0.6)',
          core: '#7dd3fc',
          brain: '#0284c7',
          eye: '#38bdf8',
        }
      case 'speaking':
        return {
          primary: '#22d3ee',
          glow: 'rgba(34, 211, 238, 0.75)',
          core: '#e0f2fe',
          brain: '#00f0ff',
          eye: '#38bdf8',
        }
      default:
        return {
          primary: '#00f0ff',
          glow: 'rgba(0, 240, 255, 0.4)',
          core: '#22d3ee',
          brain: '#0891b2',
          eye: '#00f0ff',
        }
    }
  }, [status])

  // Handler interaksi mouse move pada container
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) {
      const dx = e.clientX - lastMousePos.current.x
      const dy = e.clientY - lastMousePos.current.y
      rotTarget.current.yaw += dx * 0.012
      rotTarget.current.pitch += dy * 0.012
      // Batasi pitch agar tidak jungkir balik
      rotTarget.current.pitch = Math.max(-0.65, Math.min(0.65, rotTarget.current.pitch))
      lastMousePos.current = { x: e.clientX, y: e.clientY }
    } else {
      // Parallax halus mengikuti cursor
      const rect = e.currentTarget.getBoundingClientRect()
      const nx = (e.clientX - rect.left) / rect.width - 0.5
      const ny = (e.clientY - rect.top) / rect.height - 0.5
      rotTarget.current.yaw = nx * 0.75
      rotTarget.current.pitch = ny * 0.45
    }
  }, [isDragging])

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    lastMousePos.current = { x: e.clientX, y: e.clientY }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true)
      lastMousePos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging && e.touches.length === 1) {
      const dx = e.touches[0].clientX - lastMousePos.current.x
      const dy = e.touches[0].clientY - lastMousePos.current.y
      rotTarget.current.yaw += dx * 0.015
      rotTarget.current.pitch += dy * 0.015
      rotTarget.current.pitch = Math.max(-0.65, Math.min(0.65, rotTarget.current.pitch))
      lastMousePos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
  }

  // Loop Render Utama Canvas 60 FPS
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let clock = 0

    const render = () => {
      clock += 0.02

      const colors = getColors()
      const geom = geomRef.current
      const brain = brainRef.current
      const particles = particlesRef.current

      // Tangani Retina Hi-DPI
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
      const rect = canvas.getBoundingClientRect()
      const w = rect.width
      const h = rect.height

      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr)
        canvas.height = Math.round(h * dpr)
      }

      ctx.save()
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, w, h)

      // Lerp rotasi halus
      rotCurrent.current.yaw += (rotTarget.current.yaw - rotCurrent.current.yaw) * 0.1
      rotCurrent.current.pitch += (rotTarget.current.pitch - rotCurrent.current.pitch) * 0.1

      // Ambience hovering (kepala melayang perlahan jika tidak sedang di-drag)
      let ambientYaw = 0
      let ambientPitch = 0
      let ambientY = 0

      if (!isDragging) {
        ambientYaw = Math.sin(clock * 0.7) * 0.12
        ambientPitch = Math.cos(clock * 0.5) * 0.05
        ambientY = Math.sin(clock * 1.2) * 0.08
      }

      const totalYaw = rotCurrent.current.yaw + ambientYaw
      const totalPitch = rotCurrent.current.pitch + ambientPitch

      // Evaluasi sinyal audio live saat frame ini dirender
      const bandsLive = spektrumRef.current || []
      const curStatus = statusRef.current
      const isDemo = demoSpeakingRef.current

      const maxLive = Math.max(...bandsLive, 0)
      const avgLive = bandsLive.reduce((acc, v) => acc + v, 0) / (bandsLive.length || 1)

      // KONDISI MUTLAK: Animasi ngomong HANYA aktif saat ada sinyal suara/audio nyata
      const adaAudioLive = curStatus === 'speaking' && (maxLive > 0.04 || avgLive > 0.02)
      const animasiBicaraAktif = adaAudioLive || isDemo

      // 1. Hitung target bukaan mulut mentah (raw target)
      let rawTarget = 0
      if (isDemo) {
        // Irama bicara alami berlapis untuk demo/tes rekam konten
        const t = clock * 9
        const wave1 = Math.sin(t) * 0.5 + 0.5
        const wave2 = Math.sin(t * 2.1 + 1.2) * 0.5 + 0.5
        const wave3 = Math.sin(t * 0.5) * 0.5 + 0.5
        rawTarget = (wave1 * 0.45 + wave2 * 0.35 + wave3 * 0.2) * 0.35
      } else if (adaAudioLive) {
        // Pemetaan volume persepsi (square-root curve agar suara pelan tetap membuka mulut wajar)
        const linearEnergy = Math.max(0, (maxLive - 0.035) * 0.75 + (avgLive - 0.015) * 0.5)
        const perceptualVolume = Math.min(1.0, Math.sqrt(linearEnergy) * 0.95)
        // Modulasi silabel alami frekuensi 5Hz (fonem manusia)
        const phonemeMod = (Math.sin(clock * 16) * 0.5 + 0.5) * 0.1 * Math.min(1, perceptualVolume * 2)
        rawTarget = Math.min(0.38, perceptualVolume * 0.30 + phonemeMod)
      }

      // 2. Envelope Follower: Attack cepat (membuka lincah), Decay halus (menutup lembut tanpa tersentak)
      const coeff = rawTarget > smoothedAudioEnergyRef.current ? 0.32 : 0.14
      smoothedAudioEnergyRef.current += (rawTarget - smoothedAudioEnergyRef.current) * coeff

      // 3. Interpolasi Damped Spring pada sudut rahang
      const targetAngle = smoothedAudioEnergyRef.current
      const stepSpeed = targetAngle > jawAngleRef.current ? 0.30 : 0.16
      jawAngleRef.current += (targetAngle - jawAngleRef.current) * stepSpeed

      // Kunci ke 0 jika di bawah ambang mikro agar mulut benar-benar rapat saat hening
      if (jawAngleRef.current < 0.003) {
        jawAngleRef.current = 0
      }
      const jawAngle = jawAngleRef.current

      // Matriks Rotasi 3D
      const cosY = Math.cos(totalYaw)
      const sinY = Math.sin(totalYaw)
      const cosX = Math.cos(totalPitch)
      const sinX = Math.sin(totalPitch)

      const rotate3D = (p: Vec3): Vec3 => {
        let [x, y, z] = p
        y += ambientY

        // 1. Rotasi Yaw (sumbu Y)
        const x1 = x * cosY + z * sinY
        const z1 = -x * sinY + z * cosY
        const y1 = y

        // 2. Rotasi Pitch (sumbu X)
        const y2 = y1 * cosX - z1 * sinX
        const z2 = y1 * sinX + z1 * cosX
        const x2 = x1

        return [x2, y2, z2]
      }

      // Proyeksi Perspektif
      const cameraDist = 4.2
      const fov = isMukaDoang
        ? Math.min(w, h) * 1.42
        : compact
          ? Math.min(w, h) * 0.95
          : Math.min(w, h) * 1.18
      const centerX = w / 2
      const centerY = h / 2 - (isMukaDoang ? 14 : compact ? 0 : 8)

      const project = (p3: Vec3) => {
        const [x, y, z] = p3
        const depth = cameraDist - z
        const factor = fov / Math.max(0.2, depth)
        return {
          x: centerX + x * factor,
          y: centerY + y * factor,
          depth,
          factor,
        }
      }

      // --- LAYER 0: HOLOGRAPHIC PEDESTAL / BASE EMITTER (Proyektor Bawah) ---
      const baseRingY = 1.75
      ctx.save()
      ctx.strokeStyle = colors.primary
      ctx.lineWidth = 1.2
      ctx.globalAlpha = 0.35

      // Gambar elips proyektor dasar berputar
      const baseAngle = clock * 0.4
      const nBaseTicks = 16
      for (let i = 0; i < nBaseTicks; i++) {
        const ang = (i / nBaseTicks) * Math.PI * 2 + baseAngle
        const bx1 = Math.sin(ang) * 1.5
        const bz1 = Math.cos(ang) * 1.5
        const pBase1 = project(rotate3D([bx1, baseRingY, bz1]))
        const bx2 = Math.sin(ang) * 1.35
        const bz2 = Math.cos(ang) * 1.35
        const pBase2 = project(rotate3D([bx2, baseRingY, bz2]))
        ctx.beginPath()
        ctx.moveTo(pBase1.x, pBase1.y)
        ctx.lineTo(pBase2.x, pBase2.y)
        ctx.stroke()
      }

      // Sinar kerucut cahaya vertikal dari dasar ke leher
      const pNeck = project(rotate3D([0, 1.3, 0]))
      const gradBeam = ctx.createLinearGradient(centerX, centerY + 80, centerX, pNeck.y)
      gradBeam.addColorStop(0, 'transparent')
      gradBeam.addColorStop(1, `${colors.primary}18`)
      ctx.fillStyle = gradBeam
      ctx.beginPath()
      ctx.moveTo(centerX - 90, centerY + 100)
      ctx.lineTo(pNeck.x, pNeck.y)
      ctx.lineTo(centerX + 90, centerY + 100)
      ctx.closePath()
      ctx.fill()
      ctx.restore()

      // --- LAYER 1: PARTIKEL KUANTUM MELAYANG ---
      ctx.save()
      const spreadX = isMukaDoang || w > 700 ? 6.5 : 3.5
      particles.forEach((part) => {
        part.y += part.vy
        if (part.y < -2.4) {
          part.y = 2.4
          part.x = (Math.random() - 0.5) * spreadX
          part.z = (Math.random() - 0.5) * 3.5
        }
        const p3 = rotate3D([part.x, part.y, part.z])
        const proj = project(p3)
        if (proj.depth > 0) {
          const pAlpha = Math.max(0.1, Math.min(0.8, (1 - proj.depth / 6) * part.alpha))
          ctx.fillStyle = colors.primary
          ctx.globalAlpha = pAlpha
          ctx.beginPath()
          ctx.arc(proj.x, proj.y, part.size * (proj.factor / 300), 0, Math.PI * 2)
          ctx.fill()
        }
      })
      ctx.restore()

      // --- LAYER 2: ORBITAL HUD GIMBAL RINGS (Cincin Data Hologram 3D) ---
      ctx.save()
      const nRingSegments = 36
      const ringRadius = 1.65
      const ringTilt = 0.22
      const ringSpin = clock * 0.35

      ctx.lineWidth = 1.0
      ctx.strokeStyle = colors.primary
      ctx.globalAlpha = 0.35

      ctx.beginPath()
      for (let i = 0; i <= nRingSegments; i++) {
        const ang = (i / nRingSegments) * Math.PI * 2 + ringSpin
        const rx = Math.cos(ang) * ringRadius
        const rz = Math.sin(ang) * ringRadius
        const ry = Math.sin(ang) * ringTilt * ringRadius - 0.2
        const pProj = project(rotate3D([rx, ry, rz]))
        if (i === 0) {
          ctx.moveTo(pProj.x, pProj.y)
        } else {
          ctx.lineTo(pProj.x, pProj.y)
        }
      }
      ctx.stroke()

      // Tanda Derajat & Tick Pada Cincin Orbit
      for (let i = 0; i < 12; i++) {
        const ang = (i / 12) * Math.PI * 2 + ringSpin
        const rx1 = Math.cos(ang) * ringRadius
        const rz1 = Math.sin(ang) * ringRadius
        const ry1 = Math.sin(ang) * ringTilt * ringRadius - 0.2
        const rx2 = Math.cos(ang) * (ringRadius + 0.12)
        const rz2 = Math.sin(ang) * (ringRadius + 0.12)
        const ry2 = ry1
        const pt1 = project(rotate3D([rx1, ry1, rz1]))
        const pt2 = project(rotate3D([rx2, ry2, rz2]))
        ctx.beginPath()
        ctx.moveTo(pt1.x, pt1.y)
        ctx.lineTo(pt2.x, pt2.y)
        ctx.stroke()
      }
      ctx.restore()

      // --- LAYER 3: OTAK NEURAL 3D (CORTEX DENGAN SINAPSIS BERKEDIP & IMPULS BERGERAK) ---
      // Hitung posisi node otak setelah rotasi
      const brainNodesProj = brain.nodes.map((node, nIdx) => {
        // Otak berdenyut saat processing atau saat berbicara dan ada audio
        let nodePulse = 1.0
        if (curStatus === 'processing') {
          nodePulse = 1.0 + Math.sin(clock * 18 + nIdx) * 0.15
        } else if (animasiBicaraAktif && jawAngle > 0.05) {
          nodePulse = 1.0 + Math.sin(clock * 12 + nIdx * 2) * (0.06 + jawAngle * 0.18)
        }
        const pos: Vec3 = [
          node.pos[0] * nodePulse,
          node.pos[1] * nodePulse,
          node.pos[2] * nodePulse,
        ]
        const rot = rotate3D(pos)
        return {
          ...project(rot),
          z: rot[2],
          orig: node,
        }
      })

      // Gambar Sinapsis Otak (Akson penghubung)
      ctx.save()
      brain.synapses.forEach((syn) => {
        const p1 = brainNodesProj[syn.from]
        const p2 = brainNodesProj[syn.to]
        if (!p1 || !p2) return

        const avgZ = (p1.z + p2.z) / 2
        const synAlpha = Math.max(0.12, Math.min(0.65, 0.4 + avgZ * 0.2))

        ctx.strokeStyle = colors.brain
        ctx.lineWidth = 0.8
        ctx.globalAlpha = synAlpha
        ctx.beginPath()
        ctx.moveTo(p1.x, p1.y)
        ctx.lineTo(p2.x, p2.y)
        ctx.stroke()

        // IMPULS SINAPTIK BERGERAK (Cahaya photon berjalan antar neuron)
        const speedMult = curStatus === 'processing' ? 3.2 : (animasiBicaraAktif && jawAngle > 0.05) ? 2.2 : 1.0
        syn.signalProgress = (syn.signalProgress + syn.speed * speedMult) % 1.0
        const sigX = p1.x + (p2.x - p1.x) * syn.signalProgress
        const sigY = p1.y + (p2.y - p1.y) * syn.signalProgress

        ctx.fillStyle = colors.core
        ctx.globalAlpha = Math.min(1.0, synAlpha * 1.8)
        ctx.beginPath()
        ctx.arc(sigX, sigY, 1.8 * (p1.factor / 300), 0, Math.PI * 2)
        ctx.fill()
      })

      // Gambar Node Neuron Otak
      brainNodesProj.forEach((np) => {
        const nAlpha = Math.max(0.2, Math.min(0.95, 0.55 + np.z * 0.25))
        const nodeSize = np.orig.size * (np.factor / 300)

        // Glow halo di sekitar neuron saat berpikir atau saat ada suara
        if (curStatus === 'processing' || (animasiBicaraAktif && jawAngle > 0.05)) {
          ctx.fillStyle = colors.primary
          ctx.globalAlpha = nAlpha * 0.4
          ctx.beginPath()
          ctx.arc(np.x, np.y, nodeSize * 2.2, 0, Math.PI * 2)
          ctx.fill()
        }

        ctx.fillStyle = colors.core
        ctx.globalAlpha = nAlpha
        ctx.beginPath()
        ctx.arc(np.x, np.y, nodeSize, 0, Math.PI * 2)
        ctx.fill()
      })
      ctx.restore()

      // --- LAYER 4: STRUKTUR TENGKORAK & RAHANG CYBERNETIC (WIREFRAME 3D) ---
      // Update posisi titik rahang yang berartikulasi
      const currentVertices = geom.baseVertices.map((v, idx) => {
        // Cek apakah vertex ini milik rahang bawah
        if (geom.jawIndices.includes(idx)) {
          // Rotasi titik rahang terhadap engsel TMJ
          const dy = v[1] - geom.jawPivotY
          const dz = v[2] - geom.jawPivotZ

          // Rotasi sudut rahang ke bawah
          const cosJ = Math.cos(jawAngle)
          const sinJ = Math.sin(jawAngle)
          const newY = geom.jawPivotY + (dy * cosJ - dz * sinJ)
          const newZ = geom.jawPivotZ + (dy * sinJ + dz * cosJ)

          // Penyesuaian elastisitas lateral natural saat rahang membuka
          const xElastic = v[0] * (1 - jawAngle * 0.08)
          return [xElastic, newY, newZ] as Vec3
        }
        return v
      })

      // Proyeksikan seluruh vertex kepala ke layar 2D
      const projectedVerts = currentVertices.map((v) => {
        const rot = rotate3D(v)
        return {
          ...project(rot),
          z: rot[2],
        }
      })

      // Gambar Garis Wireframe Kepala dengan Efek Kedalaman Z
      ctx.save()
      geom.edges.forEach(([i1, i2]) => {
        const v1 = projectedVerts[i1]
        const v2 = projectedVerts[i2]
        if (!v1 || !v2) return

        const avgZ = (v1.z + v2.z) / 2
        // Titik lebih depan lebih tebal & bercahaya, titik di belakang lebih tipis & transparan
        const depthFactor = Math.max(0.15, Math.min(1.0, (avgZ + 1.2) / 2.4))
        const lineAlpha = 0.25 + depthFactor * 0.65
        const lineWidth = 0.8 + depthFactor * 1.5

        ctx.strokeStyle = colors.primary
        ctx.lineWidth = lineWidth
        ctx.globalAlpha = lineAlpha
        ctx.beginPath()
        ctx.moveTo(v1.x, v1.y)
        ctx.lineTo(v2.x, v2.y)
        ctx.stroke()
      })

      // Titik-titik persimpangan (Cybernetic Nodes)
      projectedVerts.forEach((pv) => {
        const depthFactor = Math.max(0.15, Math.min(1.0, (pv.z + 1.2) / 2.4))
        if (depthFactor > 0.4) {
          ctx.fillStyle = colors.core
          ctx.globalAlpha = depthFactor * 0.8
          ctx.beginPath()
          ctx.arc(pv.x, pv.y, 1.4 * depthFactor, 0, Math.PI * 2)
          ctx.fill()
        }
      })
      ctx.restore()

      // --- LAYER 5: VISOR MATA CYBER & SCAN BEAM (PUPIL LASER) ---
      ctx.save()
      const eyeL = projectedVerts[geom.eyeLeftCore]
      const eyeR = projectedVerts[geom.eyeRightCore]

      if (eyeL && eyeR) {
        ;[eyeL, eyeR].forEach((eyePt) => {
          // Glow intensif mata
          const glowGrad = ctx.createRadialGradient(
            eyePt.x,
            eyePt.y,
            1,
            eyePt.x,
            eyePt.y,
            compact ? 12 : 20
          )
          glowGrad.addColorStop(0, colors.eye)
          glowGrad.addColorStop(0.4, `${colors.primary}99`)
          glowGrad.addColorStop(1, 'transparent')

          ctx.fillStyle = glowGrad
          ctx.globalAlpha = 0.85
          ctx.beginPath()
          ctx.arc(eyePt.x, eyePt.y, compact ? 12 : 20, 0, Math.PI * 2)
          ctx.fill()

          // Inti pupil bercahaya terang
          ctx.fillStyle = '#ffffff'
          ctx.globalAlpha = 1.0
          ctx.beginPath()
          ctx.arc(eyePt.x, eyePt.y, 2.5, 0, Math.PI * 2)
          ctx.fill()
        })

        // Garis sinar horizontal visor antar mata (Cyber Optic Beam)
        ctx.strokeStyle = colors.primary
        ctx.lineWidth = 1.5
        ctx.globalAlpha = 0.7
        ctx.beginPath()
        ctx.moveTo(eyeL.x - 15, eyeL.y)
        ctx.lineTo(eyeR.x + 15, eyeR.y)
        ctx.stroke()
      }
      ctx.restore()

      // --- LAYER 6: GELOMBANG SUARA SAAT NGOMONG (ACOUSTIC SHOCKWAVE FROM MOUTH) ---
      // HANYA digambar jika mulut benar-benar sedang membuka (jawAngle > 0.03)
      if (jawAngle > 0.03) {
        ctx.save()
        const mouthU = projectedVerts[geom.mouthCenterUpper]
        const mouthL = projectedVerts[geom.mouthCenterLower]
        if (mouthU && mouthL) {
          const mouthMidX = (mouthU.x + mouthL.x) / 2
          const mouthMidY = (mouthU.y + mouthL.y) / 2
          const mouthGap = Math.abs(mouthL.y - mouthU.y)

          // 1. Equalizer Waveform Halus & Fluid di antara bibir atas & bawah
          ctx.strokeStyle = '#ffffff'
          ctx.lineWidth = 1.6
          ctx.globalAlpha = Math.min(0.95, jawAngle * 2.8)
          ctx.beginPath()

          const waveWidth = compact ? 26 : 34
          const startX = mouthMidX - waveWidth / 2
          const nSegments = 16

          for (let i = 0; i <= nSegments; i++) {
            const u = i / nSegments
            const wx = startX + u * waveWidth
            // Hanning window agar ujung kiri & kanan menyatu mulus di sudut bibir
            const hanning = Math.sin(u * Math.PI)
            const waveY =
              Math.sin(clock * 14 + u * 8) * (mouthGap * 0.42) * hanning +
              Math.sin(clock * 22 + u * 12) * (mouthGap * 0.22) * hanning
            const wy = mouthMidY + waveY
            if (i === 0) ctx.moveTo(wx, wy)
            else ctx.lineTo(wx, wy)
          }
          ctx.stroke()

          // 2. Halo Glow Lembut di dalam rongga mulut saat vokal berbunyi
          const glowGrad = ctx.createRadialGradient(
            mouthMidX,
            mouthMidY,
            1,
            mouthMidX,
            mouthMidY,
            waveWidth * 0.55
          )
          glowGrad.addColorStop(0, `${colors.primary}55`)
          glowGrad.addColorStop(1, 'transparent')
          ctx.fillStyle = glowGrad
          ctx.beginPath()
          ctx.arc(mouthMidX, mouthMidY, waveWidth * 0.55, 0, Math.PI * 2)
          ctx.fill()

          // 3. Tiga cincin sonar merambat ke depan (hanya jika artikulasi vokal kuat)
          if (jawAngle > 0.07) {
            const waveCount = 3
            for (let wIdx = 0; wIdx < waveCount; wIdx++) {
              const wavePhase = (clock * 1.4 + wIdx / waveCount) % 1.0
              const ringRadius = 12 + wavePhase * (compact ? 42 : 72)
              const ringAlpha = (1 - wavePhase) * Math.min(0.65, jawAngle * 2.0)

              ctx.strokeStyle = colors.primary
              ctx.lineWidth = 1.5 * (1 - wavePhase)
              ctx.globalAlpha = ringAlpha
              ctx.beginPath()
              ctx.ellipse(
                mouthMidX,
                mouthMidY + 3,
                ringRadius,
                ringRadius * 0.42,
                totalPitch * 0.45,
                0,
                Math.PI * 2
              )
              ctx.stroke()
            }
          }
        }
        ctx.restore()
      }

      // --- LAYER 6.5: HOLOGRAPHIC SCAN BEAM SWEEP ---
      ctx.save()
      const scanPeriod = (clock * 0.4) % 1.0
      const scanY = h * scanPeriod
      const scanGrad = ctx.createLinearGradient(0, scanY - 14, 0, scanY + 14)
      scanGrad.addColorStop(0, 'transparent')
      scanGrad.addColorStop(0.5, `${colors.primary}33`)
      scanGrad.addColorStop(1, 'transparent')
      ctx.fillStyle = scanGrad
      ctx.fillRect(0, scanY - 14, w, 28)

      ctx.strokeStyle = colors.primary
      ctx.lineWidth = 1.0
      ctx.globalAlpha = 0.45
      ctx.beginPath()
      ctx.moveTo(w * 0.1, scanY)
      ctx.lineTo(w * 0.9, scanY)
      ctx.stroke()
      ctx.restore()

      // Clean canvas finish: 3D Hologram renders flawlessly without text or frame obstructions
      ctx.restore()
      animId = requestAnimationFrame(render)
    }

    animId = requestAnimationFrame(render)
    return () => cancelAnimationFrame(animId)
  }, [compact, getColors, isDragging])

  const colors = getColors()

  const handleKlikCore = () => {
    mainkanSuaraHud('engage')
    onClickCore?.()
  }

  const effectiveSizeMode = sizeMode || (isMukaDoang ? 'muka-doang' : compact ? 'compact' : 'large')

  const containerSizeClass =
    effectiveSizeMode === 'muka-doang'
      ? 'w-full h-full max-w-[98vw] max-h-[84vh] min-h-[480px]'
      : effectiveSizeMode === 'large'
        ? 'w-[320px] h-[320px] sm:w-[400px] sm:h-[400px] md:w-[480px] md:h-[480px] lg:w-[560px] lg:h-[560px] xl:w-[620px] xl:h-[620px] max-w-[min(100%,60vh)] max-h-[60vh] aspect-square'
        : effectiveSizeMode === 'compact'
          ? 'w-[140px] h-[140px] sm:w-[165px] sm:h-[165px] lg:w-[185px] lg:h-[185px] max-w-[min(100%,22vh)] max-h-[22vh] aspect-square'
          : 'w-[220px] h-[220px] sm:w-[250px] sm:h-[250px] md:w-[280px] md:h-[280px] lg:w-[320px] lg:h-[320px] xl:w-[340px] xl:h-[340px] max-w-[min(100%,35vh)] max-h-[35vh] aspect-square'

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col items-center justify-center select-none py-1 w-full transition-all duration-300 ${
        isMukaDoang ? 'h-full flex-1' : ''
      }`}
    >
      {/* 3D Canvas Reticle Box */}
      <div
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
        onDoubleClick={(e) => {
          e.stopPropagation()
          mainkanSuaraHud('chirp')
          onToggleMukaDoang?.()
        }}
        className={`relative flex items-center justify-center transition-all duration-300 ${containerSizeClass} cursor-grab active:cursor-grabbing group`}
        title="Klik / Double-klik untuk Mode Muka Doang // Geser / Drag untuk putar kepala 3D"
      >
        {/* Ambient Halo Glow */}
        <div
          className="absolute inset-[15%] rounded-full blur-3xl opacity-35 transition-all duration-500 pointer-events-none"
          style={{ backgroundColor: colors.primary }}
        />

        {/* Canvas Render 3D */}
        <canvas
          ref={canvasRef}
          className="w-full h-full z-10 block pointer-events-auto"
          style={{ touchAction: 'none' }}
        />

        {/* Tombol Interaktif Click-To-Speak Overlay di Tengah Dasar */}
        <button
          type="button"
          onClick={handleKlikCore}
          className="absolute bottom-2 z-20 px-3 py-1 rounded-full bg-zinc-950/90 hover:bg-cyan-950 border border-cyan-400/60 text-cyan-200 hover:text-white font-hud text-[10px] tracking-wider uppercase font-bold flex items-center gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all cursor-pointer group-hover:scale-105"
        >
          {status === 'listening' ? (
            <>
              <Mic className="w-3 h-3 text-emerald-400 animate-bounce" />
              <span className="text-emerald-300">LISTENING...</span>
            </>
          ) : status === 'speaking' ? (
            <>
              <Volume2 className={`w-3 h-3 text-cyan-300 ${adaAudioNyata ? 'animate-pulse' : ''}`} />
              <span className="text-cyan-200">
                {adaAudioNyata ? 'SPEAKING (KLIK STOP)' : 'AUDIO ACTIVE (KLIK STOP)'}
              </span>
            </>
          ) : (
            <>
              <Mic className="w-3 h-3 text-cyan-300" />
              <span>KLIK BICARA</span>
            </>
          )}
        </button>
      </div>

      {/* Bubble Transkrip Suara Live */}
      {transkripLive && (
        <div className="mt-1 px-3 py-1 rounded-xl bg-emerald-950/90 border border-emerald-400/60 text-emerald-100 font-mono-hud text-xs max-w-md text-center shadow-[0_0_20px_rgba(16,185,129,0.3)] animate-in fade-in flex items-center justify-center gap-1.5 z-20">
          <Mic className="size-3.5 text-emerald-400 shrink-0" />
          <span className="text-emerald-400 font-bold">INPUT SUARA:</span>
          <span>&ldquo;{transkripLive.replace(/^🎙️\s*/, '')}&rdquo;</span>
        </div>
      )}

      {/* Status Badge & Kontrol Aksi Bawah */}
      <div className="mt-1 flex flex-col items-center text-center w-full max-w-lg px-2 z-20">
        {!compact && (
          <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-cyan-950/70 border border-cyan-400/40 backdrop-blur-md shadow-[0_0_15px_rgba(6,182,212,0.2)]">
            <span
              className="w-2 h-2 rounded-full animate-ping shrink-0"
              style={{ backgroundColor: colors.primary }}
            />
            <span className="font-hud text-[10px] sm:text-xs uppercase tracking-widest text-cyan-100 font-bold truncate">
              {status === 'listening'
                ? 'LISTENING // SILAKAN BICARA'
                : status === 'processing'
                  ? 'SYNCHRONIZING LIVE DATA...'
                  : status === 'speaking'
                    ? adaAudioNyata
                      ? 'J.A.R.V.I.S. MERESPON (KLIK POTONG)'
                      : 'AUDIO ACTIVE (KLIK POTONG)'
                    : status === 'warning'
                      ? 'ANOMALY DETECTED // SIAGA'
                      : voiceLoopAktif
                        ? 'VOICE LOOP STANDBY // SIAP MENDENGAR'
                        : 'J.A.R.V.I.S. 3D HOLOGRAM AVATAR READY'}
            </span>
          </div>
        )}

        {/* Tombol Tindakan Cepat */}
        {tampilkanTombolBawah && !isMukaDoang && (
          <div className="flex items-center justify-center gap-2 mt-1.5">
            <button
              type="button"
              onClick={handleKlikCore}
              className={`px-3 py-1.5 rounded-lg border font-hud text-[10px] sm:text-xs tracking-wider uppercase font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                voiceLoopAktif || status === 'listening'
                  ? 'bg-emerald-600/90 border-emerald-300 text-white shadow-[0_0_18px_rgba(16,185,129,0.45)]'
                  : 'bg-cyan-950/80 hover:bg-cyan-900/90 border-cyan-400/50 text-cyan-200'
              }`}
            >
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span>{voiceLoopAktif ? 'VOICE LOOP: ON' : 'VOICE-TO-VOICE'}</span>
            </button>

            {onBukaDailyBriefing && (
              <button
                type="button"
                onClick={() => {
                  mainkanSuaraHud('engage')
                  onBukaDailyBriefing()
                }}
                className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600/80 to-blue-600/80 hover:from-cyan-500 hover:to-blue-500 border border-cyan-300/60 text-white font-hud text-[10px] sm:text-xs tracking-wider uppercase font-bold transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] flex items-center gap-1.5 cursor-pointer"
              >
                <FileBarChart2 className="w-3.5 h-3.5" />
                <span>LAPORAN DAILY</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
