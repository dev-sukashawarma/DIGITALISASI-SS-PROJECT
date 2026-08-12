// Root App — wires up state, screens, and renders.

const { useState: useAppState, useMemo } = React;

function App() {
  const [outlet, setOutlet] = useAppState(OUTLETS[1]);          // default Tebet
  const [activeCat, setActiveCat] = useAppState('Semua');
  const [cart, setCart] = useAppState([]);
  const [openItem, setOpenItem] = useAppState(null);
  const [showCart, setShowCart] = useAppState(false);
  const [toast, setToast] = useAppState('');
  const [orderInfo, setOrderInfo] = useAppState(null);          // after pay

  function flashToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 1800);
  }

  function addToCart(line) {
    setCart(c => [...c, line]);
    setOpenItem(null);
    flashToast('✓ ' + line.name + ' ditambahkan');
  }

  function removeFromCart(idx) {
    setCart(c => {
      const next = c.filter((_, i) => i !== idx);
      if (next.length === 0) setShowCart(false);
      return next;
    });
  }

  function pay(customer) {
    const orderNumber = 'SS' + Math.floor(100000 + Math.random() * 900000);
    const subtotal = cart.reduce((s, i) => s + i.unitPrice * i.qty, 0);
    const total = subtotal + Math.ceil(subtotal * SERVICE_FEE_RATE);
    setOrderInfo({ orderNumber, customer, total, outlet });
    setShowCart(false);
    setCart([]);
  }

  function newOrder() {
    setOrderInfo(null);
  }

  // Filter menu
  const sections = useMemo(() => {
    return CATEGORIES.map(cat => ({
      ...cat,
      items: MENU.filter(item => {
        if (item.categoryId !== cat.id) return false;
        if (activeCat === '⭐ Best Seller') return item.isBestSeller;
        if (activeCat !== 'Semua' && cat.name !== activeCat) return false;
        return true;
      }),
    })).filter(s => s.items.length);
  }, [activeCat]);

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const cartTotal = cart.reduce((s, i) => s + i.unitPrice * i.qty, 0);

  if (orderInfo) {
    return (
      <div className="app" data-screen-label="04 Order Status">
        <StatusScreen {...orderInfo} onBack={newOrder} onNewOrder={newOrder} />
      </div>
    );
  }

  return (
    <div className="app" data-screen-label="01 Home">
      <Topbar
        cartCount={cartCount}
        onCart={cartCount > 0 ? () => setShowCart(true) : null}
      />
      <OutletSelector outlet={outlet} outlets={OUTLETS} onSelect={(o) => { setOutlet(o); setCart([]); }} />
      <CategoryTabs active={activeCat} onChange={setActiveCat} categories={CATEGORIES} />

      <div data-screen-label="02 Menu list">
        {sections.length === 0 ? (
          <EmptyState icon="🍽️" title="Menu tidak ditemukan" desc="Coba kategori lain." />
        ) : sections.map(s => (
          <div key={s.id}>
            <div className="section-title">{s.name}</div>
            {s.items.map(it => <DealCard key={it.id} item={it} onOpen={setOpenItem} />)}
          </div>
        ))}
      </div>

      <CartBar count={cartCount} total={cartTotal} onOpen={() => setShowCart(true)} />

      {openItem && (
        <div data-screen-label="03 Item sheet">
          <ItemSheet item={openItem} onClose={() => setOpenItem(null)} onAdd={addToCart} />
        </div>
      )}
      {showCart && cart.length > 0 && (
        <div data-screen-label="03b Cart sheet">
          <CartSheet cart={cart} outlet={outlet}
            onClose={() => setShowCart(false)}
            onRemove={removeFromCart}
            onPay={pay}
          />
        </div>
      )}

      <Toast message={toast} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
