// BottomSheet + ItemSheet + CartSheet + StatusScreen

const { useState: useSheetState } = React;

function BottomSheet({ title, onClose, children, footer }) {
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet">
        <div className="sheet-handle"></div>
        <div className="sheet-header">
          <h2 className="sheet-title">{title}</h2>
          <button className="sheet-close" onClick={onClose}>×</button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-footer">{footer}</div>}
      </div>
    </>
  );
}

function ItemSheet({ item, onClose, onAdd }) {
  const [sel, setSel] = useSheetState(() => defaultSelections(item));
  const [qty, setQty] = useSheetState(1);
  const [note, setNote] = useSheetState('');

  function toggleOpt(v, optName) {
    if (v.isMulti) {
      setSel(s => {
        const arr = s[v.id] || [];
        const next = arr.includes(optName)
          ? arr.filter(n => n !== optName)
          : [...arr, optName];
        return { ...s, [v.id]: next };
      });
    } else {
      setSel(s => ({ ...s, [v.id]: optName }));
    }
  }

  const unit = calcUnitPrice(item, sel);
  const total = unit * qty;

  function valid() {
    for (const v of item.variants) {
      if (!v.isRequired) continue;
      const val = sel[v.id];
      if (v.isMulti) { if (!val || val.length === 0) return false; }
      else if (!val) return false;
    }
    return true;
  }

  function submit() {
    if (!valid()) return;
    onAdd({
      itemId: item.id, name: item.name, emoji: item.emoji,
      unitPrice: unit, qty, sel, note,
    });
  }

  return (
    <BottomSheet
      title={item.name}
      onClose={onClose}
      footer={
        <button className="btn-big" onClick={submit} disabled={!valid()} style={!valid() ? { opacity: .55 } : null}>
          <span>Tambah ke Keranjang</span>
          <span>{formatRupiah(total)}</span>
        </button>
      }
    >
      <div className="item-hero">{item.emoji}</div>
      {item.desc && <p style={{ color: 'var(--fg-muted)', fontSize: 14, margin: '0 0 18px' }}>{item.desc}</p>}

      {item.variants.map(v => (
        <div className="variant-group" key={v.id}>
          <div className="variant-label">
            {v.label}
            {v.isRequired ? <span className="variant-req">Wajib</span> : <span className="variant-opt-label">Opsional</span>}
          </div>
          {v.options.map(o => {
            const checked = v.isMulti
              ? (sel[v.id] || []).includes(o.name)
              : sel[v.id] === o.name;
            return (
              <label className="opt" key={o.id} onClick={e => { e.preventDefault(); toggleOpt(v, o.name); }}>
                <span className="opt-left">
                  <input type={v.isMulti ? 'checkbox' : 'radio'} checked={checked} readOnly />
                  {o.name}
                </span>
                <span className="opt-price">
                  {o.mod > 0 ? '+ ' + formatRupiah(o.mod) : o.mod < 0 ? '− ' + formatRupiah(-o.mod) : ''}
                </span>
              </label>
            );
          })}
        </div>
      ))}

      <div className="variant-group">
        <div className="variant-label">
          Catatan untuk dapur <span className="variant-opt-label">Opsional</span>
        </div>
        <textarea
          className="notes"
          style={{
            width: '100%', border: '1.5px solid var(--line-2)', borderRadius: 10,
            padding: '11px 12px', fontSize: 14, fontFamily: 'var(--font-sans)',
            outline: 'none', background: 'var(--surface)',
          }}
          placeholder="Contoh: tanpa bawang, tidak pedas…"
          value={note}
          onChange={e => setNote(e.target.value)}
        />
      </div>

      <div className="variant-group">
        <div className="variant-label">Jumlah</div>
        <div className="qty-row">
          <button className="qty-btn" onClick={() => setQty(q => Math.max(1, q - 1))}>−</button>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{qty}</span>
          <button className="qty-btn plus" onClick={() => setQty(q => q + 1)}>+</button>
        </div>
      </div>
    </BottomSheet>
  );
}

