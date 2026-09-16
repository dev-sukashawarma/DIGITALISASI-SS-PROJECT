const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('📦 Seeding sample SS Online Delivery Endorsements...');

  // Ensure Center Outlet exists
  const centerOutlet = await prisma.outlet.upsert({
    where: { name: 'SS Central Kitchen' },
    update: { type: 'INTERNAL' },
    create: { name: 'SS Central Kitchen', type: 'INTERNAL' },
  });

  // Sample KOL 1
  let kol1 = await prisma.kol.findFirst({ where: { name: 'Dinda Foodie Explorer' } });
  if (!kol1) {
    kol1 = await prisma.kol.create({
      data: {
        name: 'Dinda Foodie Explorer',
        phoneNumber: '081299881122',
        bankAccount: 'BCA 541098221 a.n Dinda Permata',
        tiktokUrl: 'https://tiktok.com/@dindafoodie',
        instagramUrl: 'https://instagram.com/dindafoodie',
      },
    });
  }

  // Endorsement 1 (Sent via Paxel)
  await prisma.endorsement.create({
    data: {
      kolId: kol1.id,
      outletId: centerOutlet.id,
      scheduleDate: new Date('2026-09-18'),
      rateCard: 350000,
      menuGiven: 'Paket Frozen Jumbo Mix (5 Pax) + Garlic Sauce',
      hppMenu: 75000,
      type: 'DELIVERY',
      shippingAddress: 'Jl. Boulevard Raya Blok RA No. 12, Kelapa Gading, Jakarta Utara',
      recipientName: 'Dinda (081299881122)',
      courierResi: 'PXL-JKT-8829104',
      shippingCost: 32000,
      isShipped: true,
      shippingDate: new Date('2026-09-17'),
      visitStatus: 'VISITED',
      postStatus: 'OFF',
      draftStatus: 'PENDING',
      paymentStatus: 'PAID',
      paymentDate: new Date('2026-09-18'),
      paymentNotes: 'Lunas transfer BCA untuk delivery promo',
    },
  });

  // Sample KOL 2
  let kol2 = await prisma.kol.findFirst({ where: { name: 'Rian Kuliner Malam' } });
  if (!kol2) {
    kol2 = await prisma.kol.create({
      data: {
        name: 'Rian Kuliner Malam',
        phoneNumber: '085711223344',
        bankAccount: 'Mandiri 13300981273 a.n Rian Putra',
        tiktokUrl: 'https://tiktok.com/@riankuliner',
      },
    });
  }

  // Endorsement 2 (Barter Delivery, preparing shipment)
  await prisma.endorsement.create({
    data: {
      kolId: kol2.id,
      outletId: centerOutlet.id,
      scheduleDate: new Date('2026-09-22'),
      rateCard: 0,
      menuGiven: 'Ready-to-Heat Shawarma Beef & Chicken Bento',
      hppMenu: 50000,
      type: 'DELIVERY',
      shippingAddress: 'Apartemen Sudirman Tower Lt. 15 Unit B, Jakarta Selatan',
      recipientName: 'Rian (085711223344)',
      courierResi: 'JNE-REG-01928374',
      shippingCost: 18000,
      isShipped: false,
      visitStatus: 'PENDING',
      postStatus: 'OFF',
      draftStatus: 'PENDING',
      paymentStatus: 'BARTER',
      paymentNotes: 'Barter endorsement produk kemasan SS Online',
    },
  });

  console.log('✅ 2 Sample Delivery Endorsements added successfully!');
  await prisma.$disconnect();
}

main().catch(console.error);
