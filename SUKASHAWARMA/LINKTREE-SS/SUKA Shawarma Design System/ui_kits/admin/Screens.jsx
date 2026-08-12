// Orders + Menu + Outlets screens + Modal

const { useState: useS2, useMemo: useM2 } = React;

const ACTIVE_STATUSES = ['paid', 'preparing', 'ready'];

function Orders({ user, orders, setOrders, onToast }) {
  const [filter, setFilter] = useS2('active');
  const [detail, setDetail] = useS2(null);

  const filtered = useM2(() => {
    if (filter === 'active') return orders.filter(o => ACTIVE_STATUSES.includes(o.status));
    if (filter === 'all') return orders;
    return orders.filter(o => o.status === filter);
  }, [filter, orders]);

  function advance(o) {
    const nxt = STATUS_NEXT[o.status];
    if (!nxt) return;
    setOrders(os => os.map(x => x.id === o.id ? { ...x, status: nxt.next } : x));
    onToast(`✅ ${o.number} → ${STATUS_LABEL[nxt.next]}`);
  }
  function cancel(o) {
    setOrders(os => os.map(x => x.id === o.id ? { ...x, status: 'cancelled' } : x));
    onToast(`✅ Pesanan ${o.number} dibatalkan`);
  }

  return (
    <>
      <AdminTopbar
        emoji="📋"
        title="Pesanan"
        sub={user.role === 'super_admin' ? 'Semua outlet' : user.outletName}
        live
      />

      <div className="chips">
        {[
          ['active', 'Aktif'], ['paid', 'Dibayar'], ['preparing', 'Disiapkan'],
          ['ready', 'Siap Ambil'], ['done', 'Selesai'], ['all', 'Semua'],
        ].map(([k, l]) => (
          <div
            key={k}
            className={'chip' + (filter === k ? ' active' : '')}
            onClick={() => setFilter(k)}
          >{l}</div>
        ))}
      </div>

      <div data-screen-label="03 Orders">
        {filtered.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">📭</div>
            <div className="empty-title">Tidak ada pesanan</div>
            <div className="empty-desc">untuk filter ini</div>
          </div>
        ) : (
          <div className="order-list">
            {filtered.map(o => (
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
                <div className="order-summary">
                  {o.items.slice(0, 2).map(i => `${i.qty}× ${i.name}`).join(', ')}
                  {o.items.length > 2 ? ` +${o.items.length - 2} lagi` : ''}
                </div>
                {o.pickupTime && <div className="order-pickup">⏰ Ambil: {o.pickupTime}</div>}
                {o.notes && <div className="order-note">📝 {o.notes}</div>}

                <div className="order-actions">
                  {STATUS_NEXT[o.status] && (
                    <button className="action primary" onClick={() => advance(o)}>
                      {STATUS_NEXT[o.status].label}
                    </button>
                  )}
                  <button className="action secondary" onClick={() => setDetail(o)}>Detail</button>
                  {ACTIVE_STATUSES.includes(o.status) && (
                    <button className="action danger" onClick={() => cancel(o)}>Batalkan</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {detail && <OrderDetail order={detail} onClose={() => setDetail(null)} />}
    </>
  );
}

function OrderDetail({ order, onClose }) {
  return (
    <>
      <div className="scrim" onClick={onClose}></div>
      <div className="modal" data-screen-label="04 Order detail">
        <div className="modal-header">
          <div className="modal-title">📋 {order.number}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="modal-row"><span className="lbl">Status</span><span className="val"><span className={'status ' + order.status}>{STATUS_LABEL[order.status]}</span></span></div>
          <div className="modal-row"><span className="lbl">Nama</span><span className="val">{order.customer}</span></div>
          <div className="modal-row"><span className="lbl">WhatsApp</span><span className="val" style={{ color: 'var(--brand)' }}>{order.wa}</span></div>
          <div className="modal-row"><span className="lbl">Outlet</span><span className="val">{order.outletName}</span></div>
          {order.pickupTime && <div className="modal-row"><span className="lbl">Pickup</span><span className="val">{order.pickupTime}</span></div>}
          {order.notes && <div className="modal-row"><span className="lbl">Catatan</span><span className="val">{order.notes}</span></div>}

          <div className="section-title" style={{ padding: '14px 0 6px' }}>Item</div>
          <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '10px 12px' }}>
            {order.items.map((it, i) => (
              <div className="modal-row" key={i}>
                <span className="lbl" style={{ minWidth: 'auto', flex: 1 }}>
                  <b>{it.qty}× {it.name}</b>
                  {it.opts && <><br /><span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{it.opts}</span></>}
                </span>
                <span className="val" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {formatRupiah(it.qty * it.unitPrice)}
                </span>
              </div>
            ))}
            <div className="modal-row" style={{ borderTop: '1px dashed var(--line-2)', marginTop: 6, paddingTop: 10 }}>
              <span className="lbl" style={{ minWidth: 'auto', flex: 1, fontWeight: 800, color: 'var(--fg1)' }}>Total</span>
              <span className="val" style={{ textAlign: 'right', color: 'var(--brand)', fontSize: 15 }}>{formatRupiah(order.total)}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Menu CRUD ─────────────────────────────────────────
function MenuAdmin({ user, items, setItems, onToast }) {
  function toggle(id, key) {
    setItems(is => is.map(x => x.id === id ? { ...x, [key]: !x[key] } : x));
    const item = items.find(x => x.id === id);
    onToast(`✓ ${item.name}: ${key === 'available' ? (!item.available ? 'tersedia' : 'tidak tersedia') : (key === 'best' ? (!item.best ? 'jadi best seller' : 'bukan best seller') : '')}`);
  }
  return (
    <>
      <AdminTopbar
        emoji="🌯"
        title="Menu"
        sub={`${items.length} item · ${items.filter(i => i.available).length} tersedia`}
        action={<button className="btn-link">+ Item</button>}
      />
      <div data-screen-label="05 Menu CRUD" style={{ paddingTop: 8 }}>
        {items.map(it => (
          <div className="menu-row" key={it.id}>
            <div className="menu-row-img">{it.emoji}</div>
            <div className="menu-row-body">
              <div className="menu-row-name">{it.name} {it.best && <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: 'var(--brand)', padding: '1px 6px', borderRadius: 3, marginLeft: 4, letterSpacing: '.3px' }}>BEST</span>}</div>
              <div className="menu-row-meta">{it.category} · <span className="menu-row-price">{formatRupiah(it.price)}</span></div>
              <div style={{ display: 'flex', gap: 14, marginTop: 10, alignItems: 'center' }}>
                <label style={{ fontSize: 12, color: 'var(--fg2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  Tersedia
                  <label className="toggle">
                    <input type="checkbox" checked={it.available} onChange={() => toggle(it.id, 'available')} />
                    <span className="toggle-slider"></span>
                  </label>
                </label>
                <label style={{ fontSize: 12, color: 'var(--fg2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  Best
                  <label className="toggle">
                    <input type="checkbox" checked={it.best} onChange={() => toggle(it.id, 'best')} />
                    <span className="toggle-slider"></span>
                  </label>
                </label>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Outlets ──────────────────────────────────────────
function OutletsAdmin({ user }) {
  return (
    <>
      <AdminTopbar
        emoji="📍"
        title="Outlet"
        sub={`${OUTLETS_ADM.length} outlet`}
        action={<button className="btn-link">+ Outlet</button>}
      />
      <div data-screen-label="06 Outlets list" style={{ paddingTop: 8 }}>
        {OUTLETS_ADM.map(o => (
          <div className="menu-row" key={o.id}>
            <div className="menu-row-img" style={{ background: o.type === 'owned' ? 'linear-gradient(135deg,#ffd166,#ff8c42)' : 'linear-gradient(135deg,#fde2c4,#ffb088)' }}>
              {o.type === 'owned' ? '🏠' : '📍'}
            </div>
            <div className="menu-row-body">
              <div className="menu-row-name">{o.name}</div>
              <div className="menu-row-meta">{o.address}</div>
              <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className={'status ' + (o.active ? 'ready' : 'cancelled')}>{o.active ? 'Aktif' : 'Nonaktif'}</span>
                <span style={{ fontSize: 11, color: 'var(--fg-muted)' }}>{o.type === 'owned' ? 'Milik Sendiri' : 'Mitra'}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Reports placeholder ──────────────────────────────
function Reports() {
  return (
    <>
      <AdminTopbar emoji="📊" title="Laporan" sub="7 hari terakhir" />
      <div data-screen-label="07 Reports" className="empty">
        <div className="empty-icon">📊</div>
        <div className="empty-title">Laporan</div>
        <div className="empty-desc">Pendapatan, top menu, ekspor CSV — lihat source/admin-reports.html</div>
      </div>
    </>
  );
}

Object.assign(window, { Orders, MenuAdmin, OutletsAdmin, Reports });
