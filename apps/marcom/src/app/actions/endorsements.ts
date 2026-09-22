'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { getPosSupabase } from '@/lib/supabase-pos'
import { syncEndorsementOpex, deleteOpexByExpenseId } from '@/lib/sync-finance-opex'

export type ActionState = {
  success?: boolean
  error?: string
}

export async function createEndorsement(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Unauthorized: Harap login terlebih dahulu' }
  }

  const kolIdStr = formData.get('kolId') as string
  const isNewKol = formData.get('isNewKol') === 'true'
  const newKolName = (formData.get('newKolName') as string)?.trim()
  const newKolSocial = (formData.get('newKolSocial') as string)?.trim() || null
  const newKolSocialsStr = (formData.get('newKolSocials') as string)?.trim() || null
  const newKolPhone = (formData.get('newKolPhone') as string)?.trim() || null

  const outletIdStr = formData.get('outletId') as string
  const scheduleDateStr = formData.get('scheduleDate') as string
  const rateCardStr = (formData.get('rateCard') as string) || '0'
  const rateCard = parseFloat(rateCardStr.replace(/[^0-9.]/g, '')) || 0
  const menuGiven = (formData.get('menuGiven') as string)?.trim() || null
  const menuItemsStr = formData.get('menuItems') as string
  const hppMenuStr = (formData.get('hppMenu') as string) || '0'
  const videoPostsStr = (formData.get('videoPosts') as string)?.trim() || null
  const postUrl = (formData.get('postUrl') as string)?.trim() || null
  const postUrlIg = (formData.get('postUrlIg') as string)?.trim() || null
  const initialViewsStr = formData.get('initialViews') as string
  const finalViewsStr = formData.get('finalViews') as string
  const visitStatus = (formData.get('visitStatus') as string) || 'PENDING'
  const postStatus = (formData.get('postStatus') as string) || 'OFF'
  const draftStatus = (formData.get('draftStatus') as string) || 'PENDING'
  const paymentStatusFromForm = formData.get('paymentStatus') as string
  const paymentStatus = paymentStatusFromForm || (rateCard === 0 ? 'BARTER' : 'UNPAID')
  const paymentDateStr = formData.get('paymentDate') as string
  const paymentNotes = (formData.get('paymentNotes') as string)?.trim() || (formData.get('notes') as string)?.trim() || null
  const bankAccountCustom = (formData.get('bankAccountCustom') as string)?.trim() || null
  const type = (formData.get('type') as string) || 'VISIT'
  const shippingAddress = (formData.get('shippingAddress') as string)?.trim() || null
  const recipientName = (formData.get('recipientName') as string)?.trim() || null
  const courierResi = (formData.get('courierResi') as string)?.trim() || null
  const shippingCostStr = (formData.get('shippingCost') as string) || '0'
  const isShipped = formData.get('isShipped') === 'true'
  const shippingDateStr = formData.get('shippingDate') as string

  if ((!kolIdStr && !newKolName) || !outletIdStr || !scheduleDateStr) {
    return { error: 'KOL / Influencer, Outlet, dan Tanggal Jadwal wajib diisi' }
  }

  let menuItems: any[] = []
  if (menuItemsStr) {
    try {
      menuItems = JSON.parse(menuItemsStr)
    } catch (e) {
      console.error('Invalid menuItems JSON:', e)
    }
  }

  let finalMenuGiven = menuGiven
  if (!finalMenuGiven && menuItems.length > 0) {
    finalMenuGiven = menuItems.map((m: any) => `${m.quantity}x ${m.name}`).join(', ')
  }

  try {
    let kolId: bigint

    if (isNewKol || newKolName) {
      if (!newKolName) {
        return { error: 'Nama KOL Baru wajib diisi' }
      }

      let socials: Array<{ platform: string; handle: string }> = []
      if (newKolSocialsStr) {
        try {
          socials = JSON.parse(newKolSocialsStr)
        } catch (e) {
          console.error('Invalid newKolSocials JSON:', e)
        }
      }

      let tiktokUrl: string | null = null
      let instagramUrl: string | null = null
      let youtubeUrl: string | null = null
      let facebookUrl: string | null = null
      let threadsUrl: string | null = null

      for (const item of socials) {
        const h = item.handle?.trim()
        if (!h) continue
        if (item.platform === 'TIKTOK' && !tiktokUrl) tiktokUrl = h
        else if (item.platform === 'INSTAGRAM' && !instagramUrl) instagramUrl = h
        else if (item.platform === 'YOUTUBE' && !youtubeUrl) youtubeUrl = h
        else if (item.platform === 'FACEBOOK' && !facebookUrl) facebookUrl = h
        else if (item.platform === 'THREADS' && !threadsUrl) threadsUrl = h
      }

      if (!tiktokUrl && !instagramUrl && !youtubeUrl && !facebookUrl && !threadsUrl && newKolSocial) {
        if (
          newKolSocial.includes('instagram.com') ||
          newKolSocial.includes('ig') ||
          newKolSocial.toLowerCase().startsWith('@ig')
        ) {
          instagramUrl = newKolSocial
        } else if (newKolSocial.includes('facebook.com') || newKolSocial.includes('fb.com')) {
          facebookUrl = newKolSocial
        } else if (newKolSocial.includes('youtube.com') || newKolSocial.includes('youtu.be')) {
          youtubeUrl = newKolSocial
        } else if (newKolSocial.includes('threads.net')) {
          threadsUrl = newKolSocial
        } else {
          tiktokUrl = newKolSocial
        }
      }

      const createdKol = await prisma.kol.create({
        data: {
          name: newKolName,
          tiktokUrl,
          instagramUrl,
          youtubeUrl,
          facebookUrl,
          threadsUrl,
          phoneNumber: newKolPhone,
        },
      })
      kolId = createdKol.id
    } else {
      if (!kolIdStr) {
        return { error: 'Pilih KOL / Influencer terlebih dahulu' }
      }
      kolId = BigInt(kolIdStr)
    }

    const outletId = BigInt(outletIdStr)
    const scheduleDate = new Date(scheduleDateStr)
    const hppMenu = parseFloat(hppMenuStr.replace(/[^0-9.]/g, '')) || 0
    const shippingCost = parseFloat(shippingCostStr.replace(/[^0-9.]/g, '')) || 0
    const initialViews = initialViewsStr ? parseInt(initialViewsStr, 10) : null
    const finalViews = finalViewsStr ? parseInt(finalViewsStr, 10) : null
    const paymentDate = paymentDateStr ? new Date(paymentDateStr) : null
    const shippingDate = shippingDateStr ? new Date(shippingDateStr) : (isShipped ? new Date() : null)

    let videoPosts: Array<{ platform: string; postUrl: string; customPlatformName?: string }> = []
    if (videoPostsStr) {
      try {
        videoPosts = JSON.parse(videoPostsStr)
      } catch (e) {
        console.error('Invalid videoPosts JSON in createEndorsement:', e)
      }
    }

    const firstValidPostUrl = videoPosts.find((v) => v.postUrl?.trim())?.postUrl?.trim() || postUrl || postUrlIg || null

    const endorsement = await prisma.endorsement.create({
      data: {
        kolId,
        outletId,
        scheduleDate,
        rateCard,
        menuGiven: finalMenuGiven,
        menuItems: menuItems.length > 0 ? menuItems : undefined,
        hppMenu,
        postUrl: firstValidPostUrl,
        initialViews,
        finalViews,
        visitStatus,
        postStatus,
        draftStatus,
        paymentStatus,
        paymentDate,
        paymentNotes,
        bankAccountCustom,
        type,
        shippingAddress,
        recipientName,
        courierResi,
        shippingCost,
        isShipped,
        shippingDate,
      },
    })

    // Sinkronisasi otomatis ke Supabase POS untuk visit outlet fisik
    if (type === 'VISIT') {
      try {
        const outlet = await prisma.outlet.findUnique({ where: { id: outletId } })
        const kol = await prisma.kol.findUnique({ where: { id: kolId } })
        if (outlet?.posOutletId) {
          const supabase = getPosSupabase()
          const scheduleDateISO = scheduleDate.toISOString().split('T')[0]
          await supabase.from('pos_endorsements').upsert({
            marcom_endorsement_id: Number(endorsement.id),
            outlet_id: outlet.posOutletId,
            outlet_name: outlet.name,
            kol_id: Number(kolId),
            kol_name: kol?.name || 'KOL',
            kol_handle: (() => {
              const handles: string[] = []
              if (kol?.instagramUrl) handles.push(`IG: ${kol.instagramUrl}`)
              if (kol?.tiktokUrl) handles.push(`TT: ${kol.tiktokUrl}`)
              if (kol?.youtubeUrl) handles.push(`YT: ${kol.youtubeUrl}`)
              if (kol?.facebookUrl) handles.push(`FB: ${kol.facebookUrl}`)
              if (kol?.threadsUrl) handles.push(`TH: ${kol.threadsUrl}`)
              return handles.length > 0 ? handles.join(' | ') : null
            })(),
            kol_phone: kol?.phoneNumber || null,
            schedule_date: scheduleDateISO,
            items: menuItems,
            status: 'SCHEDULED',
            notes: paymentNotes || null,
          }, { onConflict: 'marcom_endorsement_id' })
        }
      } catch (syncErr) {
        console.error('Error syncing endorsement to POS Supabase:', syncErr)
      }
    }

    // Create post links if provided
    const validVideoPosts = videoPosts.filter((p) => p.postUrl && p.postUrl.trim())
    if (validVideoPosts.length > 0) {
      await prisma.endorsementPost.createMany({
        data: validVideoPosts.map((p) => ({
          endorsementId: endorsement.id,
          platform: p.platform || 'TIKTOK',
          postUrl: p.postUrl.trim(),
          customPlatformName: p.customPlatformName || null,
          status: 'POSTED',
          postedAt: scheduleDate,
        })),
      })
    } else {
      if (postUrl) {
        await prisma.endorsementPost.create({
          data: {
            endorsementId: endorsement.id,
            platform: 'TIKTOK',
            postUrl,
            status: 'POSTED',
            postedAt: scheduleDate,
          },
        })
      }

      if (postUrlIg) {
        await prisma.endorsementPost.create({
          data: {
            endorsementId: endorsement.id,
            platform: 'IG_REEL',
            postUrl: postUrlIg,
            status: 'POSTED',
            postedAt: scheduleDate,
          },
        })
      }
    }

    // Auto-scrape any video links that were added
    try {
      if (validVideoPosts.length > 0 || postUrl || postUrlIg) {
        const { syncSingleEndorsementVideo } = await import('@/app/actions/sync')
        await syncSingleEndorsementVideo(endorsement.id.toString())
      }
    } catch (scrapeErr) {
      console.warn('Auto-scrape on create endorsement warning:', scrapeErr)
    }

    // Sinkronisasi otomatis ke OPEX Finance & Admin Dashboard
    await syncEndorsementOpex(endorsement.id)

    revalidatePath('/dashboard/endorsements')
    revalidatePath('/dashboard/kols')
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/budget')
    return { success: true }
  } catch (err: any) {
    console.error('Failed to create endorsement:', err)
    return { error: err?.message || 'Gagal menambahkan endorsement' }
  }
}

