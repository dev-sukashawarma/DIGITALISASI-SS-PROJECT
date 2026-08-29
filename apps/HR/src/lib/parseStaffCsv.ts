import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import type { Outlet, Role, StaffStatus } from './types'

export interface ParsedStaffRow {
  no?: string | number
  name: string
  username: string
  role: Role
  positionLabel: string
  status: StaffStatus
  statusLabel: string
  contractType: 'permanent' | 'contract' | 'intern' | 'daily'
  outletId: string
  outletName: string
  isOutletMatched: boolean
  basicSalary: number
  mealAllowance: number
  allowancePresence: number
  overtime: number
  cashAdvance: number
  compensation: number
  totalSalary: number
  paymentStatus: 'PAID' | 'UNPAID'
  phone?: string
  bankName?: string
  bankAccountNumber?: string
  bankAccountName?: string
}

function parseCurrency(val: any): number {
  if (typeof val === 'number') return val
  if (!val) return 0
  const clean = String(val).replace(/[^0-9]/g, '')
  return Number(clean) || 0
}

function cleanString(val: any): string {
  return String(val ?? '').trim().replace(/\s+/g, ' ')
}

export const KNOWN_STAFF_MAPPINGS: Record<string, string> = {
  'roni': 'roni',
  'muhamad andrian hermawan': 'andrian',
  'm. tajudin': 'tajudin',
  'm tajudin': 'tajudin',
  'abdurrohman': 'rohman',
  'abdurrahman': 'abdurrahman',
  'abu bakar sidik bahsin': 'abubakar',
  'abu bakar': 'abubakar',
  'tri rizky pamungkas': 'tririzky',
  'tri rizky': 'tririzky',
  'faturrahman': 'fatur',
  'muhammad abyansah mandala': 'abyansah',
  'abyansah': 'abyansah',
  'm. rifqi darmawan': 'mrifqi',
  'm.rifqi darmawan': 'mrifqi',
  'm.rifqi': 'mrifqi',
  'rifqi': 'rifqi',
  'muhamad reza meisandi': 'reza',
  'reza': 'reza',
  'irwan kurniawan': 'irwan',
  'yunus': 'yunus',
  'mulyadi': 'mulyadi',
  'muhtar arifin': 'muchtar',
  'schatzi sayyid abiyyu': 'sayid',
  'abdul qadir': 'abdul',
  'abdul kadir': 'abdul',
  'achmad luthfi': 'lutfi',
  'lutfi': 'lutfi',
  'indra irawan': 'adminhr',
  'agung wardhana': 'agung',
  'adhi setiawan': 'adi',
  'ikbal darmansyah': 'iqbal',
  'zikri sawaludin': 'zikri',
  'm. fadli irawan': 'fadli',
  'm fadli irawan': 'fadli',
  'indra adam sami': 'adamspv',
  'chairul rizki': 'ricki',
}

export function generateUsernameFromName(name: string, index: number, existingUsernames: Set<string>): string {
  const cleanKey = name.toLowerCase().trim().replace(/\s+/g, ' ')
  if (KNOWN_STAFF_MAPPINGS[cleanKey]) {
    const mapped = KNOWN_STAFF_MAPPINGS[cleanKey]
    existingUsernames.add(mapped)
    return mapped
  }

  let base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')

  if (!base) base = `staff_${index}`
  let username = base
  let counter = 2
  while (existingUsernames.has(username)) {
    username = `${base}_${counter}`
    counter++
  }
  existingUsernames.add(username)
  return username
}

