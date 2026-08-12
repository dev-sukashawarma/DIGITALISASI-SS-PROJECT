// Atomic UI: Topbar, OutletSelector, CategoryTabs, HintBanner, EmptyState, Toast

const { useState, useRef, useEffect } = React;

function Topbar({ title, onCart, cartCount, onBack }) {
  return (
    <div className="topbar">
      {onBack ? (
        <button className="topbar-ic" onClick={onBack}>‹</button>
      ) : (
        <div className="topbar-logo">
          <span className="emoji">🌯</span>
          <span>SUKA Shawarma</span>
        </div>
      )}
      {title && <span className="topbar-title">{title}</span>}
      {onCart ? (
        <button className="topbar-ic" onClick={onCart}>
          🛒
          {cartCount > 0 && <span className="cart-dot">{cartCount}</span>}
        </button>
      ) : (
        <span style={{ width: 32 }}></span>
      )}
    </div>
  );
}

function OutletSelector({ outlet, outlets, onSelect }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const filtered = q
    ? outlets.filter(o => o.name.toLowerCase().includes(q.toLowerCase()))
    : outlets;

  return (
    <div className="os-wrap">
      <div className="os" onClick={() => setOpen(!open)}>
        <div className="os-left">
          <span className="os-icon">📍</span>
          <div className="os-text">
            <div className="os-label">Pickup di</div>
            <div className="os-name">{outlet.name}</div>
          </div>
        </div>
        <span className="os-arrow">{open ? '▴' : '▾'}</span>
      </div>
      {open && (
        <div className="os-dropdown">
          <div className="os-search">
            <input
              autoFocus
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Cari outlet…"
              onClick={e => e.stopPropagation()}
            />
          </div>
          <div className="os-list">
            {filtered.length === 0 ? (
              <div style={{ padding: 14, textAlign: 'center', color: 'var(--fg-muted)', fontSize: 13 }}>
                Outlet tidak ditemukan
              </div>
            ) : filtered.map(o => (
              <div
                key={o.slug}
                className={'os-item' + (o.slug === outlet.slug ? ' active' : '')}
                onClick={() => { onSelect(o); setOpen(false); setQ(''); }}
              >
                <div className="os-item-name">{o.name}</div>
                <div className="os-item-meta">
                  <span className={'dot ' + (o.isOpen ? 'open' : 'closed')}>●</span>{' '}
                  {o.isOpen ? 'Buka' : 'Tutup'} · {o.open}–{o.close}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryTabs({ active, onChange, categories }) {
  const tabs = ['Semua', '⭐ Best Seller', ...categories.map(c => c.name)];
  return (
    <div className="tabs">
      {tabs.map(t => (
        <div
          key={t}
          className={'tab' + (t === active ? ' active' : '')}
          onClick={() => onChange(t)}
        >
          {t}
        </div>
      ))}
    </div>
  );
}

function HintBanner({ children }) {
  return <div className="hint-banner">💡 {children}</div>;
}

function EmptyState({ icon, title, desc }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px 40px', color: 'var(--fg-faint)' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg2)', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13 }}>{desc}</div>
    </div>
  );
}

function Toast({ message }) {
  if (!message) return null;
  return <div className="toast show">{message}</div>;
}

Object.assign(window, { Topbar, OutletSelector, CategoryTabs, HintBanner, EmptyState, Toast });