export async function updateEndorsement(
  id: string,
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Unauthorized: Harap login terlebih dahulu' }
  }

  const kolIdStr = formData.get('kolId') as string
  const outletIdStr = formData.get('outletId') as string
  const scheduleDateStr = formData.get('scheduleDate') as string
  const rateCardStr = (formData.get('rateCard') as string) || '0'
  const menuGiven = (formData.get('menuGiven') as string)?.trim() || null
  const menuItemsStr = formData.get('menuItems') as string
  const hppMenuStr = (formData.get('hppMenu') as string) || '0'
  const videoPostsStr = (formData.get('videoPosts') as string)?.trim() || null
  const postUrl = (formData.get('postUrl') as string)?.trim() || null
  const initialViewsStr = formData.get('initialViews') as string
  const finalViewsStr = formData.get('finalViews') as string
  const visitStatus = (formData.get('visitStatus') as string) || 'PENDING'
  const postStatus = (formData.get('postStatus') as string) || 'OFF'
  const draftStatus = (formData.get('draftStatus') as string) || 'PENDING'
  const paymentStatus = (formData.get('paymentStatus') as string) || 'UNPAID'
  const paymentDateStr = formData.get('paymentDate') as string
  const paymentNotes = (formData.get('paymentNotes') as string)?.trim() || null
  const bankAccountCustom = (formData.get('bankAccountCustom') as string)?.trim() || null
  const type = (formData.get('type') as string) || 'VISIT'
  const shippingAddress = (formData.get('shippingAddress') as string)?.trim() || null
  const recipientName = (formData.get('recipientName') as string)?.trim() || null
  const courierResi = (formData.get('courierResi') as string)?.trim() || null
  const shippingCostStr = (formData.get('shippingCost') as string) || '0'
  const isShipped = formData.get('isShipped') === 'true'
  const shippingDateStr = formData.get('shippingDate') as string

  if (!kolIdStr || !outletIdStr || !scheduleDateStr) {
    return { error: 'KOL, Outlet, dan Tanggal Jadwal wajib diisi' }
  }

  let menuItems: any[] | null = null
  if (menuItemsStr !== null && menuItemsStr !== undefined) {
    try {
      menuItems = JSON.parse(menuItemsStr)
    } catch (e) {
      console.error('Invalid menuItems JSON:', e)
    }
  }

  let finalMenuGiven = menuGiven
  if (!finalMenuGiven && menuItems && menuItems.length > 0) {
    finalMenuGiven = menuItems.map((m: any) => `${m.quantity}x ${m.name}`).join(', ')
  }

  let videoPosts: Array<{ platform: string; postUrl: string; customPlatformName?: string }> | null = null
  if (videoPostsStr !== null && videoPostsStr !== undefined) {
    try {
      videoPosts = JSON.parse(videoPostsStr)
    } catch (e) {
      console.error('Invalid videoPosts JSON in updateEndorsement:', e)
    }
  }

  try {
    const endorsementId = BigInt(id)
    const kolId = BigInt(kolIdStr)
    const outletId = BigInt(outletIdStr)
    const scheduleDate = new Date(scheduleDateStr)
    const rateCard = parseFloat(rateCardStr.replace(/[^0-9.]/g, '')) || 0
    const hppMenu = parseFloat(hppMenuStr.replace(/[^0-9.]/g, '')) || 0
    const shippingCost = parseFloat(shippingCostStr.replace(/[^0-9.]/g, '')) || 0
    const initialViews = initialViewsStr ? parseInt(initialViewsStr, 10) : null
    const finalViews = finalViewsStr ? parseInt(finalViewsStr, 10) : null
    const paymentDate = paymentDateStr ? new Date(paymentDateStr) : null
    const shippingDate = shippingDateStr ? new Date(shippingDateStr) : (isShipped ? new Date() : null)

    const firstValidPostUrl = videoPosts !== null
      ? (videoPosts.find((v) => v.postUrl?.trim())?.postUrl?.trim() || null)
      : postUrl

    await prisma.endorsement.update({
      where: { id: endorsementId },
      data: {
        kolId,
        outletId,
        scheduleDate,
        rateCard,
        menuGiven: finalMenuGiven,
        ...(menuItems !== null ? { menuItems } : {}),
        hppMenu,
        ...(videoPosts !== null ? { postUrl: firstValidPostUrl } : (postUrl !== null ? { postUrl } : {})),
        initialViews,
        finalViews,
        visitStatus,
        postStatus,
        draftStatus,
        paymentStatus,
        paymentDate,
        paymentNotes,
        bankAccountCustom,
        type,
        shippingAddress,
        recipientName,
        courierResi,
        shippingCost,
        isShipped,
        ...(shippingDate !== null ? { shippingDate } : {}),
      },
    })

    // Sinkronisasi update ke Supabase POS
    try {
      const supabase = getPosSupabase()
      if (type === 'VISIT') {
        const outlet = await prisma.outlet.findUnique({ where: { id: outletId } })
        const kol = await prisma.kol.findUnique({ where: { id: kolId } })
        if (outlet?.posOutletId) {
          const scheduleDateISO = scheduleDate.toISOString().split('T')[0]
          await supabase.from('pos_endorsements').upsert({
            marcom_endorsement_id: Number(endorsementId),
            outlet_id: outlet.posOutletId,
            outlet_name: outlet.name,
            kol_id: Number(kolId),
            kol_name: kol?.name || 'KOL',
            kol_handle: (() => {
              const handles: string[] = []
              if (kol?.instagramUrl) handles.push(`IG: ${kol.instagramUrl}`)
              if (kol?.tiktokUrl) handles.push(`TT: ${kol.tiktokUrl}`)
              if (kol?.youtubeUrl) handles.push(`YT: ${kol.youtubeUrl}`)
              if (kol?.facebookUrl) handles.push(`FB: ${kol.facebookUrl}`)
              if (kol?.threadsUrl) handles.push(`TH: ${kol.threadsUrl}`)
              return handles.length > 0 ? handles.join(' | ') : null
            })(),
            kol_phone: kol?.phoneNumber || null,
            schedule_date: scheduleDateISO,
            items: menuItems || [],
            status: visitStatus === 'VISITED' ? 'CLAIMED' : 'SCHEDULED',
            notes: paymentNotes || null,
          }, { onConflict: 'marcom_endorsement_id' })
        }
      } else {
        await supabase.from('pos_endorsements').delete().eq('marcom_endorsement_id', Number(endorsementId))
      }
    } catch (syncErr) {
      console.error('Error syncing endorsement update to POS Supabase:', syncErr)
    }

    // Sinkronisasi data endorsementPost multi-platform
    if (videoPosts !== null) {
      const validVideoPosts = videoPosts.filter((p) => p.postUrl && p.postUrl.trim())
      const existingPosts = await prisma.endorsementPost.findMany({
        where: { endorsementId },
      })
      const existingMap = new Map(existingPosts.map((ep) => [ep.postUrl.trim(), ep]))

      await prisma.endorsementPost.deleteMany({
        where: { endorsementId },
      })
      if (validVideoPosts.length > 0) {
        await prisma.endorsementPost.createMany({
          data: validVideoPosts.map((p) => {
            const existing = existingMap.get(p.postUrl.trim())
            return {
              endorsementId,
              platform: p.platform || 'TIKTOK',
              postUrl: p.postUrl.trim(),
              customPlatformName: p.customPlatformName || null,
              status: 'POSTED',
              postedAt: scheduleDate,
              views: existing?.views || 0,
              likes: existing?.likes || 0,
              comments: existing?.comments || 0,
              shares: existing?.shares || 0,
              saves: existing?.saves || 0,
            }
          }),
        })

        // Auto-scrape any video links that have 0 views or are newly added
        try {
          const { syncSingleEndorsementVideo } = await import('@/app/actions/sync')
          await syncSingleEndorsementVideo(endorsementId.toString())
        } catch (scrapeErr) {
          console.warn('Auto-scrape on update endorsement warning:', scrapeErr)
        }
      }
    }

    // Sinkronisasi otomatis ke OPEX Finance & Admin Dashboard
    await syncEndorsementOpex(endorsementId)

    revalidatePath('/dashboard/endorsements')
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/budget')
    return { success: true }
  } catch (err: any) {
    console.error('Failed to update endorsement:', err)
    return { error: err?.message || 'Gagal mengubah endorsement' }
  }
}

