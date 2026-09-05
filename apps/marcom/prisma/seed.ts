import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

const initialOutlets = [
  'Cibinong',
  'Cimanggu',
  'Sukmajaya',
  'Beji',
  'Cirendeu',
  'Pajajaran',
  'Sentul',
  'Sawangan',
  'Cibubur',
  'Kalisari',
  'Empang',
  'Paledang',
  'Dramaga',
  'Ciseeng',
  'Jagakarsa',
  'Cileungsi',
  'Cicurug',
  'Pekayon',
]

async function main() {
  console.log('--- 1. Menyinkronkan Outlets Suka Shawarma ---')
  for (const name of initialOutlets) {
    await prisma.outlet.upsert({
      where: { name },
      update: {},
      create: { name },
    })
  }
  console.log(`Berhasil menyinkronkan ${initialOutlets.length} outlet.`)

  console.log('\n--- 2. Menyinkronkan Database KOL dari Excel ---')
  const kolsPath = path.join(__dirname, 'seed_kols.json')
  if (fs.existsSync(kolsPath)) {
    const kolsData = JSON.parse(fs.readFileSync(kolsPath, 'utf-8'))
    let addedCount = 0

    for (const item of kolsData) {
      const existing = await prisma.kol.findFirst({
        where: { name: item.name },
      })

      if (!existing) {
        await prisma.kol.create({
          data: {
            name: item.name,
            tiktokUrl: item.tiktokUrl,
            instagramUrl: item.instagramUrl,
          },
        })
        addedCount++
      }
    }
    console.log(`Berhasil menambahkan ${addedCount} profil KOL baru (Total: ${kolsData.length}).`)
  }

  console.log('\n=== SEEDING DATABASE SELESAI DENGAN SUKSES! ===')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
