// Admin screens: Login, Dashboard, Orders, Menu CRUD list, Outlets list

const { useState: useAS, useMemo: useAM } = React;

// ── Shared chrome ─────────────────────────────────────
function AdminTopbar({ emoji, title, sub, role, live, action }) {
  return (
    <div className="topbar">
      <div className="topbar-l">
        {emoji && <div className="topbar-emoji">{emoji}</div>}
        <div className="topbar-text">
          <div className="topbar-title">{title}</div>
          {sub && <div className="topbar-sub">{sub}</div>}
        </div>
        {role && <span className="role-chip">{role}</span>}
        {live && <span className="pulse-dot" title="Realtime aktif"></span>}
      </div>
      <div>{action}</div>
    </div>
  );
}

const NAV_ITEMS = [
  { key: 'dashboard', icon: '🏠', label: 'Dashboard' },
  { key: 'orders',    icon: '📋', label: 'Pesanan' },
  { key: 'menu',      icon: '🌯', label: 'Menu' },
  { key: 'reports',   icon: '📊', label: 'Laporan' },
  { key: 'outlets',   icon: '📍', label: 'Outlet' },
];

function AdminNav({ active, onNav }) {
  return (
    <nav className="nav">
      {NAV_ITEMS.map(n => (
        <div
          key={n.key}
          className={'nav-item' + (n.key === active ? ' active' : '')}
          onClick={() => onNav(n.key)}
        >
          <span className="ic">{n.icon}</span>
          <span>{n.label}</span>
        </div>
      ))}
    </nav>
  );
}

// ── Login screen ──────────────────────────────────────
function Login({ onSignIn }) {
  const [email, setEmail] = useAS('admin@sukshawarma.com');
  const [pwd, setPwd] = useAS('');
  const [err, setErr] = useAS('');
  const [busy, setBusy] = useAS(false);

  function submit() {
    setErr('');
    if (!email || !pwd) { setErr('Email dan password wajib diisi.'); return; }
    setBusy(true);
    setTimeout(() => { setBusy(false); onSignIn({ email, role: 'super_admin', name: 'Admin Pusat' }); }, 700);
  }

  return (
    <div className="app" data-screen-label="01 Login">
      <div className="login">
        <div className="login-brand">
          <div className="login-emoji">🌯</div>
          <div className="login-name">SUKA Shawarma</div>
          <div className="login-sub">Panel Admin</div>
        </div>

        <div className="field">
          <label className="field-label">Email</label>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@sukshawarma.com" />
        </div>
        <div className="field">
          <label className="field-label">Password</label>
          <input type="password" value={pwd} onChange={e => setPwd(e.target.value)} placeholder="••••••••" />
          <div className="err">{err}</div>
        </div>

        <button className="btn-big" onClick={submit} disabled={busy}>
          {busy ? 'Memproses…' : 'Masuk'}
        </button>
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────
function Dashboard({ user, orders, onNav }) {
  const todays = orders.filter(o => Date.now() - o.createdAt < 24 * 3600 * 1000);
  const revenue = todays
    .filter(o => ['paid','preparing','ready','done'].includes(o.status))
    .reduce((s, o) => s + o.total, 0);
  const pending = todays.filter(o => o.status === 'paid').length;
  const activeOutlets = OUTLETS_ADM.filter(o => o.active).length;

  return (
    <>
      <AdminTopbar
        emoji="🌯"
        title="SUKA Admin"
        sub={user.name}
        role={user.role === 'super_admin' ? 'super admin' : 'staff'}
        action={<button className="btn-link">Keluar</button>}
      />

      <div data-screen-label="02 Dashboard">
        <div className="stat-grid">
          <div className="stat"><div className="ic">🛍️</div><div className="val">{todays.length}</div><div className="lbl">Order Hari Ini</div></div>
          <div className="stat"><div className="ic">💰</div><div className="val" style={{ fontSize: 16 }}>{shortRp(revenue)}</div><div className="lbl">Pendapatan</div></div>
          <div className="stat"><div className="ic">⏳</div><div className="val">{pending}</div><div className="lbl">Perlu Diproses</div></div>
          <div className="stat"><div className="ic">📍</div><div className="val">{activeOutlets}</div><div className="lbl">Outlet Aktif</div></div>
        </div>

        <div className="section-title">Aktivitas Terbaru</div>
        <div className="order-list">
          {todays.slice(0, 3).map(o => (
            <div className="order" key={o.id}>
              <div className="order-head">
                <div>
                  <span className="order-num">{o.number}</span>
                  <div className="order-name">{o.customer}</div>
                  <div className="order-meta">{o.outletName} · {fmtTimeAgo(o.createdAt)}</div>
                </div>
                <div className="order-right">
                  <span className={'status ' + o.status}>{STATUS_LABEL[o.status]}</span>
                  <div className="order-total">{formatRupiah(o.total)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: '0 12px 14px' }}>
          <button className="btn-link" onClick={() => onNav('orders')}>Lihat semua pesanan →</button>
        </div>
      </div>
    </>
  );
}

Object.assign(window, { AdminTopbar, AdminNav, Login, Dashboard });