export async function updateShippingStatus(
  id: string,
  isShipped: boolean,
  courierResi?: string,
  shippingCost?: number
): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  try {
    const endorsementId = BigInt(id)
    await prisma.endorsement.update({
      where: { id: endorsementId },
      data: {
        isShipped,
        shippingDate: isShipped ? new Date() : null,
        ...(courierResi !== undefined ? { courierResi } : {}),
        ...(shippingCost !== undefined ? { shippingCost } : {}),
      },
    })

    // Sinkronisasi otomatis ke OPEX Finance & Admin Dashboard
    await syncEndorsementOpex(endorsementId)

    revalidatePath('/dashboard/endorsements')
    revalidatePath('/dashboard/budget')
    return { success: true }
  } catch (err: any) {
    console.error('Failed to update shipping status:', err)
    return { error: err?.message || 'Gagal mengubah status ekspedisi' }
  }
}

export async function updateEndorsementStatus(
  id: string,
  visitStatus: string,
  postStatus: string
): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  try {
    const endorsementId = BigInt(id)
    await prisma.endorsement.update({
      where: { id: endorsementId },
      data: { visitStatus, postStatus },
    })

    revalidatePath('/dashboard/endorsements')
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/budget')
    return { success: true }
  } catch (err: any) {
    console.error('Failed to update endorsement status:', err)
    return { error: err?.message || 'Gagal mengubah status' }
  }
}

