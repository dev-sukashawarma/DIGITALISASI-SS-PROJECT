import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import UserList, { SerializedUser } from './UserList'

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  const currentUser = await getCurrentUser()

  // Only ADMIN can access User Management
  if (!currentUser || currentUser.role !== 'ADMIN') {
    redirect('/dashboard')
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
  })

  const serializedUsers: SerializedUser[] = users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
  }))

  return <UserList initialUsers={serializedUsers} currentUserId={currentUser.id} />
}
