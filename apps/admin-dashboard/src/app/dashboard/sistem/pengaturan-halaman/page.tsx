import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getVerifiedUserId } from '@suka/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { PengaturanHalamanView } from './PengaturanHalamanView'
import type { MitraMaintenanceConfig } from '@/lib/maintenance/mitraMaintenance'

export const dynamic = 'force-dynamic'

export default async function PengaturanHalamanPage() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })

  const userId = await getVerifiedUserId(supabase)
  if (!userId) {
    redirect('/login')
  }

  // Khusus akun Developer
  const { data: staff } = await supabase
    .from('outlet_staff')
    .select('role, name, status')
    .eq('id', userId)
    .maybeSingle()

  if (!staff || staff.status !== 'active' || staff.role?.toLowerCase() !== 'developer') {
    redirect('/dashboard')
  }

  // Fetch initial configuration from global_settings
  const svc = createServiceClient()
  const { data: settingRow } = await svc
    .from('global_settings')
    .select('value')
    .eq('key', 'mitra_maintenance_config')
    .maybeSingle()

  const rawVal = (settingRow?.value || {}) as any
  const initialConfig: MitraMaintenanceConfig = {
    is_active: Boolean(rawVal.is_active),
    custom_html: typeof rawVal.custom_html === 'string' ? rawVal.custom_html : '',
    updated_at: rawVal.updated_at,
    updated_by: rawVal.updated_by,
  }

  return (
    <PengaturanHalamanView
      initialConfig={initialConfig}
      currentUserName={staff.name || 'Developer'}
    />
  )
}