export async function updatePaymentStatus(
  id: string,
  paymentStatus: string,
  paymentDateStr?: string | null,
  paymentNotes?: string | null,
  bankAccountCustom?: string | null
): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Unauthorized: Harap login terlebih dahulu' }
  }

  try {
    const endorsementId = BigInt(id)
    const paymentDate = paymentDateStr ? new Date(paymentDateStr) : null

    await prisma.endorsement.update({
      where: { id: endorsementId },
      data: {
        paymentStatus,
        paymentDate,
        ...(paymentNotes !== undefined ? { paymentNotes } : {}),
        ...(bankAccountCustom !== undefined ? { bankAccountCustom } : {}),
      },
    })

    revalidatePath('/dashboard/endorsements')
    revalidatePath('/dashboard/budget')
    return { success: true }
  } catch (err: any) {
    console.error('Failed to update payment status:', err)
    return { error: err?.message || 'Gagal memperbarui status pembayaran' }
  }
}

export async function updateDraftStatus(
  id: string,
  draftStatus: string
): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  try {
    const endorsementId = BigInt(id)
    await prisma.endorsement.update({
      where: { id: endorsementId },
      data: { draftStatus },
    })

    revalidatePath('/dashboard/endorsements')
    return { success: true }
  } catch (err: any) {
    console.error('Failed to update draft status:', err)
    return { error: err?.message || 'Gagal memperbarui status draft' }
  }
}

