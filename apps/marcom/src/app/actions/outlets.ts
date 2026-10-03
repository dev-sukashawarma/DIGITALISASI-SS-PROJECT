'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { getPosSupabase } from '@/lib/supabase-pos'
import { rencanakanSinkronOutlet } from '@/lib/outletPosSync'
import { terapkanRencanaSinkronOutlet } from '@/lib/outletPosSyncServer'

export type ActionState = {
  success?: boolean
  error?: string
  data?: any
}

export async function syncOutletsFromPosSupabase(): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Unauthorized: Harap login terlebih dahulu' }
  }

  try {
    const supabase = getPosSupabase()
    const { data: sbOutlets, error } = await supabase
      .from('outlets')
      .select('id, name, type, region, address, phone, is_active')
      .order('name', { ascending: true })

    if (error || !sbOutlets) {
      return { error: `Gagal mengambil data outlet dari Supabase: ${error?.message || 'Unknown error'}` }
    }

    const marcomOutlets = await prisma.outlet.findMany()
    const plan = rencanakanSinkronOutlet(
      sbOutlets.map((o) => ({
        id: String(o.id),
        name: String(o.name || ''),
        type: String(o.type || 'outlet'),
        region: o.region,
        address: o.address,
        phone: o.phone,
        isActive: o.is_active ?? true,
      })),
      marcomOutlets,
      'penuh'
    )
    await terapkanRencanaSinkronOutlet(plan)

    revalidatePath('/dashboard/outlets')
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/endorsements')
    revalidatePath('/dashboard/budget')
    revalidatePath('/dashboard/ads')
    revalidatePath('/dashboard/calendar')

    return {
      success: true,
      data: {
        updated: plan.updates.length,
        created: plan.creates.length,
        skipped: plan.skipped,
        total: sbOutlets.length,
      },
    }
  } catch (err: any) {
    console.error('Failed to sync outlets from POS:', err)
    return { error: err?.message || 'Gagal menyinkronkan outlet dari Supabase' }
  }
}

export async function createOutlet(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Unauthorized: Harap login terlebih dahulu' }
  }

  const name = (formData.get('name') as string)?.trim()
  const type = (formData.get('type') as string) || 'INTERNAL'
  const posOutletId = (formData.get('posOutletId') as string)?.trim() || null
  const region = (formData.get('region') as string)?.trim() || null
  const address = (formData.get('address') as string)?.trim() || null
  const phone = (formData.get('phone') as string)?.trim() || null
  const isActive = formData.get('isActive') !== 'false'

  if (!name) {
    return { error: 'Nama cabang/outlet wajib diisi' }
  }

  try {
    const existing = await prisma.outlet.findUnique({
      where: { name },
    })

    if (existing) {
      return { error: `Outlet dengan nama "${name}" sudah terdaftar` }
    }

    await prisma.outlet.create({
      data: {
        name,
        type,
        posOutletId,
        region,
        address,
        phone,
        isActive,
      },
    })

    revalidatePath('/dashboard/outlets')
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/budget')
    revalidatePath('/dashboard/endorsements')
    return { success: true }
  } catch (err: any) {
    console.error('Failed to create outlet:', err)
    return { error: err?.message || 'Gagal menambahkan outlet' }
  }
}

export async function updateOutlet(
  id: string,
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Unauthorized: Harap login terlebih dahulu' }
  }

  const name = (formData.get('name') as string)?.trim()
  const type = (formData.get('type') as string) || 'INTERNAL'
  const posOutletId = (formData.get('posOutletId') as string)?.trim() || null
  const region = (formData.get('region') as string)?.trim() || null
  const address = (formData.get('address') as string)?.trim() || null
  const phone = (formData.get('phone') as string)?.trim() || null
  const isActive = formData.get('isActive') === 'true'

  if (!name) {
    return { error: 'Nama cabang/outlet wajib diisi' }
  }

  try {
    const outletId = BigInt(id)

    // Check duplicate name
    const existing = await prisma.outlet.findFirst({
      where: {
        name,
        NOT: { id: outletId },
      },
    })

    if (existing) {
      return { error: `Outlet dengan nama "${name}" sudah digunakan` }
    }

    await prisma.outlet.update({
      where: { id: outletId },
      data: {
        name,
        type,
        posOutletId,
        region,
        address,
        phone,
        isActive,
      },
    })

    revalidatePath('/dashboard/outlets')
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/budget')
    revalidatePath('/dashboard/endorsements')
    return { success: true }
  } catch (err: any) {
    console.error('Failed to update outlet:', err)
    return { error: err?.message || 'Gagal mengubah outlet' }
  }
}

export async function toggleOutletActive(id: string, currentStatus: boolean): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  try {
    const outletId = BigInt(id)
    await prisma.outlet.update({
      where: { id: outletId },
      data: { isActive: !currentStatus },
    })

    revalidatePath('/dashboard/outlets')
    revalidatePath('/dashboard/endorsements')
    return { success: true }
  } catch (err: any) {
    console.error('Failed to toggle outlet status:', err)
    return { error: err?.message || 'Gagal mengubah status outlet' }
  }
}

export async function deleteOutlet(id: string): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  try {
    const outletId = BigInt(id)

    // Check relations
    const [endorsementCount, adCount] = await Promise.all([
      prisma.endorsement.count({ where: { outletId } }),
      prisma.ad.count({ where: { outletId } }),
    ])

    if (endorsementCount > 0 || adCount > 0) {
      return {
        error: `Tidak dapat menghapus outlet ini karena masih memiliki ${endorsementCount} data endorsement dan ${adCount} data ads. Anda dapat menonaktifkan statusnya saja.`,
      }
    }

    await prisma.outlet.delete({
      where: { id: outletId },
    })

    revalidatePath('/dashboard/outlets')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (err: any) {
    console.error('Failed to delete outlet:', err)
    return { error: err?.message || 'Gagal menghapus outlet' }
  }
}
