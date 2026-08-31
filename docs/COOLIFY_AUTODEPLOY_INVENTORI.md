# Deploy otomatis Inventori

Workflow `.github/workflows/deploy-inventori-coolify.yml` menjalankan deploy
Inventori setiap perubahan terkait Inventori masuk ke branch `main`.

Satu kali konfigurasi yang diperlukan:

1. Di Coolify buka aplikasi **INVENTORI**, kemudian salin **Deploy Webhook URL**.
2. Di GitHub repository buka **Settings → Secrets and variables → Actions**.
3. Tambahkan repository secret bernama `COOLIFY_INVENTORI_DEPLOY_WEBHOOK` dengan
   isi URL webhook tersebut.

Setelah secret disimpan, setiap push yang menyentuh `apps/inventori`, auth bersama,
atau dependensi root akan memicu build/deploy di VPS. Workflow memakai concurrency,
sehingga push baru membatalkan deploy lama yang masih menunggu dan hanya revision
terbaru yang diproses.