export async function batchUpdatePayments(
  ids: string[],
  paymentStatus: string,
  paymentDateStr?: string
): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  try {
    const paymentDate = paymentDateStr ? new Date(paymentDateStr) : new Date()
    const bigIntIds = ids.map((id) => BigInt(id))

    await prisma.endorsement.updateMany({
      where: { id: { in: bigIntIds } },
      data: {
        paymentStatus,
        paymentDate,
      },
    })

    revalidatePath('/dashboard/endorsements')
    revalidatePath('/dashboard/budget')
    return { success: true }
  } catch (err: any) {
    console.error('Failed to batch update payments:', err)
    return { error: err?.message || 'Gagal memproses update pembayaran' }
  }
}

export async function addPostLink(
  endorsementIdStr: string,
  platform: string,
  postUrl: string,
  customPlatformName?: string
): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  try {
    const endorsementId = BigInt(endorsementIdStr)
    await prisma.endorsementPost.create({
      data: {
        endorsementId,
        platform,
        postUrl: postUrl.trim(),
        customPlatformName: customPlatformName?.trim() || null,
        status: 'POSTED',
      },
    })

    // Update main postUrl on endorsement if not set
    await prisma.endorsement.update({
      where: { id: endorsementId },
      data: {
        postUrl: postUrl.trim(),
        postStatus: 'ON',
      },
    })

    revalidatePath('/dashboard/endorsements')
    return { success: true }
  } catch (err: any) {
    console.error('Failed to add post link:', err)
    return { error: err?.message || 'Gagal menambahkan link postingan' }
  }
}

