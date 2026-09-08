import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export interface AppUser {
  id: string
  email: string
  name: string | null
  role: 'ADMIN' | 'MARCOM' | string
}

export async function getCurrentUser(): Promise<AppUser | null> {
  try {
    const supabase = await createClient()
    const {
      data: { user: authUser },
      error,
    } = await supabase.auth.getUser()

    if (error || !authUser?.email) {
      return null
    }

    // Lookup user in Coolify PostgreSQL
    let dbUser = await prisma.user.findUnique({
      where: { email: authUser.email },
    })

    // If user not in DB yet, create them. If it's the very first user in the DB, make them ADMIN.
    if (!dbUser) {
      const userCount = await prisma.user.count()
      const initialRole = userCount === 0 ? 'ADMIN' : 'MARCOM'

      dbUser = await prisma.user.create({
        data: {
          email: authUser.email,
          name: authUser.user_metadata?.full_name || authUser.email.split('@')[0],
          role: initialRole,
        },
      })
    }

    return {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role,
    }
  } catch (err) {
    console.error('Error fetching current user:', err)
    return null
  }
}
