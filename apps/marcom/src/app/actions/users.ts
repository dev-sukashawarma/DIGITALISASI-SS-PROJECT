'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export type ActionState = {
  success?: boolean
  error?: string
}

export async function createUser(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const currentUser = await getCurrentUser()
  if (!currentUser || currentUser.role !== 'ADMIN') {
    return { error: 'Hanya ADMIN yang dapat menambahkan user' }
  }

  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const name = (formData.get('name') as string)?.trim() || null
  const role = (formData.get('role') as string) || 'MARCOM'

  if (!email) {
    return { error: 'Email pengguna wajib diisi' }
  }

  try {
    const existing = await prisma.user.findUnique({
      where: { email },
    })

    if (existing) {
      return { error: `User dengan email ${email} sudah terdaftar` }
    }

    await prisma.user.create({
      data: {
        email,
        name,
        role,
      },
    })

    revalidatePath('/dashboard/users')
    return { success: true }
  } catch (err: any) {
    console.error('Failed to create user:', err)
    return { error: err?.message || 'Gagal menambahkan user' }
  }
}

export async function updateUserRole(
  userId: string,
  newRole: string
): Promise<ActionState> {
  const currentUser = await getCurrentUser()
  if (!currentUser || currentUser.role !== 'ADMIN') {
    return { error: 'Hanya ADMIN yang berhak mengubah role' }
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { role: newRole },
    })

    revalidatePath('/dashboard/users')
    return { success: true }
  } catch (err: any) {
    console.error('Failed to update role:', err)
    return { error: err?.message || 'Gagal memperbarui role' }
  }
}

export async function deleteUser(userId: string): Promise<ActionState> {
  const currentUser = await getCurrentUser()
  if (!currentUser || currentUser.role !== 'ADMIN') {
    return { error: 'Hanya ADMIN yang berhak menghapus user' }
  }

  if (currentUser.id === userId) {
    return { error: 'Anda tidak dapat menghapus akun Anda sendiri' }
  }

  try {
    await prisma.user.delete({
      where: { id: userId },
    })

    revalidatePath('/dashboard/users')
    return { success: true }
  } catch (err: any) {
    console.error('Failed to delete user:', err)
    return { error: err?.message || 'Gagal menghapus user' }
  }
}
