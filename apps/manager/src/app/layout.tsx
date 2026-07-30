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

  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-suka-gray-50">
        <Providers initialStaff={initialStaff}>
          <ManagerLayout 
            headerRight={<GlobalOutletFilter />}
          >
            {children}
          </ManagerLayout>
          <Toaster position="top-center" richColors />
        </Providers>
      </body>
    </html>
  );
}
