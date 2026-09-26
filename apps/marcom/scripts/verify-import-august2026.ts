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

  // 3. August 2026 Breakdown by Endorsement Type
  console.log('\n📈 AUGUST 2026 BREAKDOWN BY ENDORSEMENT TYPE:')
  const augEndorsementsList = await prisma.endorsement.findMany({
    where: {
      scheduleDate: {
        gte: new Date('2026-08-01'),
        lte: new Date('2026-08-31'),
      },
    },
    select: {
      type: true,
      rateCard: true,
      hppMenu: true,
      shippingCost: true,
      visitStatus: true,
      postStatus: true,
      paymentStatus: true,
    },
  })

  const regularKols = augEndorsementsList.filter((e) => (e.type || 'VISIT') === 'VISIT')
  const agencyKols = augEndorsementsList.filter((e) => e.type === 'AGENCY')
  const deliveryKols = augEndorsementsList.filter((e) => e.type === 'DELIVERY')

  const augBudgets = await prisma.outletBudget.findMany({
    where: { periodMonth: 8, periodYear: 2026 },
  })
  const totalTargetBudget = augBudgets.reduce((acc, b) => acc + Number(b.targetBudget), 0)
  const totalTargetKol = augBudgets.reduce((acc, b) => acc + b.targetKolCount, 0)

  const regRate = regularKols.reduce((acc, e) => acc + Number(e.rateCard), 0)
  const regHpp = regularKols.reduce((acc, e) => acc + Number(e.hppMenu), 0)
  const regTotal = regRate + regHpp

  const agencyHpp = agencyKols.reduce((acc, e) => acc + Number(e.hppMenu), 0)
  const deliveryRate = deliveryKols.reduce((acc, e) => acc + Number(e.rateCard), 0)
  const deliveryHpp = deliveryKols.reduce((acc, e) => acc + Number(e.hppMenu), 0)
  const deliveryShipping = deliveryKols.reduce((acc, e) => acc + Number(e.shippingCost), 0)

  console.log(`\n1️⃣ REGULAR KOL VISIT (Dihitung di Budget Matrix):`)
  console.log(`  • Target Budget: Rp ${totalTargetBudget.toLocaleString('id-ID')} | Realisasi: Rp ${regTotal.toLocaleString('id-ID')} (Rate Card Rp ${regRate.toLocaleString('id-ID')} + HPP Rp ${regHpp.toLocaleString('id-ID')})`)
  console.log(`  • Target KOL: ${totalTargetKol} | Realisasi KOL: ${regularKols.length}`)
  console.log(`  • Posted: ${regularKols.filter((e) => e.postStatus === 'ON').length} | Paid: ${regularKols.filter((e) => e.paymentStatus === 'PAID').length}`)

  console.log(`\n2️⃣ AGENCY HDA GO (Terpisah dari Budget KOL):`)
  console.log(`  • Jumlah KOL: ${agencyKols.length} KOL`)
  console.log(`  • Rate Card: Rp 0 (Barter/Agency Contract)`)
  console.log(`  • Total HPP Menu: Rp ${agencyHpp.toLocaleString('id-ID')} (Mix jumbo)`)
  console.log(`  • Posted: ${agencyKols.filter((e) => e.postStatus === 'ON').length}`)

  console.log(`\n3️⃣ SS ONLINE DELIVERY (Terpisah):`)
  console.log(`  • Jumlah KOL: ${deliveryKols.length} KOL`)
  console.log(`  • Rate Card: Rp ${deliveryRate.toLocaleString('id-ID')} | HPP: Rp ${deliveryHpp.toLocaleString('id-ID')} | Ongkir: Rp ${deliveryShipping.toLocaleString('id-ID')}`)

  console.log(`\n📊 GRAND TOTAL AUGUST 2026:`)
  console.log(`  • Total Endorsements: ${augEndorsementsList.length} (${regularKols.length} Reguler + ${agencyKols.length} Agency + ${deliveryKols.length} Delivery)`)
  console.log(`  • Total Realized Cost: Rp ${(regTotal + agencyHpp + deliveryRate + deliveryHpp + deliveryShipping).toLocaleString('id-ID')}`)

  console.log('\n✅ Verification completed successfully!')
  await prisma.$disconnect()
}

verify().catch((e) => {
  console.error(e)
  process.exit(1)
})
