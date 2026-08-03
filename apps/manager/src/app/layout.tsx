import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import { Toaster } from 'sonner';
import { ManagerLayout } from "@/components/ManagerLayout";
import GlobalOutletFilter from "@/components/layout/GlobalOutletFilter";

import { headers } from 'next/headers'
import { parseStaffHeader, STAFF_HEADER } from '@suka/auth'
import { Providers } from './Providers'
import { createClient } from '@supabase/supabase-js'

export const metadata: Metadata = {
  title: "SS Manager Dashboard",
  description: "Dashboard agregat untuk Area Manager dan Regional Manager",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const initialStaff = parseStaffHeader(headersList.get(STAFF_HEADER));

  // Fetch real outlets for the GlobalOutletFilter
  let outlets: { id: string, name: string }[] = [];
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    let query = supabaseAdmin
      .from('outlets')
      .select('id, name')
      .eq('is_active', true)
      .order('name');
      
    if (initialStaff?.role === 'area_manager') {
      const { data: so } = await supabaseAdmin.from('staff_outlets').select('outlet_id').eq('staff_id', initialStaff.id);
      if (so && so.length > 0) {
        query = query.in('id', so.map((s: any) => s.outlet_id));
      } else {
        query = query.in('id', ['00000000-0000-0000-0000-000000000000']);
      }
    }

    const { data } = await query;
    if (data) outlets = data;
  } catch (e) {
    console.error('Failed to fetch outlets for layout', e);
  }

  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-suka-gray-50">
        <Providers initialStaff={initialStaff}>
          <ManagerLayout 
            headerRight={<GlobalOutletFilter outlets={outlets} />}
          >
            {children}
          </ManagerLayout>
          <Toaster position="top-center" richColors />
        </Providers>
      </body>
    </html>
  );
}
