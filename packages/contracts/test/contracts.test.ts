import { describe, expect, it } from 'vitest';
import {
  CommitResultSchema,
  LifecycleStatusSchema,
  ProductOfferSchema,
  ProposalSchema,
} from '../src/index.js';

const inr = (amountMinor: number) => ({ amountMinor, currency: 'INR' as const });

describe('ErrandOS contracts', () => {
  it('accepts a product offer with an opaque provider identifier', () => {
    const offer = ProductOfferSchema.parse({
      available: true,
      name: 'Amul Taaza Toned Milk',
      offerId: 'offer_milk_500',
      price: inr(2900),
      unit: '500 ml',
    });

    expect(offer.offerId).toBe('offer_milk_500');
  });

  it('accepts an immutable prepared proposal with exact terms', () => {
    const proposal = ProposalSchema.parse({
      addressLabel: 'Home',
      etaMinutes: 8,
      expiresAt: '2026-07-26T06:00:00.000Z',
      fees: inr(6200),
      items: [
        {
          name: 'Amul Taaza Toned Milk',
          offerId: 'offer_milk_500',
          quantity: 3,
          total: inr(8700),
          unit: '500 ml',
          unitPrice: inr(2900),
        },
      ],
      paymentMode: 'cod',
      proposalHash: 'a'.repeat(64),
      proposalId: 'proposal_demo_1',
      provider: 'demo',
      status: 'prepared',
      subtotal: inr(8700),
      total: inr(14900),
    });

    expect(proposal.total).toEqual(inr(14900));
  });

  it('rejects an invalid proposal hash', () => {
    expect(() =>
      ProposalSchema.parse({
        addressLabel: 'Home',
        etaMinutes: 8,
        expiresAt: '2026-07-26T06:00:00.000Z',
        fees: inr(0),
        items: [],
        paymentMode: 'cod',
        proposalHash: 'not-a-hash',
        proposalId: 'proposal_demo_1',
        provider: 'demo',
        status: 'prepared',
        subtotal: inr(0),
        total: inr(0),
      }),
    ).toThrow();
  });

  it('keeps ambiguous outcomes distinct from success', () => {
    const result = CommitResultSchema.parse({
      reconciliationId: 'reconcile_demo_1',
      status: 'ambiguous',
    });

    expect(result.status).toBe('ambiguous');
    expect(LifecycleStatusSchema.parse(result.status)).toBe('ambiguous');
  });
});
