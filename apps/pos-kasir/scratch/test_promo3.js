const promos = [{scope: 'global', is_active: true, discount_type: 'percentage', discount_value: 90, min_purchase: 0}]
const calculateItemPrice = (price, id, promos, subtotal) => {
  const globalPromo = promos.find(p => p.scope === 'global' && p.is_active);
  if (globalPromo) {
    let apply = true;
    if (globalPromo.min_purchase && globalPromo.min_purchase > 0) {
      if (subtotal !== undefined && subtotal < globalPromo.min_purchase) {
        apply = false;
      }
    }
    if (apply) {
      return globalPromo.discount_type === 'nominal' ? Math.max(0, price - globalPromo.discount_value) : Math.max(0, price * (1 - globalPromo.discount_value / 100));
    }
  }
  return price;
}
console.log("Price with 0 subtotal:", calculateItemPrice(15000, 'abc', promos, 0));
console.log("Price with undefined subtotal:", calculateItemPrice(15000, 'abc', promos, undefined));
