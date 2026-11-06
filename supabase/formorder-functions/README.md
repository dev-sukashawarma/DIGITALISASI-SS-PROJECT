# Edge function project FormOrder_SS (order-system / website pemesanan)

Project Supabase **terpisah** dari POS (`qntuhtkujpwudcpudwbj`). Sumber di sini
adalah salinan versi yang ter-deploy, disimpan agar perubahan punya jejak git.
Folder ini sengaja di luar `supabase/functions/` supaya deploy fungsi project
POS tidak ikut men-deploy-nya.

Deploy (satu fungsi = satu berkas `index.ts`, tanpa impor relatif):

```
supabase functions deploy <slug> --project-ref qntuhtkujpwudcpudwbj
```

Fungsi yang tercatat:
- `pull-online-order` — native POS menarik pesanan web ke DB POS (verify_jwt: true, anon key cukup)
- `kasir-order-done`, `kasir-order-cancel` — POS memberi tahu website pesanan selesai/batal (verify_jwt: false, auth di dalam fungsi)
