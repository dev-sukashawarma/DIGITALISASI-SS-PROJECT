export function generateStaticParams() {
  // Return an empty array so Next.js doesn't try to pre-render dynamic outlet IDs at build time,
  // but it satisfies the requirement for export. In a real app with static export, we'd fetch the IDs.
  return [];
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
