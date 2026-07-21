import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Muat variabel lingkungan
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase credentials in .env.local")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testPrinterPresence() {
  console.log("=== Memulai Tes Integrasi Printer Presence (Backend Supabase) ===")
  const testOutletId = 'test-outlet-123'
  
  // Client 1: Mensimulasikan aplikasi Kasir (Frontend) yang terkoneksi ke Bluetooth Printer
  const kasirClient = createClient(supabaseUrl, supabaseAnonKey)
  const kasirRoom = kasirClient.channel('room:printer_status')

  // Client 2: Mensimulasikan aplikasi Manager/Kitchen yang mendengarkan status printer
  const listenerClient = createClient(supabaseUrl, supabaseAnonKey)
  const listenerRoom = listenerClient.channel('room:printer_status')

  return new Promise((resolve, reject) => {
    // Setup listener
    listenerRoom
      .on('presence', { event: 'sync' }, () => {
        const state = listenerRoom.presenceState()
        console.log("Menerima sinkronisasi presence dari server:", JSON.stringify(state, null, 2))
        
        // Cari status printer dari outlet test
        let found = false
        for (const presenceId in state) {
          const presences = state[presenceId]
          for (const presence of presences) {
            if (presence.outlet_id === testOutletId && presence.is_connected === true) {
              found = true
              console.log("✅ SUKSES: Backend (Supabase Realtime) berhasil menerima dan menyiarkan status Bluetooth Printer!")
              
              // Clean up
              kasirClient.removeChannel(kasirRoom)
              listenerClient.removeChannel(listenerRoom)
              resolve()
              return
            }
          }
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          console.log("Listener berhasil subscribe ke channel room:printer_status")
          
          // Setelah listener siap, jalankan kasir client untuk broadcast
          kasirRoom.subscribe(async (kasirStatus) => {
            if (kasirStatus === 'SUBSCRIBED') {
              console.log("Kasir berhasil subscribe. Mensimulasikan printer bluetooth TERKONEKSI...")
              
              try {
                await kasirRoom.track({
                  outlet_id: testOutletId,
                  is_connected: true, // Simulasikan printer connect
                  updated_at: new Date().toISOString()
                })
                console.log("Kasir berhasil men-track status is_connected: true ke backend")
              } catch (err) {
                console.error("Gagal melakukan track presence", err)
                reject(err)
              }
            }
          })
        }
      })
      
      // Timeout jika gagal dalam 10 detik
      setTimeout(() => {
        reject(new Error("Timeout: Gagal menerima presence sinkronisasi dalam 10 detik. Pastikan Realtime diaktifkan di tabel Supabase."))
      }, 10000)
  })
}

testPrinterPresence()
  .then(() => {
    console.log("Tes Backend Selesai. Semua sistem realtime bekerja.")
    process.exit(0)
  })
  .catch((err) => {
    console.error("❌ TES GAGAL:", err)
    process.exit(1)
  })
