import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // In a real app, you would verify the session using Supabase Auth
  // For the sake of this scaffolding, we check an imaginary session or token
  
  // const session = await getSession(request);
  // const userRole = session?.user?.role;
  
  // if (!session || (userRole !== 'area_manager' && userRole !== 'regional_manager')) {
  //   return NextResponse.redirect(new URL('/login', request.url));
  // }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - login (auth page)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|login).*)',
  ],
};
