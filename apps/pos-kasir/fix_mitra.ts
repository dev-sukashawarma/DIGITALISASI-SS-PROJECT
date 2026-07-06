import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://khpkoreaaucvyqfhynfq.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function fixMitra() {
  const { data: outlets, error: outletError } = await supabase.from('outlets').select('*')
  if (outletError) {
    console.error('Error fetching outlets:', outletError)
    return
  }

  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
  if (listError) {
    console.error('Error listing users:', listError)
    return
  }

  let textContent = `DAFTAR AKUN LOGIN MITRA - SUKA SHAWARMA
=======================================
Semua akun menggunakan kredensial default berikut:
Password: password123
Role: Mitra

Daftar Outlet & Email Login:
---------------------------------------

`;

  let mitraCount = 1;

  for (const outlet of outlets) {
    let cleanName = outlet.name.replace(/MITRA |SUKA |SHAWARMA |\s*\(PUSAT\)\s*/gi, '').trim()
    if (!cleanName) cleanName = outlet.slug
    const area = cleanName.toLowerCase().replace(/\s+/g, '_')
    const email = `mitra_${area}@sukashawarma.com`
    
    if (outlet.type === 'mitra') {
      // Keep this one
      textContent += `${mitraCount}. ${outlet.name}\n`;
      textContent += `   Email: ${email}\n\n`;
      mitraCount++;
    } else {
      // Delete this one if it exists
      const existingUser = users.find(u => u.email === email)
      if (existingUser) {
        console.log(`Deleting invalid mitra account for non-mitra outlet ${outlet.name}: ${email}`)
        
        // Delete from outlet_staff (might be cascaded, but just in case)
        await supabase.from('outlet_staff').delete().eq('id', existingUser.id)
        
        // Delete from auth.users
        const { error: delError } = await supabase.auth.admin.deleteUser(existingUser.id)
        if (delError) {
          console.error(`Failed to delete user ${email}:`, delError)
        } else {
          console.log(`Successfully deleted ${email}`)
        }
      }
    }
  }

  textContent += `=======================================
Harap ganti password default jika sudah login demi keamanan.
`;

  const txtPath = path.join(__dirname, '../../daftar_akun_mitra.txt')
  fs.writeFileSync(txtPath, textContent, 'utf-8')
  console.log('Successfully generated updated daftar_akun_mitra.txt')
}

fixMitra().catch(console.error)
