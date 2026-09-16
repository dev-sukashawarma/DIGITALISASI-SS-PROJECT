import * as fs from 'fs'
import { prisma } from '../src/lib/prisma'
import * as XLSX from 'xlsx'

async function run() {
  console.log('🧪 Testing Excel file reading and structure verification...')
  const filePath = 'C:\\Users\\lu.DESKTOP-HRO3RNS\\Downloads\\SS ENDORSEMENT & EVENT SEPTEMBER2026.xlsx'
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`)
  }

  const buf = fs.readFileSync(filePath)
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: true })
  console.log('Sheets found:', wb.SheetNames)

  const outlets = await prisma.outlet.count()
  const budgets = await prisma.outletBudget.count()
  const endorsements = await prisma.endorsement.count()
  const posts = await prisma.endorsementPost.count()
  const ads = await prisma.ad.count()

  console.log(`📊 Current DB Stats:`)
  console.log(`- Outlets: ${outlets}`)
  console.log(`- Budgets: ${budgets}`)
  console.log(`- Endorsements: ${endorsements}`)
  console.log(`- Video Posts: ${posts}`)
  console.log(`- Ads Campaigns: ${ads}`)

  // Verify delivery endorsements
  const deliveryCount = await prisma.endorsement.count({
    where: { type: 'DELIVERY' },
  })
  console.log(`- Delivery (SS Online) Endorsements: ${deliveryCount}`)

  console.log('✅ Verification script completed successfully!')
  await prisma.$disconnect()
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