export async function deletePostLink(postIdStr: string): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  try {
    const postId = BigInt(postIdStr)
    await prisma.endorsementPost.delete({
      where: { id: postId },
    })

    revalidatePath('/dashboard/endorsements')
    return { success: true }
  } catch (err: any) {
    console.error('Failed to delete post link:', err)
    return { error: err?.message || 'Gagal menghapus link postingan' }
  }
}

export async function deleteEndorsement(id: string): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  try {
    const endorsementId = BigInt(id)

    // Ambil referensi expense ID untuk dihapus dari OPEX Supabase
    const existing = await prisma.endorsement.findUnique({
      where: { id: endorsementId },
      select: { rateCardExpenseId: true, shippingExpenseId: true },
    })

    if (existing) {
      if (existing.rateCardExpenseId) {
        await deleteOpexByExpenseId(existing.rateCardExpenseId)
      }
      if (existing.shippingExpenseId) {
        await deleteOpexByExpenseId(existing.shippingExpenseId)
      }
    }

    await prisma.endorsement.delete({
      where: { id: endorsementId },
    })

    try {
      const supabase = getPosSupabase()
      await supabase.from('pos_endorsements').delete().eq('marcom_endorsement_id', Number(endorsementId))
    } catch (syncErr) {
      console.error('Error deleting from pos_endorsements:', syncErr)
    }

    revalidatePath('/dashboard/endorsements')
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/budget')
    return { success: true }
  } catch (err: any) {
    console.error('Failed to delete endorsement:', err)
    return { error: err?.message || 'Gagal menghapus endorsement' }
  }
}

