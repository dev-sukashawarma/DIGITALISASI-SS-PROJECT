require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function test() {
  const { data } = supabase.storage
    .from('selfies')
    .getPublicUrl('43b7bbd1-1fd4-44b5-87ca-b07a271151af/5ff3d99d-e0e4-4724-bf3f-85eb9deb31ea.jpg')
  console.log(data)
}
test()
