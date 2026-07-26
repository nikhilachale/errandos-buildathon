import { describe, expect, it } from 'vitest';
import {
  buildCodCheckoutSnapshot,
  isExplicitCodConfirmation,
} from './cod';

const checkout = [
  '<hierarchy>',
  '<node text="Shipment of 1 item"/>',
  '<node resource-id="com.grofers.customerapp:id/title" content-desc="Lay&apos;s Magic Masala"/>',
  '<node text="Delivering to Home, Bengaluru"/>',
  '<node text="Bill total"/>',
  '<node text="₹125"/>',
  '<node text="Cash on Delivery"/>',
  '<node text="Place Order" clickable="true"/>',
  '</hierarchy>',
].join('');

describe('COD checkout safeguards', () => {
  it('requires the full explicit confirmation phrase', () => {
    expect(isExplicitCodConfirmation('Confirm COD order')).toBe(true);
    expect(isExplicitCodConfirmation('Please confirm C.O.D. order')).toBe(true);
    expect(isExplicitCodConfirmation('Yes')).toBe(false);
    expect(isExplicitCodConfirmation('Add to cart')).toBe(false);
    expect(isExplicitCodConfirmation('Place order')).toBe(false);
  });

  it('builds stable review terms only with COD evidence', () => {
    expect(buildCodCheckoutSnapshot(checkout)).toMatchObject({
      addressLabel: 'Home',
      itemCount: 1,
      paymentMode: 'cod',
      total: 125,
    });
    expect(buildCodCheckoutSnapshot(checkout.replace('Cash on Delivery', 'UPI')))
      .toBeUndefined();
  });

  it('rejects unavailable COD', () => {
    expect(buildCodCheckoutSnapshot(
      checkout.replace('Cash on Delivery', 'Cash on Delivery unavailable'),
    )).toBeUndefined();
  });
});