function CartSheet({ cart, outlet, onClose, onRemove, onPay }) {
  const [name, setName] = useSheetState('');
  const [wa, setWA]     = useSheetState('');
  const [time, setTime] = useSheetState('');
  const [note, setNote] = useSheetState('');
  const [errors, setErrors] = useSheetState({});

  const subtotal = cart.reduce((s, i) => s + i.unitPrice * i.qty, 0);
  const fee = Math.ceil(subtotal * SERVICE_FEE_RATE);
  const total = subtotal + fee;

  function submit() {
    const e = {};
    if (name.trim().length < 2) e.name = true;
    if (!/^(\+?62|0)8\d{7,11}$/.test(wa.replace(/\s/g, ''))) e.wa = true;
    if (time.trim().length < 2) e.time = true;
    setErrors(e);
    if (Object.keys(e).length === 0) onPay({ name, wa, time, note });
  }

  return (
    <BottomSheet
      title="Keranjang"
      onClose={onClose}
      footer={
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13, color: 'var(--fg-muted)' }}>
            <span>Subtotal</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatRupiah(subtotal)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 12, color: 'var(--fg-muted)' }}>
            <span>Biaya layanan (0.7%)</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatRupiah(fee)}</span>
          </div>
          <button className="btn-big" onClick={submit}>
            <span>Bayar Sekarang</span>
            <span>{formatRupiah(total)}</span>
          </button>
        </>
      }
    >
      <div className="stepper">
        <div className="step on"></div>
        <div className="step on"></div>
        <div className="step"></div>
      </div>

      <div className="summary">
        {cart.map((it, idx) => {
          const sub = summarizeSelections(it.sel, MENU.find(m => m.id === it.itemId)?.variants || []);
          return (
            <div className="summary-row" key={idx}>
              <span className="n">
                <b>{it.qty}× {it.name}</b>
                {sub && <><br /><span style={{ color: 'var(--fg-muted)', fontSize: 12 }}>{sub}</span></>}
                {it.note && <><br /><span style={{ color: 'var(--fg-muted)', fontSize: 12 }}>📝 {it.note}</span></>}
              </span>
              <span style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatRupiah(it.unitPrice * it.qty)}</span>
                <br /><span className="del" onClick={() => onRemove(idx)}>Hapus</span>
              </span>
            </div>
          );
        })}
        <div className="summary-row total">
          <span>Subtotal</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatRupiah(subtotal)}</span>
        </div>
      </div>

      <div className={'field' + (errors.name ? ' has-error' : '')}>
        <label>Nama Pemesan <span className="req">*</span></label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Contoh: Budi Santoso" />
        <div className="err">Nama wajib diisi</div>
      </div>

      <div className={'field' + (errors.wa ? ' has-error' : '')}>
        <label>Nomor WhatsApp <span className="req">*</span></label>
        <input value={wa} onChange={e => setWA(e.target.value)} placeholder="08xx xxxx xxxx" inputMode="numeric" />
        <div className="hint">Format: 08xxx atau 628xxx</div>
        <div className="err">Nomor WA tidak valid</div>
      </div>

      <div className={'field' + (errors.time ? ' has-error' : '')}>
        <label>Waktu Ambil <span className="req">*</span></label>
        <input value={time} onChange={e => setTime(e.target.value)} placeholder="Contoh: 30 menit lagi / jam 14:00" />
        <div className="err">Waktu ambil wajib diisi</div>
      </div>

      <div className="field">
        <label>Catatan Tambahan</label>
        <textarea className="notes" value={note} onChange={e => setNote(e.target.value)}
          placeholder="Opsional — tuliskan permintaan khusus" />
      </div>

      <HintBanner>Pesanan langsung tercatat. Selesaikan pembayaran di kasir outlet saat pickup.</HintBanner>
    </BottomSheet>
  );
}

function StatusScreen({ orderNumber, outlet, customer, total, onBack, onNewOrder }) {
  return (
    <>
      <Topbar onBack={onBack} />
      <div className="status-hero">
        <div className="status-icon">✅</div>
        <div className="status-title">Pesanan tercatat!</div>
        <div className="status-sub">Tunjukkan nomor ini di kasir outlet</div>
        <div className="status-chip preparing">DISIAPKAN</div>
      </div>

      <div className="order-number-big">#{orderNumber}</div>

      <div className="info-card">
        <div className="info-row"><span className="label">Outlet</span><span className="val">{outlet.name}</span></div>
        <div className="info-row"><span className="label">Atas Nama</span><span className="val">{customer.name}</span></div>
        <div className="info-row"><span className="label">WhatsApp</span><span className="val">{customer.wa}</span></div>
        <div className="info-row"><span className="label">Waktu Ambil</span><span className="val">{customer.time}</span></div>
        <div className="info-row"><span className="label">Total Bayar</span><span className="val" style={{ color: 'var(--brand)' }}>{formatRupiah(total)}</span></div>
      </div>

      <div style={{ padding: '0 12px 24px' }}>
        <HintBanner>Bayar saat pickup di kasir outlet. Tunjukkan halaman ini ke kasir untuk konfirmasi.</HintBanner>
        <button className="btn-outline" onClick={onNewOrder}>Pesan Lagi</button>
      </div>
    </>
  );
}

Object.assign(window, { BottomSheet, ItemSheet, CartSheet, StatusScreen });