export async function updateVideoMetrics(
  id: string,
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Unauthorized: Harap login terlebih dahulu' }
  }

  const postsMetricsStr = (formData.get('postsMetrics') as string)?.trim() || null
  const finalViewsStr = formData.get('finalViews') as string
  const initialViewsStr = formData.get('initialViews') as string
  const likesStr = formData.get('likes') as string
  const commentsStr = formData.get('comments') as string
  const sharesStr = formData.get('shares') as string
  const savesStr = formData.get('saves') as string
  const postUrl = (formData.get('postUrl') as string)?.trim() || null

  try {
    const endorsementId = BigInt(id)

    let postsMetrics: Array<{
      id: string
      postUrl?: string
      views?: number
      likes?: number
      comments?: number
      shares?: number
      saves?: number
    }> = []

    if (postsMetricsStr) {
      try {
        postsMetrics = JSON.parse(postsMetricsStr)
      } catch (e) {
        console.error('Invalid postsMetrics JSON:', e)
      }
    }

    if (postsMetrics.length > 0) {
      let totalViews = 0
      let totalLikes = 0
      let totalComments = 0
      let totalShares = 0
      let totalSaves = 0

      for (const pm of postsMetrics) {
        const v = Math.max(0, Number(pm.views || 0))
        const l = Math.max(0, Number(pm.likes || 0))
        const c = Math.max(0, Number(pm.comments || 0))
        const sh = Math.max(0, Number(pm.shares || 0))
        const sa = Math.max(0, Number(pm.saves || 0))

        totalViews += v
        totalLikes += l
        totalComments += c
        totalShares += sh
        totalSaves += sa

        if (pm.id && pm.id !== 'legacy') {
          try {
            await prisma.endorsementPost.update({
              where: { id: BigInt(pm.id) },
              data: {
                views: v,
                likes: l,
                comments: c,
                shares: sh,
                saves: sa,
                status: 'POSTED',
                ...(pm.postUrl ? { postUrl: pm.postUrl } : {}),
              },
            })
          } catch (pErr) {
            console.error(`Failed to update post ${pm.id} metrics:`, pErr)
          }
        }
      }

      await prisma.endorsement.update({
        where: { id: endorsementId },
        data: {
          finalViews: totalViews,
          likes: totalLikes,
          comments: totalComments,
          shares: totalShares,
          saves: totalSaves,
          ...((totalViews > 0 || totalLikes > 0) ? { postStatus: 'ON' } : {}),
        },
      })
    } else {
      const finalViews = finalViewsStr ? parseInt(finalViewsStr, 10) : null
      const initialViews = initialViewsStr ? parseInt(initialViewsStr, 10) : null
      const likes = likesStr !== '' ? parseInt(likesStr, 10) : 0
      const comments = commentsStr !== '' ? parseInt(commentsStr, 10) : 0
      const shares = sharesStr !== '' ? parseInt(sharesStr, 10) : 0
      const saves = savesStr !== '' ? parseInt(savesStr, 10) : 0

      await prisma.endorsement.update({
        where: { id: endorsementId },
        data: {
          ...(finalViews !== null ? { finalViews } : {}),
          ...(initialViews !== null ? { initialViews } : {}),
          likes,
          comments,
          shares,
          saves,
          ...(postUrl ? { postUrl } : {}),
          ...((finalViews || likes || comments) ? { postStatus: 'ON' } : {}),
        },
      })
    }

    revalidatePath('/dashboard/endorsements')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (err: any) {
    console.error('Failed to update video metrics:', err)
    return { error: err?.message || 'Gagal memperbarui metrik video' }
  }
}

