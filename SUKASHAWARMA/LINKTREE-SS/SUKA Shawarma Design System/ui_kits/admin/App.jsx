// Root admin app — login → tab navigation

const { useState: useAA } = React;

function AdminApp() {
  const [user, setUser] = useAA(null);
  const [tab, setTab]   = useAA('orders');     // default to orders — primary workflow
  const [orders, setOrders] = useAA(ORDERS_SEED);
  const [menu, setMenu]     = useAA(MENU_ADM);
  const [toast, setToast]   = useAA('');

  function flashToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 1800);
  }

  if (!user) {
    return <Login onSignIn={setUser} />;
  }

  return (
    <div className="app">
      {tab === 'dashboard' && <Dashboard user={user} orders={orders} onNav={setTab} />}
      {tab === 'orders'    && <Orders user={user} orders={orders} setOrders={setOrders} onToast={flashToast} />}
      {tab === 'menu'      && <MenuAdmin user={user} items={menu} setItems={setMenu} onToast={flashToast} />}
      {tab === 'reports'   && <Reports />}
      {tab === 'outlets'   && <OutletsAdmin user={user} />}

      <AdminNav active={tab} onNav={setTab} />

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<AdminApp />);
