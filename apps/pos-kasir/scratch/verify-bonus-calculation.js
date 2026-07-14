const path = require('path');
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
  console.log('=== Starting Bonus Calculation Logic Verification ===');

  let testOutletId = null;
  let testOutletName = null;
  let crewCount = 0;
  let createdTargetId = null;
  const createdOrderIds = [];
  let tempTableCreated = false;

  try {
    // 1. Get an active outlet and its crew staff
    console.log('Fetching active crew staff and outlet...');
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
    console.log(`Selected crew member: ${testCrewMember.name} (ID: ${testCrewMember.id})`);
    console.log(`Selected outlet ID: ${testOutletId}`);

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
    console.log(`Selected outlet Name: ${testOutletName}`);

    // Count all active crew members at this outlet
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
    console.log(`Total active crew count at this outlet: ${crewCount}`);
    console.log('Active crews:', outletCrews.map(c => c.name).join(', '));

    // Fetch other staff for auth verification
    // A. Fetch Admin
    const { data: adminStaff } = await supabase
      .from('outlet_staff')
      .select('id, name')
      .in('role', ['admin', 'owner'])
      .limit(1);
    const adminUserId = adminStaff && adminStaff.length > 0 ? adminStaff[0].id : null;
    console.log(`Selected admin user for test: ${adminStaff[0]?.name || 'None'} (ID: ${adminUserId})`);

    // B. Fetch Crew from another outlet
    const { data: otherCrewStaff } = await supabase
      .from('outlet_staff')
      .select('id, name, outlet_id')
      .eq('role', 'crew')
      .eq('status', 'active')
      .neq('outlet_id', testOutletId)
      .not('outlet_id', 'is', null)
      .limit(1);
    const otherCrewUserId = otherCrewStaff && otherCrewStaff.length > 0 ? otherCrewStaff[0].id : null;
    console.log(`Selected other outlet crew for test: ${otherCrewStaff[0]?.name || 'None'} (ID: ${otherCrewUserId})`);

    // 2. Create the temporary results table and reload schema cache
    console.log('Creating temp table public.temp_test_result...');
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

    console.log('Notifying Postgrest to reload schema cache...');
    await supabase.rpc('exec_sql', { sql: "NOTIFY pgrst, 'reload schema';" });
    // Wait for the cache reload
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('Temp table setup complete.');

    // 3. Set daily sales target override for the test date range
    // We will use December 2026 (month = 12, year = 2026) for the test.
    // Target amount: 100,000, Bonus amount: 50,000, Effective from: 2026-12-01
    console.log('Setting daily sales target override...');
    // Delete any existing override first to be safe
    await supabase.from('daily_sales_targets').delete().eq('outlet_id', testOutletId).eq('effective_from', '2026-12-01');

    const { data: insertedTarget, error: targetError } = await supabase
      .from('daily_sales_targets')
      .insert({
        outlet_id: testOutletId,
        target_amount: 100000, // target: 100,000 IDR
        bonus_amount: 50000,   // bonus: 50,000 IDR
        effective_from: '2026-12-01',
        created_at: new Date('2026-12-01T00:00:00.000Z').toISOString()
      })
      .select();

    if (targetError) {
      throw new Error(`Failed to insert daily target override: ${targetError.message}`);
    }

    createdTargetId = insertedTarget[0].id;
    console.log(`Target override set successfully (ID: ${createdTargetId})`);

    // Verify resolve functions resolve correct values
    const { data: resolvedTarget } = await supabase.rpc('resolve_daily_target', {
      p_outlet: testOutletId,
      p_date: '2026-12-05'
    });
    console.log(`Resolved target amount for 2026-12-05: ${resolvedTarget}`);
    if (parseFloat(resolvedTarget) !== 100000) {
      throw new Error(`Expected resolved target to be 100000, got ${resolvedTarget}`);
    }

    const { data: resolvedBonus } = await supabase.rpc('resolve_daily_bonus', {
      p_outlet: testOutletId,
      p_date: '2026-12-05'
    });
    console.log(`Resolved bonus amount for 2026-12-05: ${resolvedBonus}`);
    if (parseFloat(resolvedBonus) !== 50000) {
      throw new Error(`Expected resolved bonus to be 50000, got ${resolvedBonus}`);
    }

    // 4. Insert mock completed orders for the test month/year:
    // Day 1: 2026-12-05 (sales = 150,000, target = 100,000) -> Target Reached! (Bonus = 50,000)
    // Day 2: 2026-12-06 (sales = 50,000, target = 100,000) -> Target Missed! (Bonus = 0)
    console.log('Inserting mock completed orders...');
    const mockOrders = [
      {
        outlet_id: testOutletId,
        status: 'completed',
        total_amount: 150000,
        created_at: '2026-12-05T05:00:00Z' // 12:00 Jakarta time
      },
      {
        outlet_id: testOutletId,
        status: 'completed',
        total_amount: 50000,
        created_at: '2026-12-06T09:00:00Z' // 16:00 Jakarta time
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
    console.log(`Mock orders inserted successfully: ${createdOrderIds.join(', ')}`);

    // 5. Test Case A: Call with Admin user
    if (adminUserId) {
      console.log(`--- Test Case A: Executing as Admin (User ID: ${adminUserId}) ---`);
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
      console.log('Admin call result:', resA);
      validateOutputRows(resA, testOutletName, crewCount, 50000 / crewCount);
      console.log('Test Case A PASSED ✅');
    }

    // 6. Test Case B: Call with Authorized Crew staff of the outlet
    console.log(`--- Test Case B: Executing as Authorized Crew (User ID: ${testCrewMember.id}) ---`);
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
    console.log('Authorized crew call result:', resB);
    validateOutputRows(resB, testOutletName, crewCount, 50000 / crewCount);
    console.log('Test Case B PASSED ✅');

    // 7. Test Case C: Call with Unauthorized Crew staff (from another outlet)
    if (otherCrewUserId) {
      console.log(`--- Test Case C: Executing as Unauthorized Crew (User ID: ${otherCrewUserId}) ---`);
      const runSqlC = `
        DO $$
        BEGIN
          PERFORM set_config('request.jwt.claims', json_build_object('sub', '${otherCrewUserId}')::text, true);
          PERFORM * FROM public.calculate_monthly_crew_bonus(12, 2026, '${testOutletId}');
        END $$;
      `;
      const { error: errC } = await supabase.rpc('exec_sql', { sql: runSqlC });
      if (errC && errC.message.includes('Unauthorized')) {
        console.log('Test Case C PASSED (unauthorized blocked correctly) ✅');
      } else {
        throw new Error(`Test Case C FAILED: Expected Unauthorized exception, got error: ${JSON.stringify(errC)}`);
      }
    }

    // 8. Test Case D: Call with Anonymous/Null user
    console.log('--- Test Case D: Executing as Anonymous ---');
    const runSqlD = `
      DO $$
      BEGIN
        PERFORM set_config('request.jwt.claims', '', true);
        PERFORM * FROM public.calculate_monthly_crew_bonus(12, 2026, '${testOutletId}');
      END $$;
    `;
    const { error: errD } = await supabase.rpc('exec_sql', { sql: runSqlD });
    if (errD && errD.message.includes('Unauthorized')) {
      console.log('Test Case D PASSED (anonymous blocked correctly) ✅');
    } else {
      throw new Error(`Test Case D FAILED: Expected Unauthorized exception, got error: ${JSON.stringify(errD)}`);
    }

    console.log('\nAll verification checks passed successfully! 🎉');

  } catch (error) {
    console.error('Verification Failed ❌');
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    // 9. Cleanup
    console.log('Starting cleanup...');

    if (createdOrderIds.length > 0) {
      console.log(`Deleting mock orders: ${createdOrderIds.join(', ')}`);
      const { error: deleteOrdersError } = await supabase
        .from('orders')
        .delete()
        .in('id', createdOrderIds);
      if (deleteOrdersError) {
        console.error('Error deleting mock orders during cleanup:', deleteOrdersError.message);
      }
    }

    if (createdTargetId) {
      console.log(`Deleting mock daily target override (ID: ${createdTargetId})`);
      const { error: deleteTargetError } = await supabase
        .from('daily_sales_targets')
        .delete()
        .eq('id', createdTargetId);
      if (deleteTargetError) {
        console.error('Error deleting mock target during cleanup:', deleteTargetError.message);
      }
    }

    if (tempTableCreated) {
      console.log('Dropping temp table public.temp_test_result...');
      const { error: dropErr } = await supabase.rpc('exec_sql', {
        sql: 'DROP TABLE IF EXISTS public.temp_test_result;'
      });
      if (dropErr) {
        console.error('Error dropping temp table:', dropErr.message);
      }
      await supabase.rpc('exec_sql', { sql: "NOTIFY pgrst, 'reload schema';" });
    }

    console.log('Cleanup completed.');
  }
}

function validateOutputRows(rows, expectedOutletName, expectedCrewCount, expectedBonusPerCrew) {
  if (!rows || rows.length !== expectedCrewCount) {
    throw new Error(`Assertion FAILED: Expected ${expectedCrewCount} rows, but got ${rows ? rows.length : 0}`);
  }
  for (const row of rows) {
    if (row.outlet_name !== expectedOutletName) {
      throw new Error(`Assertion FAILED: Expected outlet_name '${expectedOutletName}', but got '${row.outlet_name}'`);
    }
    if (row.role !== 'crew') {
      throw new Error(`Assertion FAILED: Expected role 'crew', but got '${row.role}'`);
    }
    if (row.days_target_reached !== 1) {
      throw new Error(`Assertion FAILED: Expected days_target_reached 1, but got ${row.days_target_reached}`);
    }
    
    const parsedBonus = parseFloat(row.total_bonus_received);
    if (Math.abs(parsedBonus - expectedBonusPerCrew) > 0.01) {
      throw new Error(`Assertion FAILED: Expected total_bonus_received ${expectedBonusPerCrew}, but got ${parsedBonus}`);
    }
  }
}

run();
