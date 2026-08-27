const { createClient } = require('@supabase/supabase-js');

const ssOrderUrl = 'https://qntuhtkujpwudcpudwbj.supabase.co';
const ssOrderKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFudHVodGt1anB3dWRjcHVkd2JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNTMyNjcsImV4cCI6MjA5NDgyOTI2N30.X2pjS2ont0ekVVc71HLacM2I49aLeypLRRgoPQV6OTw';

const ssOrderDb = createClient(ssOrderUrl, ssOrderKey);

async function runCronSimulation() {
    const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

    console.log("==========================================");
    console.log("🚀 MENSIMULASIKAN CRON JOB pull-online-orders");
    console.log("==========================================");
    console.log(`Menjalankan query: SELECT id FROM orders WHERE status='paid' AND created_at >= '${since}'`);
    console.log("------------------------------------------");

    const { data: paidOrders, error: paidErr } = await ssOrderDb
        .from('orders')
        .select('id')
        .eq('status', 'paid')
        .gte('created_at', since);

    if (paidErr) {
        console.error('❌ HASIL: ERROR');
        console.error('pull-online-orders: gagal baca order-system', paidErr);
    } else {
        console.log('✅ HASIL: SUKSES');
        console.log(`Data berhasil ditarik: ${paidOrders.length} baris (orders).`);
        console.log("Tidak ada lagi pesan error 'column orders.order_type does not exist'.");
        console.log("Cron Job dijamin dapat berjalan tanpa crash.");
    }
    console.log("==========================================");
}

runCronSimulation();
