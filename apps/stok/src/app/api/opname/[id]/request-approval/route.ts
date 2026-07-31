import { NextResponse } from 'next/server';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  // In a real application, you would:
  // 1. Generate a secure token
  // 2. Save it to the database with the opname ID and an expiration time
  // 3. Send the link (e.g. https://domain.com/stok/opname/approve?token=...) via WhatsApp to the leader's number
  
  const mockToken = `magic_token_${id}_${Date.now()}`;
  const magicLink = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/stok/opname/approve?token=${mockToken}`;
  
  console.log(`[MAGIC LINK] Mengirim WhatsApp ke Leader untuk Opname ID: ${id}`);
  console.log(`[MAGIC LINK] URL: ${magicLink}`);
  
  return NextResponse.json({ 
    success: true, 
    message: 'Magic link has been sent to the leader/SPV/RM.' 
  });
}
