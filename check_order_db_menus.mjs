import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://qntuhtkujpwudcpudwbj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFudHVodGt1anB3dWRjcHVkd2JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNTMyNjcsImV4cCI6MjA5NDgyOTI2N30.X2pjS2ont0ekVVc71HLacM2I49aLeypLRRgoPQV6OTw'
)

async function check() {
  const { data: menus, error: menuErr } = await supabase.from('menu_items').select('*').ilike('name', '%test%').limit(1)
  console.log("Menus:", menus, menuErr)
}
check()
