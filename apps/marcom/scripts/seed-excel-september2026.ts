import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

interface SeedData {
  outletsBudget: Array<{
    name: string
    type: string
    targetBudget: number
    targetKolCount: number
  }>
  endorsements: Array<{
    kolName: string
    outletName: string
    scheduleDate: string
    rateCard: number
    menuGiven: string | null
    hppMenu: number
    visitStatus: string
    postStatus: string
    draftStatus: string
    paymentStatus: string
    paymentDate: string | null
    paymentNotes: string | null
    phoneNumber: string | null
    bankAccount: string | null
    tiktokUrl: string | null
    instagramUrl: string | null
    posts: Array<{
      platform: string
      postUrl: string
      status: string
    }>
    campaignTag: string
  }>
  ads: Array<{
    category: string
    platform: string
    accountName: string
    outletName: string
    adUrl: string | null
    scheduleDate: string
    budget: number
    spent: number
    initialViews: number
    finalViews: number
    status: string
  }>
}

async function main() {
  console.log('🚀 Starting Seeder for September 2026 data...')

  const jsonPath = 'C:\\Users\\lu.DESKTOP-HRO3RNS\\.gemini\\antigravity\\brain\\94fe0349-2071-4ea9-a9fe-31c6afd281bf\\scratch\\seed_data.json'
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`JSON data file not found at ${jsonPath}`)
  }

  const raw = fs.readFileSync(jsonPath, 'utf-8')
  const data: SeedData = JSON.parse(raw)

  // 1. Seed Outlets and Monthly Budgets
  console.log('🏪 Upserting Outlets and Budgets...')
  const outletMap = new Map<string, bigint>()

  for (const item of data.outletsBudget) {
    const outlet = await prisma.outlet.upsert({
      where: { name: item.name },
      update: {
        type: item.type,
      },
      create: {
        name: item.name,
        type: item.type,
      },
    })
    outletMap.set(item.name.toLowerCase().trim(), outlet.id)

    // Upsert Monthly Budget for September 2026 (Month 9, Year 2026)
    await prisma.outletBudget.upsert({
      where: {
        idx_outlet_budget_period: {
          outletId: outlet.id,
          periodMonth: 9,
          periodYear: 2026,
        },
      },
      update: {
        targetBudget: item.targetBudget,
        targetKolCount: item.targetKolCount,
      },
      create: {
        outletId: outlet.id,
        periodMonth: 9,
        periodYear: 2026,
        targetBudget: item.targetBudget,
        targetKolCount: item.targetKolCount,
        notes: `Budget Alokasi September 2026 (${item.type})`,
      },
    })
  }

  // Ensure default outlet Dramaga exists
  if (!outletMap.has('dramaga')) {
    const dramaga = await prisma.outlet.upsert({
      where: { name: 'Dramaga' },
      update: {},
      create: { name: 'Dramaga', type: 'INTERNAL' },
    })
    outletMap.set('dramaga', dramaga.id)
  }

  console.log(`✅ Outlets & Budgets processed: ${data.outletsBudget.length}`)

  // 2. Seed KOLs & Endorsements
  console.log('👥 Seeding KOLs and Endorsements...')
  let endorsementCount = 0
  let postCount = 0

  for (const end of data.endorsements) {
    // 2a. Find or create KOL
    let kol = await prisma.kol.findFirst({
      where: { name: { equals: end.kolName, mode: 'insensitive' } },
    })

    if (!kol) {
      kol = await prisma.kol.create({
        data: {
          name: end.kolName,
          phoneNumber: end.phoneNumber,
          bankAccount: end.bankAccount,
          tiktokUrl: end.tiktokUrl,
          instagramUrl: end.instagramUrl,
        },
      })
    } else {
      // Update phone/bank if available and not set
      await prisma.kol.update({
        where: { id: kol.id },
        data: {
          phoneNumber: end.phoneNumber || kol.phoneNumber,
          bankAccount: end.bankAccount || kol.bankAccount,
          tiktokUrl: end.tiktokUrl || kol.tiktokUrl,
          instagramUrl: end.instagramUrl || kol.instagramUrl,
        },
      })
    }

    // 2b. Map outlet
    let outletId = outletMap.get(end.outletName.toLowerCase().trim())
    if (!outletId) {
      // Try finding or creating outlet
      let ot = await prisma.outlet.findFirst({
        where: { name: { equals: end.outletName, mode: 'insensitive' } },
      })
      if (!ot) {
        ot = await prisma.outlet.create({
          data: { name: end.outletName, type: 'INTERNAL' },
        })
      }
      outletId = ot.id
      outletMap.set(end.outletName.toLowerCase().trim(), outletId)
    }

    // Parse date safely
    const scheduleDate = new Date(end.scheduleDate)
    const paymentDate = end.paymentDate ? new Date(end.paymentDate) : null

    // Check if duplicate endorsement exists for this KOL on this date & outlet
    const existingEndorsement = await prisma.endorsement.findFirst({
      where: {
        kolId: kol.id,
        outletId: outletId,
        scheduleDate: scheduleDate,
      },
    })

    let endorsementRecord
    if (!existingEndorsement) {
      endorsementRecord = await prisma.endorsement.create({
        data: {
          kolId: kol.id,
          outletId: outletId,
          scheduleDate: scheduleDate,
          rateCard: end.rateCard,
          menuGiven: end.menuGiven,
          hppMenu: end.hppMenu,
          visitStatus: end.visitStatus,
          postStatus: end.postStatus,
          draftStatus: end.draftStatus,
          paymentStatus: end.paymentStatus,
          paymentDate: paymentDate,
          paymentNotes: end.paymentNotes,
          bankAccountCustom: end.bankAccount,
          postUrl: end.posts.length > 0 ? end.posts[0].postUrl : null,
        },
      })
      endorsementCount++
    } else {
      endorsementRecord = await prisma.endorsement.update({
        where: { id: existingEndorsement.id },
        data: {
          rateCard: end.rateCard,
          menuGiven: end.menuGiven,
          hppMenu: end.hppMenu,
          visitStatus: end.visitStatus,
          postStatus: end.postStatus,
          draftStatus: end.draftStatus,
          paymentStatus: end.paymentStatus,
          paymentDate: paymentDate,
          paymentNotes: end.paymentNotes,
          bankAccountCustom: end.bankAccount,
        },
      })
    }

    // 2c. Insert posts
    for (const p of end.posts) {
      const existingPost = await prisma.endorsementPost.findFirst({
        where: {
          endorsementId: endorsementRecord.id,
          postUrl: p.postUrl,
        },
      })

      if (!existingPost) {
        await prisma.endorsementPost.create({
          data: {
            endorsementId: endorsementRecord.id,
            platform: p.platform,
            postUrl: p.postUrl,
            status: p.status,
            postedAt: scheduleDate,
          },
        })
        postCount++
      }
    }
  }

  console.log(`✅ Endorsements seeded/updated: ${endorsementCount}`)
  console.log(`✅ Video posts seeded: ${postCount}`)

  // 3. Seed Ads
  console.log('📢 Seeding Ads...')
  let adCount = 0
  for (const ad of data.ads) {
    const dramagaId = outletMap.get('dramaga') || null
    await prisma.ad.create({
      data: {
        category: ad.category,
        platform: ad.platform,
        accountName: ad.accountName,
        outletId: dramagaId,
        adUrl: ad.adUrl,
        scheduleDate: new Date(ad.scheduleDate),
        budget: ad.budget,
        spent: ad.spent,
        initialViews: ad.initialViews,
        finalViews: ad.finalViews,
        status: ad.status,
      },
    })
    adCount++
  }
  console.log(`✅ Ads entries seeded: ${adCount}`)

  console.log('🎉 Seeding successfully completed!')
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
