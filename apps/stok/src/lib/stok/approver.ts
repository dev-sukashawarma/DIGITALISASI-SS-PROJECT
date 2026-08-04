// Role yang boleh meng-approve permintaan bahan. Sinkron dengan komentar di
// `useApprovalList` (approver = leader/SPV/kitchen) dan RLS `permintaan_bahan`
// yang membatasi baris via `accessible_outlet_ids()`.
const APPROVER_ROLES = ['kitchen', 'admin_finance', 'spv', 'leader', 'regional_manager'] as const

export function isApproverRole(role: string | null | undefined): boolean {
  return !!role && (APPROVER_ROLES as readonly string[]).includes(role)
}

// Role yang boleh menyetujui/menolak opname. Dipakai sebagai gerbang otorisasi
// SERVER-SIDE di `app/actions/opname.ts`: action tersebut memakai service-role
// client + RPC SECURITY DEFINER yang tidak memeriksa role sama sekali, jadi
// guard UI saja tidak cukup — Server Action bisa dipanggil langsung.
const OPNAME_APPROVER_ROLES = ['leader', 'regional_manager', 'spv', 'kitchen', 'admin_finance', 'admin', 'owner'] as const

export function canApproveOpname(role: string | null | undefined): boolean {
  return !!role && (OPNAME_APPROVER_ROLES as readonly string[]).includes(role)
}

// Role yang boleh menyetujui/menolak permintaan bahan. Lebih ketat daripada
// approver opname: approval ini memanggil `create_surat_jalan()` — barang benar
// benar keluar dari Gudang Pusat. Hanya Gudang Pusat (`kitchen`) yang memutuskan
// pengeluaran; `admin`/`owner` untuk escalation. SPV & leader mengawasi saja.
// Gerbang server-side, sebab `approve_permintaan_svc` adalah SECURITY DEFINER
// tanpa pemeriksaan role apa pun.
const PERMINTAAN_APPROVER_ROLES = ['kitchen', 'admin_finance', 'admin', 'owner'] as const

export function canApprovePermintaan(role: string | null | undefined): boolean {
  return !!role && (PERMINTAAN_APPROVER_ROLES as readonly string[]).includes(role)
}
