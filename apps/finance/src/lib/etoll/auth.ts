import { getVerifiedUserId } from '@suka/auth'
import { createServerComponentClient } from '@/lib/supabase-server'
import { getServiceSupabase } from '@/lib/supabase-service'

const FINANCE_ROLES = new Set(['admin_finance', 'admin', 'owner', 'developer'])
const CARD_REGISTRAR_ROLES = new Set(['admin_finance', 'developer'])

export interface EtollActor {
  userId: string
  name: string
  role: string
  isFinance: boolean
  canRegisterCard: boolean
}

export class EtollAuthError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

/**
 * Otentikasi dual-mode untuk API e-Toll:
 * 1. Android SuperApp: header `Authorization: Bearer <supabase_access_token>`
 * 2. Web Dashboard apps/finance: sesi cookie SSO `@suka/auth`
 *
 * `userId` selalu diambil dari token/sesi terverifikasi — tidak pernah dari body request.
 */
export async function requireEtollActor(
  req: Request,
  options?: { financeOnly?: boolean; cardRegistrarOnly?: boolean },
): Promise<EtollActor> {
  const admin = getServiceSupabase()
  let userId: string | null = null

  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization')
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim()
    if (!token) {
      throw new EtollAuthError('Unauthorized: token kosong', 401)
    }
    const { data, error } = await admin.auth.getUser(token)
    if (error || !data?.user?.id) {
      throw new EtollAuthError('Unauthorized: sesi token tidak valid atau kadaluarsa', 401)
    }
    userId = data.user.id
  } else {
    const authedClient = await createServerComponentClient()
    userId = await getVerifiedUserId(authedClient)
  }

  if (!userId) {
    throw new EtollAuthError('Unauthorized: sesi tidak ditemukan', 401)
  }

  const { data: staff, error: staffError } = await admin
    .from('outlet_staff')
    .select('id, name, role, status')
    .eq('id', userId)
    .maybeSingle()

  if (staffError) {
    throw new EtollAuthError(staffError.message, 500)
  }
  if (!staff || staff.status !== 'active') {
    throw new EtollAuthError('Forbidden: akun staff tidak aktif atau tidak ditemukan', 403)
  }

  const isFinance = FINANCE_ROLES.has(staff.role)
  const canRegisterCard = CARD_REGISTRAR_ROLES.has(staff.role)
  if (options?.cardRegistrarOnly && !canRegisterCard) {
    throw new EtollAuthError(
      'Forbidden: pendaftaran & pengelolaan kartu e-Toll hanya untuk role admin_finance / developer',
      403,
    )
  }
  if (options?.financeOnly && !isFinance) {
    throw new EtollAuthError('Forbidden: aksi ini khusus tim Finance / Admin', 403)
  }

  return {
    userId: staff.id,
    name: staff.name,
    role: staff.role,
    isFinance,
    canRegisterCard,
  }
}
