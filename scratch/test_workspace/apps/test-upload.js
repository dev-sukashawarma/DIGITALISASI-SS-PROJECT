import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function test() {
  const { data: item } = await supabase.from('bahan_baku').select('id, image_url, image_urls').limit(1).single()
  console.log('Current item:', item)
  
  const publicUrl = 'https://example.com/test.jpg'
  const currentUrls = item.image_urls || []
  const newUrls = [...currentUrls, publicUrl]
  
  console.log('Updating to:', newUrls)
  const { data: updated, error } = await supabase.from('bahan_baku').update({
    image_url: item.image_url || publicUrl,
    image_urls: newUrls
  }).eq('id', item.id).select('id, image_url, image_urls')
  
  if (error) {
    console.error('Update Error:', error.message)
  } else {
    console.log('Updated item:', updated)
  }
}

test()
