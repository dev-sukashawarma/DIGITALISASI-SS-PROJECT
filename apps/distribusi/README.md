# apps/distribusi — M3: Supply Chain Pusat→Outlet

**Track:** Dev A · Spec: [`docs/PRD.md`](../../docs/PRD.md) §M3

- Gudang Pusat buat **Surat Jalan** (outlet + item + qty dikirim)
- Outlet **verifikasi terima** (qty diterima vs dikirim, selisih, foto)
- Status: `dikirim → diterima_sebagian/lengkap → selisih_dicatat`
- **Integrasi:** qty terverifikasi → baris "stok masuk" di ledger M2

Status: belum mulai (menunggu M0 + M2 ledger).
