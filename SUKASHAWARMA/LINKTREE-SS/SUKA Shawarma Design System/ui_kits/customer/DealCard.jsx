// Deal card (TikTok-food style menu item row) + CartBar

function DealCard({ item, onOpen }) {
  const hasDiscount = item.comparePrice && item.comparePrice > item.basePrice;
  const pct = hasDiscount
    ? Math.round((item.comparePrice - item.basePrice) / item.comparePrice * 100)
    : 0;

  return (
    <div
      className={'deal' + (!item.available ? ' unavailable' : '')}
      onClick={() => item.available && onOpen(item)}
    >
      <div className="deal-img-wrap">
        <div className="deal-img">{item.emoji}</div>
        {item.isBestSeller && item.available && <span className="deal-img-badge">BEST SELLER</span>}
        {!item.available && <span className="deal-img-badge sold-out">HABIS</span>}
        {hasDiscount && item.available && (
          <span className="deal-img-badge discount">-{pct}%</span>
        )}
      </div>
      <div className="deal-body">
        <div className="deal-name">{item.name}</div>
        <div className="deal-desc">{item.desc}</div>
        <div className="deal-price-row">
          <div>
            <div className="deal-price">{formatRupiah(item.basePrice)}</div>
            {hasDiscount && (
              <div className="deal-price-meta">
                <span className="deal-compare">{formatRupiah(item.comparePrice)}</span>
                <span className="deal-discount">-{pct}%</span>
              </div>
            )}
          </div>
          {item.available && (
            <button
              className="deal-add"
              onClick={e => { e.stopPropagation(); onOpen(item); }}
            >+</button>
          )}
        </div>
      </div>
    </div>
  );
}

function CartBar({ count, total, onOpen }) {
  return (
    <div
      className={'cart-bar' + (count === 0 ? ' hidden' : '')}
      onClick={onOpen}
    >
      <div className="cart-bar-left">
        <div className="cart-count">{count}</div>
        <div>
          <div className="cart-label">{count} item</div>
          <div className="cart-total">{formatRupiah(total)}</div>
        </div>
      </div>
      <div className="cart-cta">Pesan →</div>
    </div>
  );
}

Object.assign(window, { DealCard, CartBar });