export async function syncClaimedEndorsements(): Promise<{ syncedCount: number }> {
  try {
    const supabase = getPosSupabase()
    const { data: claimed, error } = await supabase
      .from('pos_endorsements')
      .select('marcom_endorsement_id, order_id, pos_order_number, status')
      .eq('status', 'CLAIMED')
      .not('order_id', 'is', null)

    if (error || !claimed || claimed.length === 0) return { syncedCount: 0 }

    let count = 0
    for (const row of claimed) {
      if (row.marcom_endorsement_id) {
        const updated = await prisma.endorsement.updateMany({
          where: {
            id: BigInt(row.marcom_endorsement_id),
            visitStatus: { not: 'VISITED' },
          },
          data: {
            visitStatus: 'VISITED',
            posOrderId: row.order_id,
            posOrderNumber: row.pos_order_number || null,
          },
        })
        count += updated.count
      }
    }
    if (count > 0) {
      revalidatePath('/dashboard/endorsements')
    }
    return { syncedCount: count }
  } catch (err) {
    console.error('syncClaimedEndorsements error:', err)
    return { syncedCount: 0 }
  }
}

export interface VideoEmbedInfo {
  platform: string
  embedUrl: string | null
  rawUrl: string
  canEmbed: boolean
}

export async function resolveVideoEmbedInfo(
  url: string,
  platformHint?: string
): Promise<VideoEmbedInfo> {
  const trimmedUrl = (url || '').trim()
  const lowerUrl = trimmedUrl.toLowerCase()

  if (!trimmedUrl) {
    return { platform: platformHint || 'CUSTOM', embedUrl: null, rawUrl: '', canEmbed: false }
  }

  // 1. Instagram Reel / Post
  if (lowerUrl.includes('instagram.com') || lowerUrl.includes('instagr.am')) {
    const reelMatch = trimmedUrl.match(/\/(reel|p)\/([A-Za-z0-9_-]+)/i)
    if (reelMatch && reelMatch[2]) {
      return {
        platform: 'IG_REEL',
        embedUrl: `https://www.instagram.com/reel/${reelMatch[2]}/embed/`,
        rawUrl: trimmedUrl,
        canEmbed: true,
      }
    }
  }

  // 2. TikTok
  if (lowerUrl.includes('tiktok.com')) {
    let targetUrl = trimmedUrl
    if (lowerUrl.includes('vt.tiktok.com') || lowerUrl.includes('vm.tiktok.com')) {
      try {
        const res = await fetch(trimmedUrl, {
          method: 'HEAD',
          redirect: 'follow',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        })
        targetUrl = res.url || trimmedUrl
      } catch (err) {
        console.warn('Failed to resolve TikTok short URL:', err)
      }
    }

    const videoMatch = targetUrl.match(/\/video\/(\d+)/i)
    if (videoMatch && videoMatch[1]) {
      return {
        platform: 'TIKTOK',
        embedUrl: `https://www.tiktok.com/embed/v2/${videoMatch[1]}`,
        rawUrl: trimmedUrl,
        canEmbed: true,
      }
    }
  }

  // 3. YouTube Shorts / Video
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) {
    let videoId = ''
    const shortsMatch = trimmedUrl.match(/\/shorts\/([A-Za-z0-9_-]+)/i)
    if (shortsMatch && shortsMatch[1]) {
      videoId = shortsMatch[1]
    } else {
      const vMatch = trimmedUrl.match(/(?:v=|\/)([A-Za-z0-9_-]{11})(?:\?|&|$)/i)
      if (vMatch && vMatch[1]) videoId = vMatch[1]
    }

    if (videoId) {
      return {
        platform: 'YOUTUBE_SHORTS',
        embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`,
        rawUrl: trimmedUrl,
        canEmbed: true,
      }
    }
  }

  // 4. Facebook Video
  if (lowerUrl.includes('facebook.com') || lowerUrl.includes('fb.watch')) {
    return {
      platform: 'FACEBOOK',
      embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(trimmedUrl)}&show_text=false`,
      rawUrl: trimmedUrl,
      canEmbed: true,
    }
  }

  // Fallback
  return {
    platform: platformHint || 'CUSTOM',
    embedUrl: null,
    rawUrl: trimmedUrl,
    canEmbed: false,
  }
}
