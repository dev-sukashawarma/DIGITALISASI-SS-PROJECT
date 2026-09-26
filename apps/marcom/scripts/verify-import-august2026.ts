import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function verify() {
  console.log('🔍 Running System Verification for August 2026 Data Import...\n')
  await prisma.$connect()

  // 1. Overall Counts
  const totalOutlets = await prisma.outlet.count()
  const totalBudgets = await prisma.outletBudget.count()
  const totalEndorsements = await prisma.endorsement.count()
  const totalPosts = await prisma.endorsementPost.count()
  const totalAds = await prisma.ad.count()
  const totalExpenses = await prisma.marcomExpense.count()

  console.log('📊 DATABASE OVERALL TOTALS:')
  console.log(`- Outlets: ${totalOutlets}`)
  console.log(`- Outlet Budgets: ${totalBudgets}`)
  console.log(`- Endorsements: ${totalEndorsements}`)
  console.log(`- Video Posts: ${totalPosts}`)
  console.log(`- Ads Campaigns: ${totalAds}`)
  console.log(`- Operational Expenses: ${totalExpenses}`)

  // 2. Month-by-Month Breakdown (August 2026 vs September 2026)
  const augEndorsements = await prisma.endorsement.count({
    where: {
      scheduleDate: {
        gte: new Date('2026-08-01'),
        lte: new Date('2026-08-31'),
      },
    },
  })

  const sepEndorsements = await prisma.endorsement.count({
    where: {
      scheduleDate: {
        gte: new Date('2026-09-01'),
        lte: new Date('2026-09-30'),
      },
    },
  })

  const augDelivery = await prisma.endorsement.count({
    where: {
      type: 'DELIVERY',
      scheduleDate: {
        gte: new Date('2026-08-01'),
        lte: new Date('2026-08-31'),
      },
    },
  })

  const augAds = await prisma.ad.count({
    where: {
      scheduleDate: {
        gte: new Date('2026-08-01'),
        lte: new Date('2026-08-31'),
      },
    },
  })

  const sepAds = await prisma.ad.count({
    where: {
      scheduleDate: {
        gte: new Date('2026-09-01'),
        lte: new Date('2026-09-30'),
      },
    },
  })

  console.log('\n📅 MONTH COMPARISON:')
  console.log(`- August 2026:`)
  console.log(`  • Endorsements: ${augEndorsements} (including ${augDelivery} SS Online Delivery)`)
  console.log(`  • Ads Campaigns: ${augAds}`)
  console.log(`- September 2026:`)
  console.log(`  • Endorsements: ${sepEndorsements}`)
  console.log(`  • Ads Campaigns: ${sepAds}`)

  // 3. August 2026 Budget & Realization Totals
  console.log('\n📈 AUGUST 2026 BUDGET & REALIZATION:')
  const augBudgets = await prisma.outletBudget.findMany({
    where: { periodMonth: 8, periodYear: 2026 },
  })
  const totalTargetBudget = augBudgets.reduce((acc, b) => acc + Number(b.targetBudget), 0)
  const totalTargetKol = augBudgets.reduce((acc, b) => acc + b.targetKolCount, 0)

  const augEndorsementsList = await prisma.endorsement.findMany({
    where: {
      scheduleDate: {
        gte: new Date('2026-08-01'),
        lte: new Date('2026-08-31'),
      },
    },
    select: {
      rateCard: true,
      hppMenu: true,
      shippingCost: true,
      visitStatus: true,
      postStatus: true,
      paymentStatus: true,
    },
  })

  const totalRateCard = augEndorsementsList.reduce((acc, e) => acc + Number(e.rateCard), 0)
  const totalHpp = augEndorsementsList.reduce((acc, e) => acc + Number(e.hppMenu), 0)
  const totalShipping = augEndorsementsList.reduce((acc, e) => acc + Number(e.shippingCost), 0)
  const totalRealizedCost = totalRateCard + totalHpp + totalShipping

  console.log(`- Target Budget: Rp ${totalTargetBudget.toLocaleString('id-ID')}`)
  console.log(`- Target KOL: ${totalTargetKol}`)
  console.log(`- Total Realized Cost: Rp ${totalRealizedCost.toLocaleString('id-ID')}`)
  console.log(`  • Rate Card: Rp ${totalRateCard.toLocaleString('id-ID')}`)
  console.log(`  • HPP Menu: Rp ${totalHpp.toLocaleString('id-ID')}`)
  console.log(`  • Shipping Cost (SS Online): Rp ${totalShipping.toLocaleString('id-ID')}`)
  console.log(`- Total Endorsements: ${augEndorsementsList.length}`)
  console.log(`  • Visited: ${augEndorsementsList.filter((e) => e.visitStatus === 'VISITED').length}`)
  console.log(`  • Posted: ${augEndorsementsList.filter((e) => e.postStatus === 'ON').length}`)
  console.log(`  • Paid: ${augEndorsementsList.filter((e) => e.paymentStatus === 'PAID').length}`)
  console.log(`  • Barter: ${augEndorsementsList.filter((e) => e.paymentStatus === 'BARTER').length}`)

  console.log('\n✅ Verification completed successfully!')
  await prisma.$disconnect()
}

verify().catch((e) => {
  console.error(e)
  process.exit(1)
})
