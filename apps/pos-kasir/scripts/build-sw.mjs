// Bundle service worker (app/sw.ts → public/sw.js).
//
// Kenapa manual: Next 16 build memakai Turbopack, sedangkan @serwist/next
// menyuntik service worker lewat plugin webpack — di Turbopack plugin itu
// tidak pernah jalan, sehingga sw.js tidak dihasilkan sama sekali.
// Script ini dipanggil otomatis lewat lifecycle "prebuild".
import { build } from 'esbuild';

await build({
  entryPoints: ['app/sw.ts'],
  bundle: true,
  minify: true,
  format: 'iife',
  outfile: 'public/sw.js',
  define: {
    'process.env.NODE_ENV': '"production"',
    __SW_BUILD_REV__: JSON.stringify(Date.now().toString(36)),
  },
});

console.log('[build-sw] public/sw.js berhasil dibundel.');
