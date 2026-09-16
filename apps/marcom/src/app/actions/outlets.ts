'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { getPosSupabase } from '@/lib/supabase-pos'

export type ActionState = {
  success?: boolean
  error?: string
  data?: any
}

function cleanOutletName(sbName: string): string {
  let name = sbName.trim()
  if (/^SUKA\s+SHAWARMA\s+/i.test(name)) {
    name = name.replace(/^SUKA\s+SHAWARMA\s+/i, '')
  } else if (/^MITRA\s+/i.test(name)) {
    name = name.replace(/^MITRA\s+/i, '')
  }

  if (name.length <= 4) {
    return name.toUpperCase()
  }
  return name.charAt(0).toUpperCase() + name.slice(1)
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
      .select('*')
      .order('name', { ascending: true })

    if (error || !sbOutlets) {
      return { error: `Gagal mengambil data outlet dari Supabase: ${error?.message || 'Unknown error'}` }
    }

    const marcomOutlets = await prisma.outlet.findMany()

    let updatedCount = 0
    let createdCount = 0
    let skippedCount = 0

    for (const sb of sbOutlets) {
      if (sb.type === 'system' || sb.name.includes('(SYSTEM)')) {
        skippedCount++
        continue
      }

      const marcomType = sb.type === 'mitra' ? 'MITRA' : 'INTERNAL'

      // 1. Try matching by posOutletId
      let match = marcomOutlets.find((m) => m.posOutletId === sb.id)

      // 2. Try matching by clean / normalized name
      if (!match) {
        const cleaned = cleanOutletName(sb.name).toLowerCase()
        match = marcomOutlets.find((m) => {
          const mClean = cleanOutletName(m.name).toLowerCase()
          return mClean === cleaned || m.name.toLowerCase() === sb.name.toLowerCase()
        })
      }

      if (match) {
        await prisma.outlet.update({
          where: { id: match.id },
          data: {
            posOutletId: sb.id,
            posName: sb.name,
            posType: sb.type,
            region: sb.region || match.region,
            address: sb.address || match.address,
            phone: sb.phone || match.phone,
            isActive: sb.is_active ?? true,
            type: marcomType,
          },
        })
        updatedCount++
      } else {
        const friendlyName = cleanOutletName(sb.name)
        const nameConflict = marcomOutlets.find(
          (m) => m.name.toLowerCase() === friendlyName.toLowerCase()
        )
        const finalName = nameConflict ? sb.name : friendlyName

        await prisma.outlet.create({
          data: {
            name: finalName,
            type: marcomType,
            posOutletId: sb.id,
            posName: sb.name,
            posType: sb.type,
            region: sb.region,
            address: sb.address,
            phone: sb.phone,
            isActive: sb.is_active ?? true,
          },
        })
        createdCount++
      }
    }

    revalidatePath('/dashboard/outlets')
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/endorsements')
    revalidatePath('/dashboard/budget')
    revalidatePath('/dashboard/ads')
    revalidatePath('/dashboard/calendar')

    return {
      success: true,
      data: {
        updated: updatedCount,
        created: createdCount,
        skipped: skippedCount,
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

  if (user.role !== 'ADMIN') {
    return { error: 'Hanya role ADMIN yang berhak menghapus data cabang' }
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
