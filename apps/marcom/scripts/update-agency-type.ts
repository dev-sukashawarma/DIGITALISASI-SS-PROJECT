import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

async function main() {
  console.log('🔄 Updating Agency HDA GO endorsements to type: AGENCY in PostgreSQL...')

  const jsonPath = 'C:\\Users\\lu.DESKTOP-HRO3RNS\\.gemini\\antigravity\\brain\\de102efc-d27a-4dfe-8905-bd6262498500\\scratch\\seed_data_august.json'
  const raw = fs.readFileSync(jsonPath, 'utf-8')
  const data = JSON.parse(raw)

  const hdaKolNames: string[] = data.endorsements
    .filter((e: any) => e.campaignTag === 'AGNCY_HDA_GO')
    .map((e: any) => e.kolName.toLowerCase().trim())

  console.log(`Found ${hdaKolNames.length} Agency HDA GO KOL names to update.`)

  // Find all KOL IDs
  const kols = await prisma.kol.findMany({
    where: {
      name: {
        in: hdaKolNames,
        mode: 'insensitive',
      },
    },
    select: { id: true, name: true },
  })

  console.log(`Matched ${kols.length} KOL records in DB.`)
  const kolIds = kols.map((k) => k.id)

  // Update endorsements for these KOLs in August 2026
  const updateResult = await prisma.endorsement.updateMany({
    where: {
      kolId: { in: kolIds },
      scheduleDate: {
        gte: new Date('2026-08-01'),
        lte: new Date('2026-08-31'),
      },
      // Only those that are Agency HDA GO (rateCard = 0 and menuGiven contains 'Mix jumbo')
      menuGiven: {
        contains: 'Mix jumbo',
        mode: 'insensitive',
      },
    },
    data: {
      type: 'AGENCY',
    },
  })

  console.log(`✅ Successfully updated ${updateResult.count} endorsements to type: 'AGENCY'!`)

  // Summary by type in August 2026
  const augustTypes = await prisma.endorsement.groupBy({
    by: ['type'],
    where: {
      scheduleDate: {
        gte: new Date('2026-08-01'),
        lte: new Date('2026-08-31'),
      },
    },
    _count: {
      id: true,
    },
  })

  console.log('\n📊 August 2026 Endorsements by Type in DB:')
  for (const t of augustTypes) {
    console.log(`- Type '${t.type}': ${t._count.id} records`)
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('❌ Error updating agency types:', e)
  process.exit(1)
})
