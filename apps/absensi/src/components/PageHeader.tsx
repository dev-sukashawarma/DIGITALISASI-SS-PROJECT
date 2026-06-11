"use client";

import React from "react";

type PageHeaderProps = {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
};

// Header standar semua halaman dashboard: judul + subjudul + aksi.
// Aksi otomatis turun ke bawah (full-width) di layar sempit.
export function PageHeader({ icon, title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3 min-w-0">
        {icon && (
          <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-suka-cream text-suka-brown">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-suka-ink leading-tight">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0 sm:ml-4">{action}</div>}
    </div>
  );
}

// Chip kecil bergaya brand untuk info ringkas (mis. tanggal hari ini).
export function InfoPill({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-suka-cream px-3 py-1.5 text-xs font-medium text-suka-brown whitespace-nowrap">
      {icon}
      {children}
    </span>
  );
}
