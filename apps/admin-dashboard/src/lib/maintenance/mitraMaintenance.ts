export interface MitraMaintenanceConfig {
  is_active: boolean
  custom_html: string
  updated_at?: string
  updated_by?: string
}

export const DEFAULT_MITRA_MAINTENANCE_HTML = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>UNDER MAINTENANCE - Suka Shawarma</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=Lilita+One&display=swap" rel="stylesheet">
  <style>
    :root {
      --suka-primary: #f29744;
      --suka-orange: #f29744;
      --suka-brown: #701604;
      --suka-ink: #400a07;
      --suka-cream: #fff7ed;
      --suka-green: #0a7d2c;
      --text-body: #4b5563;
      --text-muted: #6b7280;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
    }

    body {
      min-height: 100vh;
      background-color: var(--suka-cream);
      background-image: 
        radial-gradient(at 0% 0%, rgba(242, 151, 68, 0.22) 0px, transparent 55%),
        radial-gradient(at 100% 100%, rgba(112, 22, 4, 0.12) 0px, transparent 55%),
        radial-gradient(at 50% 10%, rgba(254, 243, 199, 0.8) 0px, transparent 65%),
        linear-gradient(to right, rgba(112, 22, 4, 0.03) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(112, 22, 4, 0.03) 1px, transparent 1px);
      background-size: 100% 100%, 100% 100%, 100% 100%, 36px 36px, 36px 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      color: var(--suka-ink);
      overflow-x: hidden;
      position: relative;
    }

    /* Ambient Warm Orbs */
    .glow-orb {
      position: absolute;
      width: 480px;
      height: 480px;
      background: radial-gradient(circle, rgba(242, 151, 68, 0.25) 0%, rgba(242, 151, 68, 0) 70%);
      top: -120px;
      left: 50%;
      transform: translateX(-50%);
      border-radius: 50%;
      filter: blur(60px);
      pointer-events: none;
    }

    .card {
      position: relative;
      background: rgba(255, 255, 255, 0.94);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(112, 22, 4, 0.1);
      border-radius: 32px;
      padding: 46px 36px;
      max-width: 520px;
      width: 100%;
      text-align: center;
      box-shadow: 
        0 25px 50px -12px rgba(112, 22, 4, 0.14),
        0 0 0 1px rgba(255, 255, 255, 0.8) inset,
        0 10px 20px -5px rgba(242, 151, 68, 0.15);
      z-index: 10;
    }

    /* Brand Section */
    .brand-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      margin-bottom: 24px;
    }

    .brand-logo-container {
      width: 88px;
      height: 88px;
      padding: 8px;
      background: #ffffff;
      border: 2px solid rgba(242, 151, 68, 0.4);
      border-radius: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 
        0 14px 28px -6px rgba(242, 151, 68, 0.28),
        0 0 0 1px rgba(255, 255, 255, 0.9) inset;
      transition: transform 0.25s ease;
    }

    .brand-logo-container:hover {
      transform: scale(1.05);
    }

    .brand-logo {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .brand-tag {
      font-size: 12px;
      font-weight: 800;
      color: var(--suka-brown);
      letter-spacing: 0.16em;
      text-transform: uppercase;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 9999px;
      background: rgba(242, 151, 68, 0.12);
      border: 1px solid rgba(242, 151, 68, 0.25);
    }

    /* Main Title */
    h1.title {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 32px;
      font-weight: 900;
      letter-spacing: -0.01em;
      line-height: 1.15;
      text-transform: uppercase;
      color: var(--suka-brown);
      margin-bottom: 8px;
    }

    .subtitle {
      font-size: 14.5px;
      font-weight: 700;
      color: var(--suka-orange);
      margin-bottom: 18px;
      letter-spacing: 0.01em;
    }

    p.desc {
      font-size: 14px;
      color: var(--text-body);
      line-height: 1.65;
      margin-bottom: 34px;
      font-weight: 500;
    }

    /* Action Button */
    .btn-reload {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      width: 100%;
      padding: 16px 28px;
      background: linear-gradient(135deg, var(--suka-orange) 0%, #ea580c 100%);
      color: #ffffff;
      border: none;
      border-radius: 18px;
      font-size: 14.5px;
      font-weight: 800;
      cursor: pointer;
      transition: all 0.22s ease;
      box-shadow: 
        0 14px 28px -6px rgba(242, 151, 68, 0.42),
        0 0 0 1px rgba(255, 255, 255, 0.3) inset;
      text-decoration: none;
    }

    .btn-reload:hover {
      background: var(--suka-brown);
      transform: translateY(-2px);
      box-shadow: 0 18px 36px -6px rgba(112, 22, 4, 0.3);
    }

    .btn-reload:active {
      transform: translateY(0);
    }

    .footer-note {
      margin-top: 22px;
      font-size: 11px;
      color: var(--text-muted);
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }

    @media (max-width: 480px) {
      .card {
        padding: 34px 22px;
        border-radius: 26px;
      }
      h1.title {
        font-size: 26px;
      }
      .brand-logo-container {
        width: 76px;
        height: 76px;
      }
    }
  </style>
</head>
<body>
  <div class="glow-orb"></div>

  <div class="card">
    <!-- Brand Logo Section -->
    <div class="brand-section">
      <div class="brand-logo-container">
        <img src="/logo.png" alt="Logo Suka Shawarma" class="brand-logo" onerror="this.src='/logo.png'" />
      </div>
      <div class="brand-tag">SUKA SHAWARMA</div>
    </div>

    <!-- Title: UNDER MAINTENANCE -->
    <h1 class="title">UNDER MAINTENANCE</h1>
    <div class="subtitle">Peningkatan Kualitas & Optimalisasi Layanan</div>

    <p class="desc">
      Sistem sedang menjalani peningkatan performa rutin guna memastikan akurasi data laporan, keamanan transaksi, dan stabilitas server.
    </p>

    <!-- Action Button -->
    <button type="button" class="btn-reload" onclick="window.location.reload()">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
      </svg>
      Coba Muat Ulang Halaman
    </button>

    <p class="footer-note">SUKA SHAWARMA</p>
  </div>
</body>
</html>
`
