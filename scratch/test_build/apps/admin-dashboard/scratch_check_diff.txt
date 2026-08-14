import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const orders = await prisma.pos_orders.findMany({
    where: { status: 'completed' },
    include: { order_items: true }
  });

  let sumOrderItems = 0;
  let sumGrossWidget = 0;
  let diffCount = 0;

  for (const o of orders) {
    const oiSum = o.order_items.reduce((s, oi) => s + oi.subtotal, 0);
    const disc = Number((o as any).discount_amount) || 0;
    const promo = Number((o as any).promo_subsidy) || 0;
    const deductions = disc + promo;
    const kpiGross = o.total_amount + deductions;

    sumOrderItems += oiSum;
    sumGrossWidget += kpiGross;

    if (Math.abs(oiSum - kpiGross) > 1) { // more than 1 rupiah difference
      diffCount++;
      console.log(`Order ${o.id}: oiSum=${oiSum}, kpiGross=${kpiGross}, total_amount=${o.total_amount}, disc=${disc}, promo=${promo}`);
    }
  }

  console.log(`Total diff count: ${diffCount}`);
  console.log(`Sum Order Items (PDF Revenue): ${sumOrderItems}`);
  console.log(`Sum KPI Gross (Widget Revenue): ${sumGrossWidget}`);
  console.log(`Difference: ${sumGrossWidget - sumOrderItems}`);
}

check().catch(console.error).finally(() => prisma.$disconnect());
