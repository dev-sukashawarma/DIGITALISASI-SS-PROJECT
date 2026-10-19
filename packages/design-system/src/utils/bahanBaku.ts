export const getBahanBakuSource = (nama: string): 'KITCHEN' | 'OUTLET' | 'GUDANG_PUSAT' | 'UNKNOWN' => {
  const upperNama = nama.toUpperCase();
  
  const outletItems = [
    'MIE',
    'LETTUCE',
    'ES BATU'
  ];
  
  // Disembunyikan dari outlet non-gudang di monitoring & form opname.
  // GARAM & SASA dikeluarkan 2026-10-19: master `peruntukan` = 'keduanya' dan
  // outlet menerima kirimannya sejak 11 Okt. Selaraskan dengan
  // bahan_baku.peruntukan = 'gudang' bila daftar ini diubah.
  const gudangPusatItems = [
    'JINTEN', 'KAYU MANIS', 'KETUMBAR', 'KUNYIT', 'CENGKEH'
  ];
  
  const kitchenItems = [
    'SAOS CABE', 'SAOS TOMAT', 'SAOS SAMYANG', 'MAYONES',
    'KULIT 25', 'KULIT 28', 'KULIT 32',
    'AYAM', 'SAPI', 'KENTANG', 'KEJU', 'TUM', 'BAWANG', 'TEPUNG',
    'MINYAK SAYUR', 'FOIL', 'SARUNG TANGAN BENING', 'KERTAS STRUK',
    'PLASTIK BESAR', 'PLASTIK KECIL', 'PLASTIK VACUM', 'PLASTIK MERAH',
    'POLYBAG', 'PAPER WRAP', 'POWDER TEH', 'POWDER JERUK', 'POWDER MIX',
    'CUP + TUTUP', 'SEDOTAN', 'STIKER'
  ];

  if (outletItems.includes(upperNama)) return 'OUTLET';
  if (gudangPusatItems.includes(upperNama)) return 'GUDANG_PUSAT';
  if (kitchenItems.includes(upperNama)) return 'KITCHEN';
  
  return 'UNKNOWN';
};
