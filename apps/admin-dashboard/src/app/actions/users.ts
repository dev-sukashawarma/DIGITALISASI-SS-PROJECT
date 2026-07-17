'use server'

import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { createOrderOnlineAdminClient } from '@/lib/supabase/order-online-client'
import type { StaffFormValues } from '@/lib/types'

// We need a Service Role client to create users
function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function createStaffSync(values: StaffFormValues) {
  const admin = getAdminSupabase()
  let orderOnline: any = null
  try { orderOnline = createOrderOnlineAdminClient() } catch (e) { console.warn('Order Online not configured, skipping sync') }
  
  const {
    name, username, password, role, outlet_id, outlet_ids,
    nik, email: personal_email, phone, address_ktp, address_domicile,
    birth_place, birth_date, gender, religion,
    emergency_name, emergency_relationship, emergency_phone,
    nip, contract_type, join_date, resign_date, leave_quota,
    basic_salary, allowance_position, allowance_presence,
    bank_name, bank_account_number, bank_account_name,
    npwp, bpjs_ketenagakerjaan, bpjs_kesehatan
  } = values as any;
  
  const email = `${String(username).toLowerCase().replace(/[^a-z0-9_]/g, "")}@outlet.local`;

  // 1. Create auth user in Digitalisasi
  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { role, name, outlet_id },
  });
  if (createError) throw new Error(`Failed creating auth user: ${createError.message}`);

  const staffId = newUser.user.id;

  // 2. Insert into Digitalisasi outlet_staff
  const { error: insertError } = await admin.from("outlet_staff").insert({
    id: staffId,
    outlet_id,
    name,
    role,
    username,
    status: "active",
    nik: nik || null,
    email: personal_email || null,
    phone: phone || null,
    address_ktp: address_ktp || null,
    address_domicile: address_domicile || null,
    birth_place: birth_place || null,
    birth_date: birth_date || null,
    gender: gender || null,
    religion: religion || null,
    emergency_name: emergency_name || null,
    emergency_relationship: emergency_relationship || null,
    emergency_phone: emergency_phone || null,
    nip: nip || null,
    contract_type: contract_type || null,
    join_date: join_date || null,
    resign_date: resign_date || null,
    leave_quota: typeof leave_quota === "number" ? leave_quota : 12,
  });

  if (insertError) {
    await admin.auth.admin.deleteUser(staffId);
    throw new Error(`Failed inserting outlet_staff: ${insertError.message}`);
  }
  
  // 3. Create auth user in Order Online
  // For Order Online to have the exact same User credentials
  if (orderOnline) {
    try {
      const { error: ooCreateError } = await orderOnline.auth.admin.createUser({
        id: staffId, // USE SAME ID
        email, 
        password, 
        email_confirm: true,
        user_metadata: { role: 'outlet_staff', full_name: name, outlet_id },
      });
      
      if (ooCreateError && !ooCreateError.message.includes('already exists')) {
        throw new Error(`Order Online Auth Error: ${ooCreateError.message}`);
      }
      
      // 4. Insert into Order Online admin_users
      const { error: ooAdminError } = await orderOnline.from("admin_users").upsert({
        id: staffId,
        email,
        full_name: name,
        role: 'outlet_staff',
        outlet_id,
        is_active: true
      });
      
      if (ooAdminError) {
        throw new Error(`Order Online Admin Users Error: ${ooAdminError.message}`);
      }
      
    } catch (syncError: any) {
      // Rollback Digitalisasi
      await admin.from("outlet_staff").delete().eq("id", staffId);
      await admin.auth.admin.deleteUser(staffId);
      throw new Error(syncError.message);
    }
  }

  // Financials and staff_outlets omitted for brevity but should be here if needed 
  // (In full implementation, I'd copy the rest of the edge function here)
  if (bank_name || bank_account_number || bank_account_name || basic_salary !== undefined) {
      await admin.from("staff_financials").insert({
        staff_id: staffId,
        basic_salary: basic_salary || 0,
        allowance_position: allowance_position || 0,
        allowance_presence: allowance_presence || 0,
        bank_name: bank_name || "",
        bank_account_number: bank_account_number || "",
        bank_account_name: bank_account_name || "",
        npwp: npwp || null,
        bpjs_ketenagakerjaan: bpjs_ketenagakerjaan || null,
        bpjs_kesehatan: bpjs_kesehatan || null,
      });
  }

  if (role === "leader" && Array.isArray(outlet_ids)) {
      const rows = outlet_ids.map((oid: string) => ({ staff_id: staffId, outlet_id: oid }));
      await admin.from("staff_outlets").insert(rows);
  }

  return { ok: true, staff_id: staffId };
}
