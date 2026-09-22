import { NextResponse } from 'next/server';
import { invalidateMenuCache } from '@suka/cache';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    let outletId: string | undefined;
    try {
      const body = await req.json();
      outletId = body.outletId;
    } catch {
      // Body is optional
    }

    await invalidateMenuCache(outletId);

    return NextResponse.json({
      success: true,
      message: `Menu cache invalidated successfully (outlet: ${outletId || 'all'})`,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error('[API /api/menu/invalidate] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to invalidate cache' },
      { status: 500 }
    );
  }
}
