'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export type ActionState = {
  success?: boolean
  error?: string
}

export async function createKol(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Unauthorized: Harap login terlebih dahulu' }
  }

  const name = (formData.get('name') as string)?.trim()
  const tiktokUrl = (formData.get('tiktokUrl') as string)?.trim() || null
  const instagramUrl = (formData.get('instagramUrl') as string)?.trim() || null
  const phoneNumber = (formData.get('phoneNumber') as string)?.trim() || null
  const bankAccount = (formData.get('bankAccount') as string)?.trim() || null

  if (!name) {
    return { error: 'Nama KOL/Influencer wajib diisi' }
  }

  try {
    await prisma.kol.create({
      data: {
        name,
        tiktokUrl,
        instagramUrl,
        phoneNumber,
        bankAccount,
      },
    })

    revalidatePath('/dashboard/kols')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (err: any) {
    console.error('Failed to create KOL:', err)
    return { error: err?.message || 'Gagal menambahkan KOL' }
  }
}

export async function updateKol(
  id: string,
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Unauthorized: Harap login terlebih dahulu' }
  }

  const name = (formData.get('name') as string)?.trim()
  const tiktokUrl = (formData.get('tiktokUrl') as string)?.trim() || null
  const instagramUrl = (formData.get('instagramUrl') as string)?.trim() || null
  const phoneNumber = (formData.get('phoneNumber') as string)?.trim() || null
  const bankAccount = (formData.get('bankAccount') as string)?.trim() || null

  if (!name) {
    return { error: 'Nama KOL/Influencer wajib diisi' }
  }

  try {
    const kolId = BigInt(id)

    await prisma.kol.update({
      where: { id: kolId },
      data: {
        name,
        tiktokUrl,
        instagramUrl,
        phoneNumber,
        bankAccount,
      },
    })

    revalidatePath('/dashboard/kols')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (err: any) {
    console.error('Failed to update KOL:', err)
    return { error: err?.message || 'Gagal mengubah data KOL' }
  }
}

export async function deleteKol(id: string): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  if (user.role !== 'ADMIN') {
    return { error: 'Hanya role ADMIN yang berhak menghapus data KOL' }
  }

  try {
    const kolId = BigInt(id)

    // Check relations with endorsements
    const endorsementCount = await prisma.endorsement.count({
      where: { kolId },
    })

    if (endorsementCount > 0) {
      return {
        error: `Tidak dapat menghapus KOL ini karena masih memiliki ${endorsementCount} riwayat endorsement.`,
      }
    }

    await prisma.kol.delete({
      where: { id: kolId },
    })

    revalidatePath('/dashboard/kols')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (err: any) {
    console.error('Failed to delete KOL:', err)
    return { error: err?.message || 'Gagal menghapus KOL' }
  }
}
