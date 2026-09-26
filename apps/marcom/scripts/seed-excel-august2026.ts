import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

interface SeedData {
  periodMonth: number
  periodYear: number
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
    type?: string
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
    shippingAddress?: string | null
    recipientName?: string | null
    courierResi?: string | null
    shippingCost?: number
    isShipped?: boolean
    shippingDate?: string | null
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
  expenses: Array<{
    category: string
    amount: number
    description: string
    expenseDate: string
    paymentSource: string
  }>
}

async function main() {
  console.log('🚀 Starting Seeder for August 2026 data...')

  // Look for JSON in brain scratch or local scratch
  let jsonPath = 'C:\\Users\\lu.DESKTOP-HRO3RNS\\.gemini\\antigravity\\brain\\de102efc-d27a-4dfe-8905-bd6262498500\\scratch\\seed_data_august.json'
  if (!fs.existsSync(jsonPath)) {
    jsonPath = path.resolve(__dirname, '../scratch/seed_data_august.json')
  }
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`JSON data file not found at ${jsonPath}`)
  }

  const raw = fs.readFileSync(jsonPath, 'utf-8')
  const data: SeedData = JSON.parse(raw)

  // 1. Seed Outlets and Monthly Budgets for August 2026 (Month 8, Year 2026)
  console.log('🏪 Upserting Outlets and Budgets for August 2026...')
  const outletMap = new Map<string, bigint>()

  // Load existing outlets first
  const existingOutlets = await prisma.outlet.findMany()
  for (const ot of existingOutlets) {
    outletMap.set(ot.name.toLowerCase().trim(), ot.id)
  }

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

    // Upsert Monthly Budget for August 2026 (Month 8, Year 2026)
    await prisma.outletBudget.upsert({
      where: {
        idx_outlet_budget_period: {
          outletId: outlet.id,
          periodMonth: 8,
          periodYear: 2026,
        },
      },
      update: {
        targetBudget: item.targetBudget,
        targetKolCount: item.targetKolCount,
      },
      create: {
        outletId: outlet.id,
        periodMonth: 8,
        periodYear: 2026,
        targetBudget: item.targetBudget,
        targetKolCount: item.targetKolCount,
        notes: `Budget Alokasi Agustus 2026 (${item.type})`,
      },
    })
  }

  // Ensure default outlet Dramaga & SS Central Kitchen exist
  if (!outletMap.has('dramaga')) {
    const dramaga = await prisma.outlet.upsert({
      where: { name: 'Dramaga' },
      update: {},
      create: { name: 'Dramaga', type: 'INTERNAL' },
    })
    outletMap.set('dramaga', dramaga.id)
  }

  if (!outletMap.has('ss central kitchen')) {
    const sck = await prisma.outlet.upsert({
      where: { name: 'SS Central Kitchen' },
      update: {},
      create: { name: 'SS Central Kitchen', type: 'INTERNAL' },
    })
    outletMap.set('ss central kitchen', sck.id)
  }

  console.log(`✅ Outlets & Budgets processed: ${data.outletsBudget.length}`)

  // 2. Seed KOLs & Endorsements
  console.log('👥 Seeding KOLs and Endorsements for August 2026...')
  let endorsementCreatedCount = 0
  let endorsementUpdatedCount = 0
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

    const scheduleDate = new Date(end.scheduleDate)
    const paymentDate = end.paymentDate ? new Date(end.paymentDate) : null
    const shippingDate = end.shippingDate ? new Date(end.shippingDate) : null

    // Check if duplicate endorsement exists
    const existingEndorsement = await prisma.endorsement.findFirst({
      where: {
        kolId: kol.id,
        outletId: outletId,
        scheduleDate: scheduleDate,
      },
    })

    let endorsementRecord
    const endorsementData = {
      kolId: kol.id,
      outletId: outletId,
      scheduleDate: scheduleDate,
      rateCard: end.rateCard,
      menuGiven: end.menuGiven,
      hppMenu: end.hppMenu,
      type: end.type || 'VISIT',
      visitStatus: end.visitStatus,
      postStatus: end.postStatus,
      draftStatus: end.draftStatus,
      paymentStatus: end.paymentStatus,
      paymentDate: paymentDate,
      paymentNotes: end.paymentNotes,
      bankAccountCustom: end.bankAccount,
      shippingAddress: end.shippingAddress || null,
      recipientName: end.recipientName || null,
      courierResi: end.courierResi || null,
      shippingCost: end.shippingCost || 0,
      isShipped: end.isShipped || false,
      shippingDate: shippingDate,
      postUrl: end.posts.length > 0 ? end.posts[0].postUrl : null,
    }

    if (!existingEndorsement) {
      endorsementRecord = await prisma.endorsement.create({
        data: endorsementData,
      })
      endorsementCreatedCount++
    } else {
      endorsementRecord = await prisma.endorsement.update({
        where: { id: existingEndorsement.id },
        data: endorsementData,
      })
      endorsementUpdatedCount++
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

  console.log(`✅ Endorsements created: ${endorsementCreatedCount}`)
  console.log(`✅ Endorsements updated: ${endorsementUpdatedCount}`)
  console.log(`✅ Video posts seeded: ${postCount}`)

  // 3. Seed Ads
  console.log('📢 Seeding Ads for August 2026...')
  let adCreatedCount = 0
  let adUpdatedCount = 0
  const dramagaId = outletMap.get('dramaga') || null

  for (const ad of data.ads) {
    const adScheduleDate = new Date(ad.scheduleDate)
    const existingAd = await prisma.ad.findFirst({
      where: {
        outletId: dramagaId,
        scheduleDate: adScheduleDate,
        adUrl: ad.adUrl,
      },
    })

    if (!existingAd) {
      await prisma.ad.create({
        data: {
          category: ad.category,
          platform: ad.platform,
          accountName: ad.accountName,
          outletId: dramagaId,
          adUrl: ad.adUrl,
          scheduleDate: adScheduleDate,
          budget: ad.budget,
          spent: ad.spent,
          initialViews: ad.initialViews,
          finalViews: ad.finalViews,
          status: ad.status,
        },
      })
      adCreatedCount++
    } else {
      await prisma.ad.update({
        where: { id: existingAd.id },
        data: {
          budget: ad.budget,
          spent: ad.spent,
          initialViews: ad.initialViews,
          finalViews: ad.finalViews,
          status: ad.status,
        },
      })
      adUpdatedCount++
    }
  }
  console.log(`✅ Ads created: ${adCreatedCount}, updated: ${adUpdatedCount}`)

  // 4. Seed Marcom Expenses (Operational Visit)
  console.log('💵 Seeding Operational Expenses for August 2026...')
  let expCreatedCount = 0
  let expUpdatedCount = 0

  for (const exp of data.expenses) {
    const expDate = new Date(exp.expenseDate)
    const existingExp = await prisma.marcomExpense.findFirst({
      where: {
        description: exp.description,
        expenseDate: expDate,
      },
    })

    if (!existingExp) {
      await prisma.marcomExpense.create({
        data: {
          category: exp.category,
          amount: exp.amount,
          description: exp.description,
          expenseDate: expDate,
          paymentSource: exp.paymentSource,
        },
      })
      expCreatedCount++
    } else {
      await prisma.marcomExpense.update({
        where: { id: existingExp.id },
        data: {
          amount: exp.amount,
          category: exp.category,
        },
      })
      expUpdatedCount++
    }
  }
  console.log(`✅ Expenses created: ${expCreatedCount}, updated: ${expUpdatedCount}`)

  console.log('🎉 August 2026 Seeding successfully completed!')
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
