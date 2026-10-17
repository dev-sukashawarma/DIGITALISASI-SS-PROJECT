import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.redirect('https://agents.sukashawarma.com/telegram?login=invite_required')
}
