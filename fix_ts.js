const fs = require('fs');
let f1 = 'apps/stok/src/app/stok/mutasi/[id]/page.tsx';
if (fs.existsSync(f1)) {
  let c = fs.readFileSync(f1, 'utf-8');
  c = c.replace('const router = useRouter();', '');
  c = c.replace('useMutasiList(selectedOutletId)', 'useMutasiList(selectedOutletId || undefined)');
  fs.writeFileSync(f1, c);
}
let f2 = 'apps/stok/src/app/stok/opname-approval/page.tsx';
if (fs.existsSync(f2)) {
  let c = fs.readFileSync(f2, 'utf-8');
  c = c.replace('const router = useRouter();', '');
  c = c.replace('useOpnameList(selectedOutletId)', 'useOpnameList(selectedOutletId || undefined)');
  c = c.replace('(i) =>', '(i: any) =>');
  c = c.replace('(item) =>', '(item: any) =>');
  fs.writeFileSync(f2, c);
}
let f3 = 'apps/stok/src/app/stok/ledger/page.tsx';
if (fs.existsSync(f3)) {
  let c = fs.readFileSync(f3, 'utf-8');
  c = c.replace('const { outletStaff, boundOutlets } = useAuth();', 'const { outletStaff } = useAuth();');
  fs.writeFileSync(f3, c);
}
let f4 = 'apps/stok/src/app/stok/waste-approval/page.tsx';
if (fs.existsSync(f4)) {
  let c = fs.readFileSync(f4, 'utf-8');
  c = c.replace(/^import .*$/gm, '// import removed');
  fs.writeFileSync(f4, c);
}
let f5 = 'apps/stok/src/components/common/BottomNav.tsx';
if (fs.existsSync(f5)) {
  let c = fs.readFileSync(f5, 'utf-8');
  c = c.replace('const { profile } = useAuth();', 'const { outletStaff } = useAuth();');
  c = c.replace('profile?.role', 'outletStaff?.role');
  fs.writeFileSync(f5, c);
}
let f6 = 'apps/stok/src/components/monitoring/__tests__/MonitoringDetailModal.test.tsx';
if (fs.existsSync(f6)) {
  let c = fs.readFileSync(f6, 'utf-8');
  c = c.replace("last_opname_date: '2023-10-01'", "last_opname_date: '2023-10-01', satuan_tengah: null, faktor_tengah: null");
  fs.writeFileSync(f6, c);
}
let f7 = 'apps/stok/src/components/monitoring/__tests__/TransferSuggestionPanel.test.tsx';
if (fs.existsSync(f7)) {
  let c = fs.readFileSync(f7, 'utf-8');
  c = c.replace('satuan_tengah: undefined', 'satuan_tengah: null');
  fs.writeFileSync(f7, c);
}
let f8 = 'apps/stok/src/components/monitoring/ProductionEstimateWidget.tsx';
if (fs.existsSync(f8)) {
  let c = fs.readFileSync(f8, 'utf-8');
  c = c.replace('import type { ProductionEstimate }', '// import type { ProductionEstimate }');
  fs.writeFileSync(f8, c);
}
let f9 = 'apps/stok/src/components/monitoring/TransferSuggestionPanel.tsx';
if (fs.existsSync(f9)) {
  let c = fs.readFileSync(f9, 'utf-8');
  c = c.replace('onTransfer,', '');
  fs.writeFileSync(f9, c);
}
let f10 = 'apps/stok/src/components/stok/OpnameForm.tsx';
if (fs.existsSync(f10)) {
  let c = fs.readFileSync(f10, 'utf-8');
  c = c.replace('const [magicLinkSent, setMagicLinkSent] = useState(false);', '');
  c = c.replace("let compLabel = '';", "let compLabel: string = '';");
  c = c.replace('let compLargeLabel = b.satuan;', 'let compLargeLabel: string = b.satuan;');
  fs.writeFileSync(f10, c);
}
let f11 = 'apps/stok/src/components/stok/OpnameList.tsx';
if (fs.existsSync(f11)) {
  let c = fs.readFileSync(f11, 'utf-8');
  c = c.replace('const isFinalized =', '// const isFinalized =');
  fs.writeFileSync(f11, c);
}
let f12 = 'apps/stok/src/lib/stok/transferSuggestion.test.ts';
if (fs.existsSync(f12)) {
  let c = fs.readFileSync(f12, 'utf-8');
  c = c.replace('satuan_tengah: undefined', 'satuan_tengah: null');
  fs.writeFileSync(f12, c);
}
console.log('done');