export function mapPositionToRole(pos: string): { role: Role; label: string } {
  const p = pos.toUpperCase().trim()
  if (p.includes('DRIVER')) return { role: 'staff_pusat', label: 'Driver Operasional' }
  if (p.includes('KITCHEN')) return { role: 'kitchen', label: 'Kitchen Crew' }
  if (p.includes('OUTLET CREW') || p === 'CREW') return { role: 'crew', label: 'Outlet Crew' }
  if (p.includes('KORLAP') || p.includes('AREA MANAGER') || p.includes('FC'))
    return { role: 'area_manager', label: 'Korlap / Area Manager' }
  if (p.includes('STOCK CONTROLLER') || p.includes('SC'))
    return { role: 'spv', label: 'Stock Controller' }
  if (p.includes('SPV') || p.includes('SUPERVISOR')) return { role: 'spv', label: 'Supervisor' }
  if (p.includes('LEADER')) return { role: 'leader', label: 'Outlet Leader' }
  if (p.includes('HRD') || p.includes('ADMIN_HR') || p === 'HR') return { role: 'admin_hr', label: 'Admin HRD' }
  if (p.includes('FINANCE') || p.includes('KEUANGAN')) return { role: 'admin_finance', label: 'Admin Finance' }
  if (p.includes('PURCHASING')) return { role: 'purchasing', label: 'Purchasing' }
  if (
    p.includes('ADMIN') ||
    p.includes('ADMINISTRASI') ||
    p.includes('MARCOM') ||
    p.includes('MARKETING') ||
    p.includes('CS') ||
    p.includes('SS ONLINE')
  )
    return { role: 'staff_pusat', label: 'Staff Pusat / Office' }
  return { role: 'crew', label: pos || 'Staff' }
}

export function mapStatus(stat: string): { status: StaffStatus; contractType: 'permanent' | 'contract' | 'intern' | 'daily'; label: string } {
  const s = stat.toUpperCase().trim()
  if (s.includes('TRAINEE') || s.includes('MAGANG') || s.includes('INTERN')) {
    return { status: 'active', contractType: 'intern', label: 'Trainee' }
  }
  if (s.includes('RESIGN') || s.includes('EXPEL') || s.includes('KELUAR') || s.includes('NONAKTIF')) {
    return { status: 'inactive', contractType: 'contract', label: 'Non-Aktif' }
  }
  if (s.includes('TETAP') || s.includes('PERMANENT')) {
    return { status: 'active', contractType: 'permanent', label: 'Tetap' }
  }
  return { status: 'active', contractType: 'contract', label: 'Full Time (Kontrak)' }
}

export function matchOutlet(
  loc: string,
  outlets: Outlet[],
  role?: Role
): { outletId: string; outletName: string; isMatched: boolean } {
  const kantorPusat =
    outlets.find((o) => o.name.toUpperCase() === 'KANTOR PUSAT') ||
    outlets.find((o) => o.name.toUpperCase().includes('KANTOR PUSAT')) ||
    outlets.find((o) => o.name.toUpperCase().includes('PUSAT')) ||
    outlets[0]

  if (
    role === 'staff_pusat' ||
    role === 'admin_hr' ||
    role === 'admin' ||
    role === 'admin_finance' ||
    role === 'purchasing'
  ) {
    return {
      outletId: kantorPusat ? kantorPusat.id : (outlets[0]?.id || ''),
      outletName: kantorPusat ? kantorPusat.name : (outlets[0]?.name || 'KANTOR PUSAT'),
      isMatched: true,
    }
  }

  const l = loc.toUpperCase().trim()
  if (!l || l === 'OFFICE' || l === 'REGION' || l.includes('KORLAP') || l.includes('PUSAT')) {
    return {
      outletId: kantorPusat ? kantorPusat.id : (outlets[0]?.id || ''),
      outletName: kantorPusat ? kantorPusat.name : (outlets[0]?.name || 'KANTOR PUSAT'),
      isMatched: true,
    }
  }

  // Find by substring match
  // e.g. "SS EMPANG" -> "SUKA SHAWARMA EMPANG"
  const cleanLoc = l.replace(/^SS\s+/, '').replace(/^MITRA\s+/, '').trim()
  const matched = outlets.find((o) => {
    const oName = o.name.toUpperCase()
    return oName.includes(cleanLoc) || cleanLoc.includes(oName)
  })

  if (matched) {
    return {
      outletId: matched.id,
      outletName: matched.name,
      isMatched: true,
    }
  }

  // Fallback
  return {
    outletId: kantorPusat?.id || outlets[0]?.id || '',
    outletName: kantorPusat?.name || outlets[0]?.name || 'KANTOR PUSAT',
    isMatched: false,
  }
}

/**
 * Parse Raw CSV / Array of rows into structured ParsedStaffRow
 */
