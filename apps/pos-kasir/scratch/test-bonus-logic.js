const path = require('path');
const assert = require('assert');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env variables. Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('========================================================================');
  console.log('=== STARTING GENUINE BONUS CALCULATION LOGIC VERIFICATION (M5) ===');
  console.log('========================================================================\n');

  let testOutletId = null;
  let testOutletName = null;
  let crewCount = 0;
  let createdTargetId = null;
  const createdOrderIds = [];
  let tempTableCreated = false;

  try {
    // 1. Fetch active crew and outlet
    console.log('[Step 1] Fetching active crew staff and outlet...');
    const { data: crewStaff, error: crewError } = await supabase
      .from('outlet_staff')
      .select('id, outlet_id, name, status, role')
      .eq('role', 'crew')
      .eq('status', 'active')
      .not('outlet_id', 'is', null)
      .limit(1);

    if (crewError) {
      throw new Error(`Failed to fetch crew staff: ${crewError.message}`);
    }

    if (!crewStaff || crewStaff.length === 0) {
      throw new Error('No active crew staff found in the database to run the test.');
    }

    const testCrewMember = crewStaff[0];
    testOutletId = testCrewMember.outlet_id;
    console.log(`  - Selected crew member : ${testCrewMember.name} (ID: ${testCrewMember.id})`);
    console.log(`  - Selected outlet ID   : ${testOutletId}`);

    // Fetch the outlet name
    const { data: outletData, error: outletError } = await supabase
      .from('outlets')
      .select('name')
      .eq('id', testOutletId)
      .single();

    if (outletError) {
      throw new Error(`Failed to fetch outlet name: ${outletError.message}`);
    }
    testOutletName = outletData.name;
    console.log(`  - Selected outlet Name : ${testOutletName}`);

    // Count active crew members
    const { data: outletCrews, error: countError } = await supabase
      .from('outlet_staff')
      .select('id, name')
      .eq('outlet_id', testOutletId)
      .eq('role', 'crew')
      .eq('status', 'active');

    if (countError) {
      throw new Error(`Failed to count outlet crews: ${countError.message}`);
    }

    crewCount = outletCrews.length;
    console.log(`  - Total active crew    : ${crewCount}`);
    console.log(`  - Active crew names    : ${outletCrews.map(c => c.name).join(', ')}`);

    // Fetch Admin for auth checks
    const { data: adminStaff } = await supabase
      .from('outlet_staff')
      .select('id, name')
      .in('role', ['admin', 'owner'])
      .limit(1);
    const adminUserId = adminStaff && adminStaff.length > 0 ? adminStaff[0].id : null;
    console.log(`  - Admin user for test  : ${adminStaff && adminStaff[0] ? adminStaff[0].name : 'None'} (ID: ${adminUserId})`);

    // Fetch Crew from another outlet
    const { data: otherCrewStaff } = await supabase
      .from('outlet_staff')
      .select('id, name, outlet_id')
      .eq('role', 'crew')
      .eq('status', 'active')
      .neq('outlet_id', testOutletId)
      .not('outlet_id', 'is', null)
      .limit(1);
    const otherCrewUserId = otherCrewStaff && otherCrewStaff.length > 0 ? otherCrewStaff[0].id : null;
    console.log(`  - Other crew user      : ${otherCrewStaff && otherCrewStaff[0] ? otherCrewStaff[0].name : 'None'} (ID: ${otherCrewUserId})`);

    // 2. Setup temporary table for storing results and reload cache
    console.log('\n[Step 2] Setting up temp table public.temp_test_result for calculation output...');
    const tableSql = `
      CREATE TABLE IF NOT EXISTS public.temp_test_result (
        crew_name            TEXT,
        role                 TEXT,
        outlet_name          TEXT,
        days_target_reached  INT,
        total_bonus_received NUMERIC
      );
    `;
    const { error: tableErr } = await supabase.rpc('exec_sql', { sql: tableSql });
    if (tableErr) {
      throw new Error(`Failed to create temp table: ${tableErr.message}`);
    }
    tempTableCreated = true;

    console.log('  - Requesting Postgrest schema reload...');
    await supabase.rpc('exec_sql', { sql: "NOTIFY pgrst, 'reload schema';" });
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('  - Setup complete.');

    // 3. Setup Daily Target Override
    console.log('\n[Step 3] Setting target override for 2026-12-01 (Target: 100,000 IDR, Bonus: 50,000 IDR)...');
    // Clear any existing override first
    await supabase.from('daily_sales_targets').delete().eq('outlet_id', testOutletId).eq('effective_from', '2026-12-01');

    const { data: insertedTarget, error: targetError } = await supabase
      .from('daily_sales_targets')
      .insert({
        outlet_id: testOutletId,
        target_amount: 100000,
        bonus_amount: 50000,
        effective_from: '2026-12-01',
        created_at: new Date('2026-12-01T00:00:00.000Z').toISOString()
      })
      .select();

    if (targetError) {
      throw new Error(`Failed to insert daily target override: ${targetError.message}`);
    }

    createdTargetId = insertedTarget[0].id;
    console.log(`  - Target override inserted successfully (ID: ${createdTargetId})`);

    // Verify resolving target and bonus
    const { data: resolvedTarget } = await supabase.rpc('resolve_daily_target', {
      p_outlet: testOutletId,
      p_date: '2026-12-05'
    });
    console.log(`  - Verification: resolved target amount for 2026-12-05 = ${resolvedTarget}`);
    assert.strictEqual(parseFloat(resolvedTarget), 100000, 'Resolved target amount must match the target override!');

    const { data: resolvedBonus } = await supabase.rpc('resolve_daily_bonus', {
      p_outlet: testOutletId,
      p_date: '2026-12-05'
    });
    console.log(`  - Verification: resolved bonus amount for 2026-12-05 = ${resolvedBonus}`);
    assert.strictEqual(parseFloat(resolvedBonus), 50000, 'Resolved bonus amount must match the target override!');

    // 4. Insert Mock Orders
    console.log('\n[Step 4] Inserting mock completed orders for target verification...');
    // Day 1: 2026-12-05 (sales = 150,000, target = 100,000) -> Target Reached! (Bonus = 50,000)
    // Day 2: 2026-12-06 (sales = 50,000, target = 100,000) -> Target Missed! (Bonus = 0)
    const mockOrders = [
      {
        outlet_id: testOutletId,
        status: 'completed',
        total_amount: 150000,
        created_at: '2026-12-05T05:00:00Z'
      },
      {
        outlet_id: testOutletId,
        status: 'completed',
        total_amount: 50000,
        created_at: '2026-12-06T09:00:00Z'
      }
    ];

    const { data: insertedOrders, error: orderError } = await supabase
      .from('orders')
      .insert(mockOrders)
      .select();

    if (orderError) {
      throw new Error(`Failed to insert mock orders: ${orderError.message}`);
    }

    insertedOrders.forEach(o => createdOrderIds.push(o.id));
    console.log(`  - Mock orders created: ${createdOrderIds.join(', ')}`);

    // 5. Test Case A: Executing as Admin
    if (adminUserId) {
      console.log(`\n--- Test Case A: Executing as Admin (User ID: ${adminUserId}) ---`);
      await supabase.rpc('exec_sql', { sql: 'TRUNCATE public.temp_test_result;' });
      
      const runSql = `
        DO $$
        BEGIN
          PERFORM set_config('request.jwt.claims', json_build_object('sub', '${adminUserId}')::text, true);
          INSERT INTO public.temp_test_result (crew_name, role, outlet_name, days_target_reached, total_bonus_received)
          SELECT * FROM public.calculate_monthly_crew_bonus(12, 2026, '${testOutletId}');
        END $$;
      `;
      const { error: errA } = await supabase.rpc('exec_sql', { sql: runSql });
      if (errA) throw new Error(`Admin execution failed: ${errA.message}`);
      
      const { data: resA, error: selectErrA } = await supabase.from('temp_test_result').select('*');
      if (selectErrA) throw new Error(`Select A failed: ${selectErrA.message}`);
      console.log('  - Result rows:', resA);
      
      validateOutputRows(resA, testOutletName, crewCount, 50000 / crewCount);
      console.log('  => Test Case A PASSED ✅');
    } else {
      console.log('\n--- Test Case A: SKIPPED (No Admin User found in database) ---');
    }

    // 6. Test Case B: Executing as Authorized Crew member
    console.log(`\n--- Test Case B: Executing as Authorized Crew (User ID: ${testCrewMember.id}) ---`);
    await supabase.rpc('exec_sql', { sql: 'TRUNCATE public.temp_test_result;' });

    const runSqlB = `
      DO $$
      BEGIN
        PERFORM set_config('request.jwt.claims', json_build_object('sub', '${testCrewMember.id}')::text, true);
        INSERT INTO public.temp_test_result (crew_name, role, outlet_name, days_target_reached, total_bonus_received)
        SELECT * FROM public.calculate_monthly_crew_bonus(12, 2026, '${testOutletId}');
      END $$;
    `;
    const { error: errB } = await supabase.rpc('exec_sql', { sql: runSqlB });
    if (errB) throw new Error(`Authorized crew execution failed: ${errB.message}`);

    const { data: resB, error: selectErrB } = await supabase.from('temp_test_result').select('*');
    if (selectErrB) throw new Error(`Select B failed: ${selectErrB.message}`);
    console.log('  - Result rows:', resB);

    validateOutputRows(resB, testOutletName, crewCount, 50000 / crewCount);
    console.log('  => Test Case B PASSED ✅');

    // 7. Test Case C: Executing as Unauthorized Crew (different outlet)
    if (otherCrewUserId) {
      console.log(`\n--- Test Case C: Executing as Unauthorized Crew (User ID: ${otherCrewUserId}) ---`);
      const runSqlC = `
        DO $$
        BEGIN
          PERFORM set_config('request.jwt.claims', json_build_object('sub', '${otherCrewUserId}')::text, true);
          PERFORM * FROM public.calculate_monthly_crew_bonus(12, 2026, '${testOutletId}');
        END $$;
      `;
      const { error: errC } = await supabase.rpc('exec_sql', { sql: runSqlC });
      if (errC && errC.message.includes('Unauthorized')) {
        console.log('  - Blocked with "Unauthorized" exception as expected.');
        console.log('  => Test Case C PASSED ✅');
      } else {
        throw new Error(`Test Case C FAILED: Expected Unauthorized exception, got error: ${JSON.stringify(errC)}`);
      }
    } else {
      console.log('\n--- Test Case C: SKIPPED (No crew from another outlet found in database) ---');
    }

    // 8. Test Case D: Executing as Anonymous User
    console.log('\n--- Test Case D: Executing as Anonymous ---');
    const runSqlD = `
      DO $$
      BEGIN
        PERFORM set_config('request.jwt.claims', '', true);
        PERFORM * FROM public.calculate_monthly_crew_bonus(12, 2026, '${testOutletId}');
      END $$;
    `;
    const { error: errD } = await supabase.rpc('exec_sql', { sql: runSqlD });
    if (errD && errD.message.includes('Unauthorized')) {
      console.log('  - Blocked with "Unauthorized" exception as expected.');
      console.log('  => Test Case D PASSED ✅');
    } else {
      throw new Error(`Test Case D FAILED: Expected Unauthorized exception, got error: ${JSON.stringify(errD)}`);
    }

    console.log('\n========================================================================');
    console.log('🎉 ALL BONUS CALCULATION LOGIC TEST CASES PASSED SUCCESSFULLY!');
    console.log('========================================================================\n');

  } catch (error) {
    console.error('\n❌ Verification Failed:');
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    // 9. Cleanup
    console.log('Starting cleanup of mock/test resources...');

    if (createdOrderIds.length > 0) {
      console.log(`  - Deleting mock orders: ${createdOrderIds.join(', ')}`);
      const { error: deleteOrdersError } = await supabase
        .from('orders')
        .delete()
        .in('id', createdOrderIds);
      if (deleteOrdersError) {
        console.error('  - Error deleting mock orders during cleanup:', deleteOrdersError.message);
      }
    }

    if (createdTargetId) {
      console.log(`  - Deleting daily target override (ID: ${createdTargetId})`);
      const { error: deleteTargetError } = await supabase
        .from('daily_sales_targets')
        .delete()
        .eq('id', createdTargetId);
      if (deleteTargetError) {
        console.error('  - Error deleting mock target during cleanup:', deleteTargetError.message);
      }
    }

    if (tempTableCreated) {
      console.log('  - Dropping temp table public.temp_test_result...');
      const { error: dropErr } = await supabase.rpc('exec_sql', {
        sql: 'DROP TABLE IF EXISTS public.temp_test_result;'
      });
      if (dropErr) {
        console.error('  - Error dropping temp table:', dropErr.message);
      }
      await supabase.rpc('exec_sql', { sql: "NOTIFY pgrst, 'reload schema';" });
    }

    console.log('Cleanup completed successfully.\n');
  }
}

function validateOutputRows(rows, expectedOutletName, expectedCrewCount, expectedBonusPerCrew) {
  assert.ok(rows, 'Result rows must not be null/undefined');
  assert.strictEqual(rows.length, expectedCrewCount, `Result rows count must be equal to expected crew count (${expectedCrewCount})`);
  
  for (const row of rows) {
    assert.strictEqual(row.outlet_name, expectedOutletName, `Outlet name must match expected '${expectedOutletName}'`);
    assert.strictEqual(row.role, 'crew', 'Role of staff receiving bonus must be "crew"');
    assert.strictEqual(row.days_target_reached, 1, 'Days target reached must be exactly 1 based on test criteria');
    
    const parsedBonus = parseFloat(row.total_bonus_received);
    assert.ok(Math.abs(parsedBonus - expectedBonusPerCrew) <= 0.01, `Bonus amount per crew must match division calculation: expected ${expectedBonusPerCrew}, got ${parsedBonus}`);
  }
}

run();
