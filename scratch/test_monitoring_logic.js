const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../apps/admin-dashboard/.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function formatWIBTime(tsServerStr) {
  try {
    const d = new Date(tsServerStr);
    return d.toLocaleTimeString('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).replace(':', '.') + ' WIB';
  } catch {
    return '';
  }
}

function getWIBDateStr(tsServerStr) {
  try {
    const d = new Date(tsServerStr);
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(d);
  } catch {
    return tsServerStr ? tsServerStr.slice(0, 10) : '';
  }
}

function cleanOutletShortName(name) {
  return name.replace(/^SUKA SHAWARMA\s+/i, '').replace(/^MITRA\s+/i, '');
}

async function testMonitoringLogic() {
  const targetDateStr = '2026-07-27';
  const start = `${targetDateStr}T00:00:00+07:00`;
  const end = `${targetDateStr}T23:59:59+07:00`;

  const [outRes, stfRes, mapRes, attRes] = await Promise.all([
    supabase.from('outlets').select('id, name, is_active, region').eq('is_active', true),
    supabase.from('outlet_staff').select('id, name, outlet_id, role, is_active').eq('is_active', true).in('role', ['crew', 'leader']),
    supabase.from('staff_outlets').select('staff_id, outlet_id'),
    supabase.from('attendance')
      .select('outlet_id, outlet_staff_id, type, ts_server')
      .gte('ts_server', start)
      .lte('ts_server', end)
      .order('ts_server', { ascending: true })
  ]);

  const outlets = outRes.data || [];
  const staffList = stfRes.data || [];
  const staffOutletMappings = mapRes.data || [];
  const attendances = attRes.data || [];

  // Group attendances by staff_id for targetDateStr
  const staffAttMap = new Map(); // staff_id -> list of atts on targetDateStr
  attendances.forEach(a => {
    if (getWIBDateStr(a.ts_server) === targetDateStr) {
      if (!staffAttMap.has(a.outlet_staff_id)) {
        staffAttMap.set(a.outlet_staff_id, []);
      }
      staffAttMap.get(a.outlet_staff_id).push(a);
    }
  });

  outlets.forEach(outlet => {
    // Staff for this outlet: primary OR mapped
    const outletStaff = staffList.filter(s =>
      s.outlet_id === outlet.id ||
      staffOutletMappings.some(m => m.staff_id === s.id && m.outlet_id === outlet.id)
    );

    if (outletStaff.length > 0) {
      console.log(`\n=== OUTLET: ${outlet.name} (${outlet.region}) ===`);
      outletStaff.forEach(staff => {
        const staffAtts = staffAttMap.get(staff.id) || [];
        const attAtThisOutlet = staffAtts.filter(a => a.outlet_id === outlet.id);
        const latestAttThisOutlet = attAtThisOutlet.length > 0 ? attAtThisOutlet[attAtThisOutlet.length - 1] : null;

        let badgeLabel = 'BELUM ABSEN';
        let badgeType = 'none'; // 'local' | 'remote' | 'none'
        let timeStr = '';

        if (latestAttThisOutlet) {
          badgeType = 'local';
          badgeLabel = latestAttThisOutlet.type === 'in' ? 'HADIR' : 'PULANG';
          timeStr = formatWIBTime(latestAttThisOutlet.ts_server);
        } else if (staffAtts.length > 0) {
          // Attended at another outlet
          badgeType = 'remote';
          const latestRemoteAtt = staffAtts[staffAtts.length - 1];
          const remoteOutlet = outlets.find(o => o.id === latestRemoteAtt.outlet_id);
          const remoteShortName = remoteOutlet ? cleanOutletShortName(remoteOutlet.name) : 'Outlet Lain';
          const actionWord = latestRemoteAtt.type === 'in' ? 'HADIR' : 'PULANG';
          badgeLabel = `${actionWord} DI ${remoteShortName}`;
          timeStr = formatWIBTime(latestRemoteAtt.ts_server);
        }

        console.log(`  - [${staff.role.toUpperCase()}] ${staff.name} -> Badge: "${badgeLabel}" (${timeStr}) [Type: ${badgeType}]`);
      });
    }
  });
}

testMonitoringLogic();