export function parseRawStaffRows(rawRows: any[], outlets: Outlet[]): ParsedStaffRow[] {
  const existingUsernames = new Set<string>()
  const results: ParsedStaffRow[] = []

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i]
    if (!row) continue

    // Normalize keys (uppercase, trim)
    const normalized: Record<string, any> = {}
    Object.keys(row).forEach((k) => {
      normalized[k.trim().toUpperCase()] = row[k]
    })

    const name = cleanString(
      normalized['NAME'] || normalized['NAMA'] || normalized['NAMA KARYAWAN'] || normalized['NAMA LENGKAP'] || ''
    )
    if (!name || name.toLowerCase().includes('total') || name === 'NAME') continue

    const positionRaw = cleanString(normalized['POSITION'] || normalized['JABATAN'] || normalized['ROLE'] || '')
    const statusRaw = cleanString(normalized['STATUS'] || normalized['STATUS KARYAWAN'] || '')
    const locationRaw = cleanString(normalized['LOCATION'] || normalized['OUTLET'] || normalized['LOKASI'] || '')
    
    const basicSalary = parseCurrency(
      normalized['BASE SALARY'] || normalized['GAJI POKOK'] || normalized['BASIC SALARY'] || normalized['GAJI']
    )
    const mealAllowance = parseCurrency(
      normalized['MEAL ALLOWANCE'] || normalized['TUNJANGAN MAKAN'] || normalized['TUNJANGAN KEHADIRAN'] || normalized['TUNJANGAN']
    )
    const overtime = parseCurrency(
      normalized['OVERTIME'] || normalized['LEMBUR'] || normalized['BONUS']
    )
    const cashAdvance = parseCurrency(
      normalized['CASH ADV (KASBON)'] || normalized['CASH ADV'] || normalized['KASBON'] || normalized['CASH ADVANCE']
    )
    const compensation = parseCurrency(
      normalized['COMPENSATION (GANTI RUGI)'] || normalized['COMPENSATION'] || normalized['GANTI RUGI'] || normalized['DENDA']
    )
    const totalSalaryRaw = parseCurrency(
      normalized['TOTAL SALARY'] || normalized['TOTAL GAJI'] || normalized['THP'] || normalized['TOTAL']
    )
    const calculatedTotal = basicSalary + mealAllowance + overtime - cashAdvance - compensation
    const totalSalary = totalSalaryRaw > 0 ? totalSalaryRaw : calculatedTotal

    const payStatRaw = cleanString(normalized['PAYMENT STATUS'] || normalized['STATUS PEMBAYARAN'] || '').toUpperCase()
    const paymentStatus: 'PAID' | 'UNPAID' = payStatRaw.includes('UNPAID') || payStatRaw.includes('BELUM') ? 'UNPAID' : 'PAID'

    const phone = cleanString(normalized['PHONE'] || normalized['NO HP'] || normalized['WHATSAPP'] || normalized['NO WA'] || '')
    const bankName = cleanString(normalized['BANK'] || normalized['NAMA BANK'] || '')
    const bankAcc = cleanString(normalized['REKENING'] || normalized['NO REKENING'] || normalized['NO REK'] || '')
    const bankAccName = cleanString(normalized['ATAS NAMA'] || normalized['NAMA REKENING'] || '')

    const { role, label: positionLabel } = mapPositionToRole(positionRaw)
    const { status, contractType, label: statusLabel } = mapStatus(statusRaw)
    const { outletId, outletName, isMatched } = matchOutlet(locationRaw, outlets, role)
    const username = generateUsernameFromName(name, i + 1, existingUsernames)

    results.push({
      no: normalized['NO'] || i + 1,
      name,
      username,
      role,
      positionLabel,
      status,
      statusLabel,
      contractType,
      outletId,
      outletName,
      isOutletMatched: isMatched,
      basicSalary,
      mealAllowance,
      allowancePresence: mealAllowance,
      overtime,
      cashAdvance,
      compensation,
      totalSalary,
      paymentStatus,
      phone: phone || undefined,
      bankName: bankName || undefined,
      bankAccountNumber: bankAcc || undefined,
      bankAccountName: bankAccName || undefined,
    })
  }

  return results
}

/**
 * Parse File (CSV or Excel) in browser
 */
export async function parseStaffFile(file: File, outlets: Outlet[]): Promise<ParsedStaffRow[]> {
  const fileName = file.name.toLowerCase()

  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    const data = await file.arrayBuffer()
    const workbook = XLSX.read(data, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' })
    return parseRawStaffRows(rawRows, outlets)
  }

  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const parsed = parseRawStaffRows(results.data, outlets)
          resolve(parsed)
        } catch (err) {
          reject(err)
        }
      },
      error: (error) => reject(error),
    })
  })
}
