'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export type ActionState = {
  success?: boolean
  error?: string
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
      data: { name },
    })

    revalidatePath('/dashboard/outlets')
    revalidatePath('/dashboard')
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
  if (!name) {
    return { error: 'Nama cabang/outlet wajib diisi' }
  }

  try {
    const outletId = BigInt(id)

    // Check duplicate
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
      data: { name },
    })

    revalidatePath('/dashboard/outlets')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (err: any) {
    console.error('Failed to update outlet:', err)
    return { error: err?.message || 'Gagal mengubah outlet' }
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
        error: `Tidak dapat menghapus outlet ini karena masih memiliki ${endorsementCount} data endorsement dan ${adCount} data ads.`,
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
